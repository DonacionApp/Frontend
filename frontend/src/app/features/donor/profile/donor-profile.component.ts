import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { UserProfileService, UserProfile, ActivityLog } from '../../../core/services/user-profile.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-donor-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './donor-profile.component.html',
  styleUrls: ['./donor-profile.component.scss']
})
export class DonorProfileComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  activeTab: 'general' | 'security' | 'activity' = 'general';
  profile: UserProfile | null = null;
  activityLog: ActivityLog[] = [];
  
  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  
  loading = false;
  saving = false;
  successMessage = '';
  errorMessage = '';
  lastUpdate: Date | null = null;
  
  selectedFile: File | null = null;
  imagePreview: string | null = null;

  constructor(
    private fb: FormBuilder,
    private profileService: UserProfileService,
    private authService: AuthService
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.loadProfile();
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
      telefono: ['', [Validators.pattern(/^[0-9\-\+\(\)\s]*$/)]],
      residencia: [''],
      city: [{ value: '', disabled: true }],
      state: [{ value: '', disabled: true }],
      country: [{ value: '', disabled: true }],
      dni: [''],
      typeDni: [{ value: '', disabled: true }],
      birdthDate: ['']
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
    this.profileService.getMyProfile().subscribe({
      next: () => {
        if (this.activeTab === 'activity') {
          this.loadActivity();
        }
      },
      error: (error) => {
        this.errorMessage = 'Error al cargar el perfil. Por favor, intenta de nuevo.';
        console.error('Error loading profile:', error);
      }
    });
  }

  private populateForm(profile: UserProfile): void {
    this.profileForm.patchValue({
      name: profile.name,
      email: profile.email,
      telefono: profile.phone || '',
      residencia: profile.address || '',
      city: profile.city || '',
      state: profile.state || '',
      country: profile.country || '',
      dni: profile.dni || '',
      typeDni: profile.typeDni || '',
      birdthDate: profile.dateOfBirth || ''
    });

    if (profile.profileImage) {
      this.imagePreview = profile.profileImage;
    }
  }

  private loadActivity(): void {
    this.profileService.getActivityLog().subscribe({
      next: (logs) => {
        this.activityLog = logs;
      },
      error: (error) => {
        console.error('Error loading activity:', error);
        this.activityLog = [];
      }
    });
  }

  setActiveTab(tab: 'general' | 'security' | 'activity'): void {
    this.activeTab = tab;
    this.clearMessages();
    
    if (tab === 'activity' && this.activityLog.length === 0) {
      this.loadActivity();
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedFile = input.files[0];
      
      // Preview de la imagen
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.imagePreview = e.target?.result as string;
      };
      reader.readAsDataURL(this.selectedFile);
    }
  }

  uploadImage(): void {
    if (!this.selectedFile) return;

    this.saving = true;
    this.profileService.uploadProfileImage(this.selectedFile).subscribe({
      next: () => {
        this.successMessage = 'Imagen de perfil actualizada exitosamente';
        this.selectedFile = null;
        this.saving = false;
      },
      error: (error) => {
        this.errorMessage = 'Error al subir la imagen. Por favor, intenta de nuevo.';
        this.saving = false;
        console.error('Error uploading image:', error);
      }
    });
  }

  onSubmitProfile(): void {
    if (this.profileForm.invalid) {
      this.markFormGroupTouched(this.profileForm);
      return;
    }

    this.saving = true;
    this.clearMessages();

    const formValues = this.profileForm.getRawValue();
    const updates = {
      name: formValues.name,
      telefono: formValues.telefono,
      residencia: formValues.residencia,
      birdthDate: formValues.birdthDate,
      dni: formValues.dni
    };

    this.profileService.updateProfile(updates).subscribe({
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
    if (this.passwordForm.invalid) {
      this.markFormGroupTouched(this.passwordForm);
      return;
    }

    this.saving = true;
    this.clearMessages();

    this.profileService.changePassword(this.passwordForm.value).subscribe({
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
    if (!this.profile?.name) return 'U';
    const names = this.profile.name.split(' ');
    return names.length > 1 
      ? `${names[0][0]}${names[1][0]}`.toUpperCase()
      : names[0].substring(0, 2).toUpperCase();
  }
}
