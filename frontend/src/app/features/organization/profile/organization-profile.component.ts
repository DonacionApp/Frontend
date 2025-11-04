import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { OrganizationProfileService, OrganizationProfile, OrganizationActivityLog } from '../../../core/services/organization-profile.service';
import { AuthService, User } from '../../../core/services/auth.service';

@Component({
  selector: 'app-organization-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './organization-profile.component.html',
  styleUrls: ['./organization-profile.component.scss']
})
export class OrganizationProfileComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  activeTab: 'general' | 'security' | 'activity' = 'general';
  profile: OrganizationProfile | null = null;
  activityLog: OrganizationActivityLog[] = [];
  currentUser: User | null = null;
  organizationId: string = '';
  
  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  
  loading = false;
  saving = false;
  successMessage = '';
  errorMessage = '';
  lastUpdate: Date | null = null;
  
  selectedLogo: File | null = null;
  logoPreview: string | null = null;
  selectedCover: File | null = null;
  coverPreview: string | null = null;
  
  // Control de visibilidad de contraseñas
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private profileService: OrganizationProfileService,
    private authService: AuthService
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.currentUser = user;
      if (user?.id) {
        this.organizationId = user.id;
        this.loadProfile();
      }
    });
    
    this.subscribeToProfileChanges();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForms(): void {
    this.profileForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: [{ value: '', disabled: true }],
      phone: ['', [Validators.pattern(/^[0-9\-\+\(\)\s]*$/)]],
      address: [''],
      city: [''],
      state: [''],
      country: [''],
      postalCode: [''],
      website: ['', [Validators.pattern(/^https?:\/\/.+/)]],
      description: ['', [Validators.maxLength(500)]],
      missionStatement: ['', [Validators.maxLength(1000)]],
      legalRepresentative: [''],
      facebookUrl: [''],
      twitterUrl: [''],
      instagramUrl: [''],
      linkedinUrl: ['']
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required, Validators.minLength(6)]],
      newPassword: ['', [Validators.required, Validators.minLength(8), 
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  private passwordMatchValidator(group: FormGroup): { [key: string]: boolean } | null {
    const newPassword = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return newPassword === confirmPassword ? null : { passwordMismatch: true };
  }

  private subscribeToProfileChanges(): void {
    this.profileService.profile$
      .pipe(takeUntil(this.destroy$))
      .subscribe(profile => {
        this.profile = profile;
        if (profile) {
          this.populateForm(profile);
        }
      });

    this.profileService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => this.loading = loading);

    this.profileService.lastUpdate$
      .pipe(takeUntil(this.destroy$))
      .subscribe(lastUpdate => this.lastUpdate = lastUpdate);
  }

  private loadProfile(): void {
    // Usar getMyOrganizationProfile() que llama a /auth/profile
    this.profileService.getMyOrganizationProfile().subscribe({
      next: (profile) => {
        this.populateForm(profile);
      },
      error: (error) => {
        this.errorMessage = 'Error al cargar el perfil. Por favor, intenta de nuevo.';
        console.error('Error loading organization profile:', error);
      }
    });
  }

  /**
   * Poblar el formulario con los datos del perfil de la organización
   * 
   * Campos editables:
   * - name: Nombre de la organización
   * - phone: Teléfono de contacto
   * - address: Dirección física
   * - postalCode: Código postal
   * - website: Sitio web
   * - description: Descripción breve
   * - missionStatement: Declaración de misión
   * - legalRepresentative: Representante legal
   * - facebookUrl, twitterUrl, instagramUrl, linkedinUrl: Redes sociales
   * 
   * Campos de solo lectura (disabled):
   * - email: No se puede cambiar (definido en el registro)
   */
  private populateForm(profile: OrganizationProfile): void {
    this.profileForm.patchValue({
      name: profile.name,
      email: profile.email,
      phone: profile.phone || '',
      address: profile.address || '',
      city: profile.city || '',
      state: profile.state || '',
      country: profile.country || '',
      postalCode: profile.postalCode || '',
      website: profile.website || '',
      description: profile.description || '',
      missionStatement: profile.missionStatement || '',
      legalRepresentative: profile.legalRepresentative || '',
      facebookUrl: profile.socialMedia?.facebook || '',
      twitterUrl: profile.socialMedia?.twitter || '',
      instagramUrl: profile.socialMedia?.instagram || '',
      linkedinUrl: profile.socialMedia?.linkedin || ''
    });

    if (profile.logo) {
      this.logoPreview = profile.logo;
    }
    if (profile.coverImage) {
      this.coverPreview = profile.coverImage;
    }
  }

  private loadActivity(): void {
    // Endpoint de actividad no implementado en el backend
    // El historial de actividad se implementará en el futuro
    this.activityLog = [];
  }

  setActiveTab(tab: 'general' | 'security' | 'activity'): void {
    this.activeTab = tab;
    this.clearMessages();
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      // Validar tipo de archivo
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        this.errorMessage = 'Por favor selecciona una imagen válida (JPG, PNG, GIF, WEBP)';
        input.value = '';
        return;
      }
      
      // Validar tamaño (máximo 1 MB)
      const maxSize = 1048576; // 1 MB
      if (file.size > maxSize) {
        const sizeMB = (file.size / 1048576).toFixed(2);
        this.errorMessage = `La imagen es demasiado grande (${sizeMB} MB). El tamaño máximo permitido es 1 MB.`;
        input.value = '';
        return;
      }
      
      this.selectedLogo = file;
      this.clearMessages();
      
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.logoPreview = e.target?.result as string;
      };
      reader.readAsDataURL(this.selectedLogo);
    }
  }

  onCoverSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      // Validar tipo de archivo
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        this.errorMessage = 'Por favor selecciona una imagen válida (JPG, PNG, GIF, WEBP)';
        input.value = '';
        return;
      }
      
      // Validar tamaño (máximo 1 MB)
      const maxSize = 1048576; // 1 MB
      if (file.size > maxSize) {
        const sizeMB = (file.size / 1048576).toFixed(2);
        this.errorMessage = `La imagen es demasiado grande (${sizeMB} MB). El tamaño máximo permitido es 1 MB.`;
        input.value = '';
        return;
      }
      
      this.selectedCover = file;
      this.clearMessages();
      
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.coverPreview = e.target?.result as string;
      };
      reader.readAsDataURL(this.selectedCover);
    }
  }

  uploadLogo(): void {
    if (!this.selectedLogo || !this.organizationId) return;

    this.saving = true;
    this.clearMessages();
    
    this.profileService.uploadLogo(this.organizationId, this.selectedLogo).subscribe({
      next: (response) => {
        this.successMessage = '✓ Logo actualizado exitosamente';
        this.selectedLogo = null;
        this.saving = false;
        
        // Recargar el perfil completo
        this.loadProfile();
        
        // Limpiar mensaje después de 3 segundos
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'Error al subir el logo. Por favor, intenta de nuevo.';
        this.saving = false;
        console.error('Error uploading logo:', error);
      }
    });
  }

  uploadCover(): void {
    if (!this.selectedCover || !this.organizationId) return;

    this.saving = true;
    this.clearMessages();
    
    this.profileService.uploadCoverImage(this.organizationId, this.selectedCover).subscribe({
      next: (response) => {
        this.successMessage = '✓ Imagen de portada actualizada exitosamente';
        this.selectedCover = null;
        this.saving = false;
        
        // Recargar el perfil completo
        this.loadProfile();
        
        // Limpiar mensaje después de 3 segundos
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'Error al subir la imagen. Por favor, intenta de nuevo.';
        this.saving = false;
        console.error('Error uploading cover:', error);
      }
    });
  }

  onSubmitProfile(): void {
    if (this.profileForm.invalid || !this.organizationId) {
      this.markFormGroupTouched(this.profileForm);
      return;
    }

    this.saving = true;
    this.clearMessages();

    const formValue = this.profileForm.getRawValue();
    const updates = {
      name: formValue.name,
      phone: formValue.phone,
      address: formValue.address,
      city: formValue.city,
      state: formValue.state,
      country: formValue.country,
      postalCode: formValue.postalCode,
      website: formValue.website,
      description: formValue.description,
      missionStatement: formValue.missionStatement,
      legalRepresentative: formValue.legalRepresentative,
      socialMedia: {
        facebook: formValue.facebookUrl,
        twitter: formValue.twitterUrl,
        instagram: formValue.instagramUrl,
        linkedin: formValue.linkedinUrl
      }
    };

    this.profileService.updateOrganizationProfile(this.organizationId, updates).subscribe({
      next: () => {
        this.successMessage = 'Perfil actualizado exitosamente';
        this.saving = false;
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'Error al actualizar el perfil. Por favor, intenta de nuevo.';
        this.saving = false;
        console.error('Error updating profile:', error);
      }
    });
  }

  onSubmitPassword(): void {
    if (this.passwordForm.invalid || !this.organizationId) {
      this.markFormGroupTouched(this.passwordForm);
      return;
    }

    this.saving = true;
    this.clearMessages();

    this.profileService.changePassword(this.organizationId, this.passwordForm.value).subscribe({
      next: () => {
        this.successMessage = 'Contraseña cambiada exitosamente';
        this.passwordForm.reset();
        this.saving = false;
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'Error al cambiar la contraseña. Verifica tu contraseña actual.';
        this.saving = false;
        console.error('Error changing password:', error);
      }
    });
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  private clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }

  getFieldError(fieldName: string, form: FormGroup = this.profileForm): string {
    const field = form.get(fieldName);
    if (field?.touched && field?.errors) {
      if (field.errors['required']) return 'Este campo es requerido';
      if (field.errors['minlength']) return `Mínimo ${field.errors['minlength'].requiredLength} caracteres`;
      if (field.errors['maxlength']) return `Máximo ${field.errors['maxlength'].requiredLength} caracteres`;
      if (field.errors['pattern']) return 'Formato inválido';
      if (field.errors['email']) return 'Email inválido';
    }
    return '';
  }

  getPasswordError(): string {
    if (this.passwordForm.errors?.['passwordMismatch'] && this.passwordForm.get('confirmPassword')?.touched) {
      return 'Las contraseñas no coinciden';
    }
    return '';
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  get initials(): string {
    if (!this.profile?.name) return 'O';
    const names = this.profile.name.split(' ');
    return names.length > 1 
      ? `${names[0][0]}${names[1][0]}`.toUpperCase()
      : names[0].substring(0, 2).toUpperCase();
  }
  
  toggleCurrentPasswordVisibility(): void {
    this.showCurrentPassword = !this.showCurrentPassword;
  }
  
  toggleNewPasswordVisibility(): void {
    this.showNewPassword = !this.showNewPassword;
  }
  
  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }
}
