import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';

// Services
import { NeedPublicationService, CreateNeedPublicationDTO, Donation } from '../../../core/services/post.service';
import { DonationTypeService } from '../../../core/services/post-type.service';
import { AuthService } from '../../../core/services/auth.service';
import { OrganizationProfileService, OrganizationProfile } from '../../../core/services/organization-profile.service';
import { AiService } from '../../../core/services/ai.service';

// Models
import { DonationType } from '../../../shared/model/donation-type.model';

const TAGS_LIMIT = 10;
const MAX_FILE_SIZE_MB = 5;
const MIN_TITLE_LENGTH = 10;
const MAX_TITLE_LENGTH = 100;
const MIN_DESCRIPTION_LENGTH = 20;
const MAX_DESCRIPTION_LENGTH = 1000;

interface ExistingImage {
  url: string;
  id?: string;
  name?: string;
}

interface TypePost {
  id: number;
  type: string;
}

@Component({
  selector: 'app-edit-publication',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-publication.component.html',
  styleUrls: ['./edit-publication.component.scss']
})
export class EditPublicationComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput', { static: false }) fileInputRef!: ElementRef<HTMLInputElement>;

  // Form
  publicationForm!: FormGroup;

  // UI State
  loading = false;
  loadingTypes = false;
  loadingAiTags = false;
  loadingPublication = true;
  successMessage = '';
  errorMessage = '';

  // File Management
  selectedFiles: File[] = [];
  fileErrors: string[] = [];
  existingImages: ExistingImage[] = [];

  // AI Tags Management
  aiGeneratedTags: string[] = [];
  aiSuggestedTags: string[] = [];
  private originalTags: Array<{ id: number; tag: string }> = [];

  // Data
  donationTypes: DonationType[] = [];
  organizationName = 'Tu Organización';
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
    private aiService: AiService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadDonationTypes();
    this.loadOrganizationName();
    this.loadPublication();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== INITIALIZATION ====================

  private initializeForm(): void {
    this.publicationForm = this.fb.group({
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
      typePostId: ['', Validators.required]
    });
  }

  private loadDonationTypes(): void {
    this.loadingTypes = true;
    this.publicationForm.get('typePostId')?.disable();

    this.donationTypeService.getAllDonationTypes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (types) => {
          this.donationTypes = types;
          this.loadingTypes = false;
          this.publicationForm.get('typePostId')?.enable();
        },
        error: (error) => {
          console.error('Error loading donation types:', error);
          this.donationTypes = this.donationTypeService.currentDonationTypes;
          this.loadingTypes = false;
          this.publicationForm.get('typePostId')?.enable();
        }
      });
  }

  private loadOrganizationName(): void {
    this.organizationProfileService.getMyOrganizationProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (profile: OrganizationProfile) => {
          this.organizationName = profile.name || 'Tu Organización';
        },
        error: (error: any) => {
          console.error('Error loading organization name:', error);
          this.organizationName = 'Tu Organización';
        }
      });
  }

  private loadPublication(): void {
    this.publicationId = this.route.snapshot.paramMap.get('id');

    if (!this.publicationId) {
      this.errorMessage = 'ID de publicación no válido';
      this.loadingPublication = false;
      return;
    }

    this.donationService.getDonationById(this.publicationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (publication) => {
          this.existingPublication = publication;
          this.populateForm(publication);
          this.loadingPublication = false;
        },
        error: (error) => {
          console.error('Error loading publication:', error);
          this.errorMessage = 'No se pudo cargar la publicación';
          this.loadingPublication = false;
        }
      });
  }

  private populateForm(publication: Donation): void {
    this.publicationForm.patchValue({
      title: publication.title,
      description: publication.description || publication.message,
      typePostId: publication.typePostId
    });

    if (publication.tags && publication.tags.length > 0) {
      this.originalTags = publication.tags.map(t => ({
        id: t.id,
        tag: t.tag || t.name || ''
      })).filter(t => !!t.tag);
      this.aiGeneratedTags = this.originalTags.map(t => t.tag);
      this.aiSuggestedTags = [];
    }

    if (publication.files && publication.files.length > 0) {
      this.existingImages = publication.files
        .filter(f => f.type === 'image')
        .map(f => ({
          url: f.url,
          id: f.id,
          name: f.name
        }));
    }
  }

  // ==================== VALIDATION ====================

  hasError(fieldName: string): boolean {
    const field = this.publicationForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getErrorMessage(fieldName: string): string {
    const field = this.publicationForm.get(fieldName);
    if (!field || !field.errors) return '';

    if (field.errors['required']) return 'Este campo es requerido';
    if (field.errors['minlength']) {
      const min = field.errors['minlength'].requiredLength;
      return `Mínimo ${min} caracteres`;
    }
    if (field.errors['maxlength']) {
      const max = field.errors['maxlength'].requiredLength;
      return `Máximo ${max} caracteres`;
    }

    return 'Campo inválido';
  }

  // ==================== FILE HANDLING ====================

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files: FileList | null = input.files;

    if (!files) return;

    this.fileErrors = [];
    const newFiles: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!file.type.startsWith('image/')) {
        this.fileErrors.push(`${file.name} no es una imagen válida`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        this.fileErrors.push(`${file.name} excede ${MAX_FILE_SIZE_MB}MB`);
        continue;
      }

      newFiles.push(file);
    }

    const totalImages = this.existingImages.length + this.selectedFiles.length + newFiles.length;
    if (totalImages > 5) {
      this.fileErrors.push(`No puedes subir más de 5 imágenes en total (actualmente tienes ${this.existingImages.length + this.selectedFiles.length})`);
      return;
    }

    this.selectedFiles = [...this.selectedFiles, ...newFiles];

    if (this.fileInputRef) {
      this.fileInputRef.nativeElement.value = '';
    }

    if (newFiles.length > 0) {
      this.generateAiTagsFromImages(newFiles);
    }
  }

  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
  }

  removeExistingImage(index: number): void {
    this.existingImages.splice(index, 1);
  }

  private generateAiTagsFromImages(files: File[]): void {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    this.loadingAiTags = true;
    this.aiService.getTagsFromImages(imageFiles, this.publicationId || '')
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe({
        next: (tags) => {
          if (Array.isArray(tags)) {
            const uniqueSuggestions = [...new Set(tags.map(tag => (tag || '').trim()).filter(Boolean))];
            const newSuggestions = uniqueSuggestions.filter(tag => !this.isTagAlreadyAdded(tag) && !this.isTagAlreadySuggested(tag));
            this.aiSuggestedTags = [...this.aiSuggestedTags, ...newSuggestions];
          }
          this.loadingAiTags = false;
        },
        error: (error) => {
          console.error('AI tags error:', error);
          this.loadingAiTags = false;
        }
      });
  }

  removeAiTag(tag: string): void {
    const normalized = this.normalizeTag(tag);
    this.aiGeneratedTags = this.aiGeneratedTags.filter(t => this.normalizeTag(t) !== normalized);
  }

  dismissSuggestedTag(tag: string): void {
    const normalized = this.normalizeTag(tag);
    this.aiSuggestedTags = this.aiSuggestedTags.filter(t => this.normalizeTag(t) !== normalized);
  }

  onAddAiTag(tag: string): void {
    const normalized = this.normalizeTag(tag);
    if (!normalized || this.isTagAlreadyAdded(tag)) {
      this.dismissSuggestedTag(tag);
      return;
    }

    this.aiService.createTag(tag)
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe({
        next: (createdTag) => {
          const value = createdTag?.tag ?? tag;
          const finalValue = value.trim();
          if (!finalValue) return;

          if (!this.isTagAlreadyAdded(finalValue)) {
            this.aiGeneratedTags = [...this.aiGeneratedTags, finalValue];
          }
          this.dismissSuggestedTag(tag);
        },
        error: (error) => {
          console.error('❌ Error creando tag desde IA (edición):', error);
          if (!this.isTagAlreadyAdded(tag)) {
            this.aiGeneratedTags = [...this.aiGeneratedTags, tag];
          }
          this.dismissSuggestedTag(tag);
        }
      });
  }

  isTagAlreadyAdded(tag: string): boolean {
    const normalized = this.normalizeTag(tag);
    return this.aiGeneratedTags.some(existing => this.normalizeTag(existing) === normalized);
  }

  private isTagAlreadySuggested(tag: string): boolean {
    const normalized = this.normalizeTag(tag);
    return this.aiSuggestedTags.some(existing => this.normalizeTag(existing) === normalized);
  }

  private normalizeTag(tag: string): string {
    return (tag || '').trim().toLowerCase();
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  // ==================== FORM SUBMISSION ====================

  onSubmit(): void {
    if (this.publicationForm.invalid) {
      this.errorMessage = 'Por favor completa todos los campos requeridos correctamente';
      return;
    }

    if (!this.publicationId) {
      this.errorMessage = 'ID de publicación no válido';
      return;
    }

    this.loading = true;
    this.successMessage = '';
    this.errorMessage = '';

    const formValue = this.publicationForm.value;

    const selectedType = this.donationTypes.find(t => String(t.id) === String(formValue.typePostId));
    const typePost = selectedType ? this.validateAndBuildTypePost(selectedType) : undefined;

    if (!selectedType || !typePost) {
      this.errorMessage = 'Tipo de publicación inválido';
      this.loading = false;
      return;
    }

    const updateData: CreateNeedPublicationDTO = {
      title: formValue.title?.trim() || '',
      description: formValue.description?.trim() || '',
      message: formValue.description?.trim() || '',
      typePostId: parseInt(formValue.typePostId),
      typePost,
      articles: [],
      comments: [],
      comunity: this.existingPublication?.comunity || '',
      fechaMaximaEntrega: this.existingPublication?.fechaMaximaEntrega || ''
    };

    this.updatePublication(updateData);
  }

  private validateAndBuildTypePost(typePost: DonationType): TypePost | undefined {
    if (!typePost.type || !typePost.type.trim()) {
      this.errorMessage = 'El tipo de post no tiene el campo "type" requerido';
      this.loading = false;
      return undefined;
    }

    const id = parseInt(String(typePost.id));
    if (isNaN(id) || id <= 0) {
      this.errorMessage = `ID de tipo de post inválido: ${typePost.id}`;
      this.loading = false;
      return undefined;
    }

    return {
      id: id,
      type: typePost.type.trim()
    };
  }

  private updatePublication(updateData: CreateNeedPublicationDTO): void {
    if (!this.publicationId) return;

    const updateObservable = this.selectedFiles.length > 0
      ? this.donationService.updatePublicationWithFiles(this.publicationId, updateData, this.selectedFiles)
      : this.donationService.updatePublication(this.publicationId, updateData);

    updateObservable
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedPublication: Donation) => {
          this.loading = false;
          this.successMessage = 'Publicación actualizada exitosamente!';
          this.handleTagsForPublication(updatedPublication);
          this.redirectWithDelay(`/donations/${updatedPublication.id}`, 2000);
        },
        error: (error) => {
          this.loading = false;
          this.handleSubmitError(error);
        }
      });
  }

  private handleTagsForPublication(publication: Donation): void {
    const publicationIdStr = String(publication.id);

    // Identificar tags que fueron eliminados
    const currentTagStrings = this.aiGeneratedTags.map(t => t.trim().toLowerCase());
    const tagsToDelete = this.originalTags.filter(
      original => !currentTagStrings.includes(original.tag.trim().toLowerCase())
    );

    // Identificar tags nuevos (que no existían en original)
    const originalTagStrings = this.originalTags.map(t => t.tag.trim().toLowerCase());
    const newTags = this.aiGeneratedTags
      .map(tag => tag.trim())
      .filter(tag => !!tag && !originalTagStrings.includes(tag.toLowerCase()));

    // Eliminar tags que fueron removidos
    if (tagsToDelete.length > 0) {
      tagsToDelete.forEach(tag => {
        this.donationService.deleteTagFromPublication(publicationIdStr, tag.id)
          .pipe(take(1), takeUntil(this.destroy$))
          .subscribe({
            next: () => console.log(`Tag "${tag.tag}" eliminado exitosamente`),
            error: (error: any) => console.error(`Error eliminando tag "${tag.tag}":`, error)
          });
      });
    }

    // Agregar tags nuevos
    if (newTags.length > 0) {
      this.donationService.addTagsToPublication(publicationIdStr, newTags)
        .pipe(take(1), takeUntil(this.destroy$))
        .subscribe({
          next: (savedTags) => {
            console.log('Nuevos tags agregados exitosamente', savedTags);
            // Actualizar la lista de tags originales con los nuevos
            if (savedTags && savedTags.length > 0) {
              const newOriginalTags = savedTags.map(tag => ({
                id: tag.id,
                tag: tag.tag
              }));
              this.originalTags = [...this.originalTags.filter(t => currentTagStrings.includes(t.tag.trim().toLowerCase())), ...newOriginalTags];
            }
          },
          error: (error: any) => console.error('Error al agregar nuevos tags:', error)
        });
    }
  }

  private handleSubmitError(error: any): void {
    console.error('Update error:', error);

    const errorHandlers: { [key: number]: () => string } = {
      400: () => this.extractValidationErrors(error.error),
      401: () => 'No autenticado. Por favor inicia sesión nuevamente.',
      403: () => 'No tienes permiso para editar esta publicación.',
      404: () => 'Publicación no encontrada.',
      500: () => 'Error del servidor. Por favor intenta más tarde.'
    };

    const handler = errorHandlers[error.status];
    this.errorMessage = handler ? handler() : 'Error al actualizar la publicación';
  }

  private extractValidationErrors(errorResponse: any): string {
    if (typeof errorResponse === 'string') return errorResponse;
    if (errorResponse?.message) return errorResponse.message;
    if (Array.isArray(errorResponse?.errors)) {
      return errorResponse.errors.map((e: any) => e.message || e).join('\n');
    }
    return 'Error de validación';
  }

  private redirectWithDelay(url: string, delay: number): void {
    setTimeout(() => {
      this.router.navigate([url]);
    }, delay);
  }

  onCancel(): void {
    if (this.publicationId) {
      this.router.navigate(['/donations', this.publicationId]);
    } else {
      this.router.navigate(['/donations/feed']);
    }
  }
}
