import { Component, OnInit, ViewChild, ElementRef, NgZone, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { take, takeUntil, debounceTime } from 'rxjs/operators';

// Services
import { NeedPublicationService, CreateNeedPublicationDTO, Donation } from '../../../core/services/post.service';
import { DonationTypeService } from '../../../core/services/post-type.service';
import { AuthService } from '../../../core/services/auth.service';
import { OrganizationProfileService } from '../../../core/services/organization-profile.service';
import { AiService } from '../../../core/services/ai.service';

// Models
import { DonationType } from '../../../shared/model/donation-type.model';

// Constants
const TAGS_LIMIT = 10;
const MAX_FILE_SIZE_MB = 5;
const MIN_TITLE_LENGTH = 10;
const MAX_TITLE_LENGTH = 100;
const MIN_DESCRIPTION_LENGTH = 20;
const MAX_DESCRIPTION_LENGTH = 1000;
const MIN_TAG_LENGTH = 2;
const MAX_TAG_LENGTH = 30;

interface ExistingImage {
  url: string;
  id?: string;
  name?: string;
}

interface FileValidationResult {
  valid: boolean;
  errors: string[];
}

interface TypePost {
  id: number;
  type: string;
}

@Component({
  selector: 'app-create-need',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-need.component.html',
  styleUrls: ['./create-need.component.scss']
})
export class CreateNeedComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput', { static: false }) fileInputRef!: ElementRef<HTMLInputElement>;

  // Form
  donationForm!: FormGroup;

  // UI State
  loading = false;
  loadingTypes = false;
  loadingAiTags = false;
  successMessage = '';
  errorMessage = '';

  // File Management
  selectedFiles: File[] = [];
  fileErrors: string[] = [];
  existingImages: ExistingImage[] = [];

  // AI Tags Management
  aiGeneratedTags: string[] = [];
  private aiGeneratedTagsMap: Map<number, string> = new Map();

  // Data
  donationTypes: DonationType[] = [];
  organizationName = 'Tu Organización';

  // Edit Mode
  isEditMode = false;
  publicationId: string | null = null;
  private existingPublication: Donation | null = null;

  // RxJS
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private donationService: NeedPublicationService,
    private donationTypeService: DonationTypeService,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private organizationProfileService: OrganizationProfileService,
    private aiService: AiService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadDonationTypes();
    this.loadOrganizationName();
    this.checkEditMode();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== INITIALIZATION ====================

  private initializeForm(): void {
    this.donationForm = this.fb.group({
      title: [
        '',
        [
          Validators.required,
          Validators.minLength(MIN_TITLE_LENGTH),
          Validators.maxLength(MAX_TITLE_LENGTH)
        ]
      ],
      description: [
        '',
        [
          Validators.required,
          Validators.minLength(MIN_DESCRIPTION_LENGTH),
          Validators.maxLength(MAX_DESCRIPTION_LENGTH)
        ]
      ],
      typePostId: ['', Validators.required],
      tags: this.fb.array([])
    });
  }

  private loadDonationTypes(): void {
    this.loadingTypes = true;
    this.donationForm.get('typePostId')?.disable();

    this.donationTypeService.getAllDonationTypes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (types) => {
          this.donationTypes = types;
          this.loadingTypes = false;
          this.donationForm.get('typePostId')?.enable();
        },
        error: (error) => {
          console.error('Error loading donation types:', error);
          this.donationTypes = this.donationTypeService.currentDonationTypes;
          this.loadingTypes = false;
          this.donationForm.get('typePostId')?.enable();
        }
      });
  }

  private loadOrganizationName(): void {
    this.authService.currentUser$
      .pipe(
        take(1),
        takeUntil(this.destroy$)
      )
      .subscribe(user => {
        if (!user) return;

        this.organizationProfileService.getMyOrganizationProfile()
          .pipe(take(1), takeUntil(this.destroy$))
          .subscribe({
            next: (profile) => {
              this.organizationName = profile.name || profile.username || user.username || 'Tu Organización';
            },
            error: () => {
              this.organizationName = user.username || 'Tu Organización';
            }
          });
      });
  }

  private checkEditMode(): void {
    this.route.params
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe(params => {
        const id = params['id'];
        if (id) {
          this.isEditMode = true;
          this.publicationId = id;
          this.loadPublicationForEdit(id);
        }
      });
  }

  private loadPublicationForEdit(id: string): void {
    this.loading = true;

    this.donationService.getPublicationById(id)
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe({
        next: (publication) => {
          this.existingPublication = publication;
          this.populateFormWithPublication(publication);
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading publication:', error);
          this.errorMessage = 'No se pudo cargar la publicación para editar';
          this.loading = false;
          this.redirectWithDelay('/donations/feed', 2000);
        }
      });
  }

  private populateFormWithPublication(publication: Donation): void {
    // Load types first if needed
    if (this.donationTypes.length === 0) {
      this.donationTypeService.getAllDonationTypes()
        .pipe(take(1), takeUntil(this.destroy$))
        .subscribe(types => {
          this.donationTypes = types;
          this.populateFormFields(publication);
        });
    } else {
      this.populateFormFields(publication);
    }
  }

  private populateFormFields(publication: Donation): void {
    this.donationForm.patchValue({
      title: publication.title || '',
      description: publication.description || publication.message || '',
      typePostId: publication.typePostId ? String(publication.typePostId) : ''
    });

    // Load existing tags
    if (publication.tags && publication.tags.length > 0) {
      this.aiGeneratedTags = publication.tags.map(t => t.tag || t.name || '');
    }

    // Load existing images from multiple possible locations
    this.existingImages = this.extractExistingImages(publication);
    console.log('Loaded existing images:', this.existingImages.length);
  }

  private extractExistingImages(publication: Donation): ExistingImage[] {
    const images: ExistingImage[] = [];

    // From files array
    if (publication.files && publication.files.length > 0) {
      publication.files.forEach(file => {
        if (file.type === 'image' && file.url) {
          images.push({
            url: file.url,
            id: file.id,
            name: file.name || `image-${images.length + 1}`
          });
        }
      });
    }

    // From imageUrl
    if (publication.imageUrl && !images.some(img => img.url === publication.imageUrl)) {
      images.push({
        url: publication.imageUrl,
        name: 'main image'
      });
    }

    // From images array
    if (Array.isArray(publication.images)) {
      publication.images.forEach((imgUrl, index) => {
        if (imgUrl && !images.some(img => img.url === imgUrl)) {
          images.push({
            url: imgUrl,
            name: `image-${index + 1}`
          });
        }
      });
    }

    // From imagePost
    if (Array.isArray((publication as any).imagePost)) {
      (publication as any).imagePost.forEach((imgPost: any, index: number) => {
        const imageUrl = imgPost.image || imgPost.url || imgPost.path;
        if (imageUrl && !images.some(img => img.url === imageUrl)) {
          images.push({
            url: imageUrl,
            id: String(imgPost.id || ''),
            name: `image-${images.length + 1}`
          });
        }
      });
    }

    return images;
  }

  // ==================== FORM GETTERS ====================

  get tags(): FormArray {
    return this.donationForm.get('tags') as FormArray;
  }

  // ==================== TAG MANAGEMENT ====================

  addTag(): void {
    if (this.tags.length < TAGS_LIMIT) {
      this.tags.push(
        this.fb.control('', [
          Validators.required,
          Validators.minLength(MIN_TAG_LENGTH),
          Validators.maxLength(MAX_TAG_LENGTH)
        ])
      );
    }
  }

  removeTag(index: number): void {
    this.aiGeneratedTagsMap.delete(index);
    this.updateAiTagsMapAfterRemoval(index);
    this.tags.removeAt(index);
  }

  dismissAiTag(tag: string): void {
    this.aiGeneratedTags = this.aiGeneratedTags.filter(t => t.toLowerCase() !== tag.toLowerCase());
  }

  onAddAiTag(tag: string): void {
    const normalized = (tag || '').trim();
    if (!normalized) return;

    if (this.tags.length >= TAGS_LIMIT) return;

    if (this.isTagAlreadyAdded(normalized)) return;

    const addTagToForm = (value: string) => {
      const finalValue = (value || '').trim();
      if (!finalValue || this.isTagAlreadyAdded(finalValue)) return;

      this.tags.push(
        this.fb.control(finalValue, [
          Validators.required,
          Validators.minLength(MIN_TAG_LENGTH),
          Validators.maxLength(MAX_TAG_LENGTH)
        ])
      );

      const newIndex = this.tags.length - 1;
      this.aiGeneratedTagsMap.set(newIndex, finalValue);
    };

    this.aiService.createTag(normalized)
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe({
        next: (createdTag) => {
          const value = createdTag?.tag ?? normalized;
          addTagToForm(value);
        },
        error: (error) => {
          console.error('❌ Error creando tag desde IA:', error);
          addTagToForm(normalized);
        }
      });
  }

  isTagAlreadyAdded(tag: string): boolean {
    const lower = tag.trim().toLowerCase();
    return this.tags.controls.some(control => (control.value || '').toString().trim().toLowerCase() === lower);
  }

  isAiGeneratedTag(tagIndex: number): boolean {
    return this.aiGeneratedTagsMap.has(tagIndex);
  }

  getAiTagValue(tagIndex: number): string | undefined {
    return this.aiGeneratedTagsMap.get(tagIndex);
  }

  private updateAiTagsMapAfterRemoval(removedIndex: number): void {
    const newMap = new Map<number, string>();
    this.aiGeneratedTagsMap.forEach((value, oldIndex) => {
      if (oldIndex < removedIndex) {
        newMap.set(oldIndex, value);
      } else if (oldIndex > removedIndex) {
        newMap.set(oldIndex - 1, value);
      }
    });
    this.aiGeneratedTagsMap = newMap;
  }

  // ==================== FILE MANAGEMENT ====================

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];

    // Clear input immediately to reset dialog
    input.value = '';

    if (files.length === 0) return;

    // Process outside Angular zone to avoid blocking dialog
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.ngZone.run(() => this.processSelectedFiles(files));
      }, 0);
    });
  }

  private processSelectedFiles(files: File[]): void {
    // Validate only images
    const nonImageFiles = files.filter(f => !f.type.startsWith('image/'));
    if (nonImageFiles.length > 0) {
      this.fileErrors = ['Solo se permiten archivos de imagen (JPG, PNG, GIF, etc.)'];
      return;
    }

    // Validate files
    const validation = this.donationService.validateFiles([...this.selectedFiles, ...files]);
    if (!validation.valid) {
      this.fileErrors = validation.errors;
      return;
    }

    // Add valid files
    this.selectedFiles = [...this.selectedFiles, ...files];
    this.fileErrors = [];

    // Process images with AI asynchronously
    setTimeout(() => this.processImagesForTags(), 300);
  }

  private processImagesForTags(): void {
    const imageFiles = this.selectedFiles.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    this.loadingAiTags = true;

    this.aiService.getTagsFromImages(imageFiles)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tags) => {
          this.loadingAiTags = false;
          this.addAiTagsToForm(tags || []);
        },
        error: (error) => {
          console.error('Error generating AI tags:', error);
          this.loadingAiTags = false;
          this.aiGeneratedTags = [];
        }
      });
  }

  private addAiTagsToForm(tags: string[]): void {
    if (!Array.isArray(tags) || tags.length === 0) return;

    const uniqueTags = [...new Set(tags.map(t => (t || '').trim()).filter(Boolean))];
    this.aiGeneratedTags = uniqueTags.filter(tag => !this.isTagAlreadyAdded(tag));
  }

  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
    this.fileErrors = [];

    // Remove AI tags if no images left
    const remainingImages = this.selectedFiles.filter(f => f.type.startsWith('image/'));
    if (remainingImages.length === 0) {
      this.clearAiTags();
    }
  }

  removeExistingImage(index: number): void {
    this.existingImages.splice(index, 1);
  }

  private clearAiTags(): void {
    const tagsToRemove: number[] = Array.from(this.aiGeneratedTagsMap.keys());
    tagsToRemove.sort((a, b) => b - a).forEach(i => this.tags.removeAt(i));
    this.aiGeneratedTags = [];
    this.aiGeneratedTagsMap.clear();
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.src = 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27100%27 height=%27100%27%3E%3Crect width=%27100%27 height=%27100%27 fill=%27%23ddd%27/%3E%3Ctext x=%2750%25%27 y=%2750%25%27 text-anchor=%27middle%27 dy=%27.3em%27 fill=%27%23999%27%3EError%3C/text%3E%3C/svg%3E';
    }
  }

  getFileIcon(file: File): string {
    if (file.type.startsWith('image/')) return '🖼️';
    if (file.type.startsWith('video/')) return '🎥';
    if (file.type === 'application/pdf') return '📄';
    return '📎';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  // ==================== FORM VALIDATION ====================

  hasError(fieldName: string): boolean {
    const field = this.donationForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getErrorMessage(fieldName: string): string {
    const field = this.donationForm.get(fieldName);
    if (!field) return '';

    if (field.hasError('serverError')) {
      return field.errors?.['serverError'] || 'Error en este campo';
    }

    const errorMap: { [key: string]: string } = {
      required: 'Este campo es requerido',
      minlength: this.getMinlengthMessage(field),
      maxlength: this.getMaxlengthMessage(field),
      min: 'La cantidad debe ser mayor a 0',
      max: 'La cantidad es demasiado grande'
    };

    for (const [errorKey, message] of Object.entries(errorMap)) {
      if (field.hasError(errorKey)) {
        return message;
      }
    }

    return '';
  }

  private getMinlengthMessage(field: AbstractControl): string {
    const minLength = field.errors?.['minlength']?.requiredLength;
    return minLength ? `Mínimo ${minLength} caracteres` : '';
  }

  private getMaxlengthMessage(field: AbstractControl): string {
    const maxLength = field.errors?.['maxlength']?.requiredLength;
    return maxLength ? `Máximo ${maxLength} caracteres` : '';
  }

  private handleValidationErrors(errorResponse: any): void {
    const errorMessages: string[] = [];
    const fieldMapping: { [key: string]: string } = {
      title: 'title',
      message: 'description',
      description: 'description',
      typePostId: 'typePostId',
      typePost: 'typePostId'
    };

    if (errorResponse?.errors && typeof errorResponse.errors === 'object') {
      Object.entries(errorResponse.errors).forEach(([backendField, error]: [string, any]) => {
        const frontendField = fieldMapping[backendField] || backendField;
        const fieldControl = this.donationForm.get(frontendField);

        if (fieldControl) {
          const errorMessage = Array.isArray(error) ? error[0] : error;
          fieldControl.setErrors({ serverError: errorMessage });
          fieldControl.markAsTouched();
          errorMessages.push(`${this.getFieldLabel(frontendField)}: ${errorMessage}`);
        } else {
          errorMessages.push(`${backendField}: ${error}`);
        }
      });
    }

    if (errorResponse?.message) {
      errorMessages.unshift(errorResponse.message);
    }

    this.errorMessage = errorMessages.length > 0
      ? errorMessages.join('\n')
      : 'Datos inválidos. Por favor verifica los campos.';

    this.markFormFieldsAsTouched();
  }

  private markFormFieldsAsTouched(): void {
    Object.values(this.donationForm.controls).forEach(control => {
      if (control && !control.valid) {
        control.markAsTouched();
      }
    });
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      title: 'Título',
      description: 'Descripción',
      typePostId: 'Tipo de Post'
    };
    return labels[fieldName] || fieldName;
  }

  // ==================== SUBMISSION ====================

  onSubmit(): void {
    if (this.donationForm.invalid) {
      this.markFormFieldsAsTouched();
      this.errorMessage = 'Por favor completa todos los campos requeridos correctamente';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const donationData = this.buildDonationData();
    if (!donationData) {
      this.loading = false;
      return;
    }

    if (this.isEditMode && this.publicationId) {
      this.updatePublication(donationData);
    } else {
      this.createPublication(donationData);
    }
  }

  private buildDonationData(): CreateNeedPublicationDTO | null {
    const formValue = this.donationForm.value;
    const selectedTypePost = this.getSelectedTypePost(formValue.typePostId);

    if (!selectedTypePost) {
      this.loading = false;
      this.errorMessage = 'Por favor selecciona un tipo de post válido';
      return null;
    }

    const typePostObj = this.validateAndBuildTypePost(selectedTypePost);
    if (!typePostObj) {
      this.loading = false;
      return null;
    }

    return {
      title: formValue.title?.trim() || '',
      message: formValue.description?.trim() || '',
      description: formValue.description?.trim() || '',
      typePost: typePostObj,
      typePostId: typePostObj.id
    };
  }

  private getSelectedTypePost(typePostId: string): DonationType | null {
    if (!typePostId || typePostId === '0') {
      console.error('No type post selected');
      return null;
    }

    return this.donationTypes.find(t => String(t.id) === String(typePostId)) || null;
  }

  private validateAndBuildTypePost(typePost: DonationType): TypePost | null {
    if (!typePost.type || !typePost.type.trim()) {
      this.errorMessage = 'El tipo de post no tiene el campo "type" requerido';
      console.error('Missing type field:', typePost);
      return null;
    }

    const id = parseInt(String(typePost.id));
    if (isNaN(id) || id <= 0) {
      this.errorMessage = `ID de tipo de post inválido: ${typePost.id}`;
      console.error('Invalid type post id:', typePost.id);
      return null;
    }

    return {
      id: id,
      type: typePost.type.trim()
    };
  }

  private createPublication(donationData: CreateNeedPublicationDTO): void {
    const createObservable = this.selectedFiles.length > 0
      ? this.donationService.createPublicationWithFiles(donationData, this.selectedFiles)
      : this.donationService.createPublication(donationData);

    createObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (newDonation: Donation) => {
          this.loading = false;
          this.successMessage = '¡Necesidad publicada exitosamente!';
          this.handleTagsForNewPublication(newDonation);
          this.redirectWithDelay(`/donations/${newDonation.id}`, 2000);
        },
        error: (error) => {
          this.loading = false;
          this.handleSubmitError(error);
        }
      });
  }

  private updatePublication(donationData: CreateNeedPublicationDTO): void {
    if (!this.publicationId) {
      this.loading = false;
      this.errorMessage = 'No se pudo identificar la publicación a editar';
      return;
    }

    this.donationService.updatePublication(this.publicationId, donationData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedDonation: Donation) => {
          this.loading = false;
          this.successMessage = '¡Publicación actualizada exitosamente!';
          this.handleTagsForNewPublication(updatedDonation, this.publicationId ?? undefined);
          this.redirectWithDelay(`/donations/${this.publicationId}`, 2000);
        },
        error: (error) => {
          this.loading = false;
          this.handleSubmitError(error);
        }
      });
  }

  private handleTagsForNewPublication(publication: Donation, publicationId?: string): void {
    const finalPublicationId = publicationId || publication.id;
    if (!finalPublicationId) return;

    const publicationIdStr = String(finalPublicationId);

    // Extraer tags manuales del formulario
    const manualTags = this.tags.controls
      .map(c => c.value?.trim())
      .filter((tag): tag is string => !!tag && tag.length > 0);

    console.log('🏷️ handleTagsForNewPublication:', {
      publicationId: publicationIdStr,
      manualTags: manualTags,
      aiGeneratedTags: Array.from(this.aiGeneratedTagsMap.values()),
      totalTags: manualTags.length
    });

    const uniqueTags = [...new Set(manualTags.map(tag => tag.trim()).filter(tag => !!tag))];

    if (uniqueTags.length > 0) {
      console.log('💾 Guardando tags finales:', uniqueTags);
      this.addTagsToPublication(publicationIdStr, uniqueTags);
    } else {
      console.log('⚠️ No hay tags para guardar');
    }
  }

  private addTagsToPublication(publicationId: string, tags: string[]): void {
    this.donationService.addTagsToPublication(publicationId, tags)
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe({
        next: (savedTags) => {
          console.log('Tags added successfully', savedTags);
          if (savedTags && savedTags.length > 0) {
            // Actualizar tags generados por IA en caso de que el backend los normalice
            this.aiGeneratedTags = savedTags.map(tag => tag.tag).filter(tag => !!tag);
          }
        },
        error: (error) => console.error('Error adding tags:', error)
      });
  }

  private handleSubmitError(error: any): void {
    console.error('Submission error:', error);

    const errorHandlers: { [key: number]: () => string } = {
      400: () => {
        this.handleValidationErrors(error.error);
        return this.errorMessage;
      },
      401: () => 'Sesión expirada. Por favor inicia sesión nuevamente.',
      403: () => error.error?.message || 'Solo organizaciones verificadas pueden crear donaciones.',
      404: () => 'Endpoint no encontrado. Verifica la configuración del servidor.',
      413: () => `Los archivos son demasiado grandes. Máximo: ${MAX_FILE_SIZE_MB}MB.`,
      500: () => 'Error del servidor. Por favor intenta más tarde.'
    };

    this.errorMessage = errorHandlers[error.status]?.() || 
      error.error?.message || 
      'Error al procesar la solicitud. Por favor intenta nuevamente.';
  }

  private redirectWithDelay(route: string, delayMs: number): void {
    setTimeout(() => {
      this.router.navigate([route]);
    }, delayMs);
  }

  // ==================== ACTIONS ====================

  onCancel(): void {
    if (confirm('¿Estás seguro de cancelar? Se perderán los datos ingresados.')) {
      this.router.navigate(['/organization']);
    }
  }

  clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }
}