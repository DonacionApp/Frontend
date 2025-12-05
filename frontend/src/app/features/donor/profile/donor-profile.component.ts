import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { UserProfileService, UserProfile, ActivityLog } from '../../../core/services/user-profile.service';
import { AuthService } from '../../../core/services/auth.service';
import { VerificationService } from '../../../core/services/verification.service';
import { CountriesService } from '../../../core/services/countries.service';
import { Countris, StatesbyCountrySelect, CitiesByStateSelect } from '../../../shared/model/countries.model';

@Component({
  selector: 'app-donor-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
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
  // Estados de validación para foto de perfil
  imageValidationState: 'idle' | 'validating' | 'valid' | 'error' = 'idle';
  imageValidationError: string = '';
  imageFileSizeMB: string = '';
  
  // Verificación de documento
  selectedDocument: File | null = null;
  documentPreview: string | null = null;
  isUploadingDocument = false;
  // Estado de verificación: 'none' | 'uploading' | 'pending' | 'verified' | 'error'
  verificationState: 'none' | 'uploading' | 'pending' | 'verified' | 'error' = 'none';
  // Estados de validación para documento
  documentValidationState: 'idle' | 'validating' | 'valid' | 'error' = 'idle';
  documentValidationError: string = '';
  documentFileSizeMB: string = '';
  
  // Control de visibilidad de contraseñas
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  // Select options para países, estados y ciudades
  countries: Countris[] = [];
  states: StatesbyCountrySelect[] = [];
  cities: CitiesByStateSelect[] = [];
  loadingCountries = false;
  loadingStates = false;
  loadingCities = false;

  constructor(
    private fb: FormBuilder,
    private profileService: UserProfileService,
    private authService: AuthService,
    private verificationService: VerificationService,
    private countriesService: CountriesService
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.loadProfile();
    this.subscribeToProfileChanges();
    this.checkVerificationStatus();
    this.loadCountriesAndSetupSelects();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForms(): void {
    this.profileForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      lastName: [''],
      email: [{ value: '', disabled: true }],
      telefono: ['', [Validators.pattern(/^[0-9\-\+\(\)\s]*$/)]],
      residencia: [''],
      city: [''],
      state: [''],
      country: [''],
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
        // Perfil cargado exitosamente
        // Actualizar estado de verificación después de cargar el perfil
        this.checkVerificationStatus();
      },
      error: (error) => {
        this.errorMessage = 'Error al cargar el perfil. Por favor, intenta de nuevo.';
        console.error('Error loading profile:', error);
      }
    });
  }

  /**
   * Poblar el formulario con los datos del perfil
   * 
   * Campos editables:
   * - name: Nombre completo del usuario
   * - telefono: Teléfono de contacto
  * - dni: Número de identificación
   * - residencia: Dirección de residencia
   * - birdthDate: Fecha de nacimiento
   * 
   * Campos de solo lectura (disabled):
   * - email: No se puede cambiar (definido en el registro)
  * - typeDni: Tipo de identificación (definido en el registro)
   * - city, state, country: Ubicación geográfica (definida en el registro)
   */
  private populateForm(profile: UserProfile): void {
    this.profileForm.patchValue({
      name: profile.name,
      lastName: profile.lastName || '',
      email: profile.email,
      telefono: profile.phone || '',
      residencia: profile.address || '',
      dni: profile.dni || '',
      typeDni: profile.typeDni || '',
      birdthDate: profile.dateOfBirth || ''
    });

    // Cargar y seleccionar país, estado y ciudad usando iso2
    // Obtener los valores del perfil (pueden venir como nombres o iso2)
    const countryIso2 = (profile as any).countryIso2 || this.getCountryIso2FromName(profile.country || '');
    const stateIso2 = (profile as any).stateIso2 || this.getStateIso2FromName(profile.state || '');
    const cityId = (profile as any).cityId || this.getCityIdFromName(profile.city || '');
    
    if (countryIso2) {
      // Establecer el país usando iso2
      this.profileForm.get('country')?.setValue(countryIso2, { emitEvent: false });
      
      // Cargar estados para el país
      this.onCountryChange(countryIso2, false).then(() => {
        // Una vez cargados los estados, seleccionar el estado si existe
        if (stateIso2) {
          this.profileForm.get('state')?.setValue(stateIso2, { emitEvent: false });
          
          // Cargar ciudades para el estado
          this.onStateChange(countryIso2, stateIso2, false).then(() => {
            // Una vez cargadas las ciudades, seleccionar la ciudad si existe
            if (cityId) {
              this.profileForm.get('city')?.setValue(cityId, { emitEvent: false });
            }
          }).catch(() => {
            // Ignorar errores al cargar ciudades
          });
        }
      }).catch(() => {
        // Ignorar errores al cargar estados
      });
    }

    if (profile.profileImage) {
      this.imagePreview = profile.profileImage;
    }
  }

  

  /**
   * Comprueba si el perfil tiene un valor no vacío para la ruta indicada.
   * Soporta rutas con punto para propiedades anidadas
   */
  profileHas(path: string): boolean {
    if (!this.profile) return false;
    const parts = path.split('.');
    let cur: any = this.profile as any;
    for (const p of parts) {
      if (cur == null) return false;
      cur = cur[p];
    }
    return cur !== null && cur !== undefined && cur !== '';
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

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      // Iniciar validación
      this.imageValidationState = 'validating';
      this.imageValidationError = '';
      this.imageFileSizeMB = '';
      
      // Simular validación asíncrona para mostrar estado
      setTimeout(() => {
        // Validar tipo de archivo
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
          this.imageValidationState = 'error';
          this.imageValidationError = 'Por favor selecciona una imagen válida (JPG, PNG, GIF, WEBP)';
          this.selectedFile = null;
          input.value = '';
          return;
        }
        
        // Validar tamaño (máximo 1 MB = 1048576 bytes)
        const maxSize = 1048576; // 1 MB
        if (file.size > maxSize) {
          const sizeMB = (file.size / 1048576).toFixed(2);
          this.imageValidationState = 'error';
          this.imageValidationError = `La imagen es demasiado grande (${sizeMB} MB). El tamaño máximo permitido es 1 MB. Por favor, comprime la imagen o selecciona una más pequeña.`;
          this.selectedFile = null;
          input.value = '';
          return;
        }
        
        // Archivo válido
        this.imageValidationState = 'valid';
        this.imageFileSizeMB = (file.size / 1048576).toFixed(2);
        this.selectedFile = file;
        this.clearMessages();
        
        // Preview de la imagen
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
          this.imagePreview = e.target?.result as string;
        };
        reader.readAsDataURL(this.selectedFile);
      }, 300);
    }
  }

  uploadImage(): void {
    if (!this.selectedFile) return;

    this.saving = true;
    this.clearMessages();
    
    this.profileService.uploadProfileImage(this.selectedFile).subscribe({
      next: () => {
        this.successMessage = 'Imagen de perfil actualizada exitosamente';
        this.selectedFile = null;
        this.saving = false;
      },
      error: (error) => {
        // Extraer mensaje específico del error
        let errorMsg = 'Error al subir la imagen. Por favor, intenta de nuevo.';
        
        if (error.error?.message) {
          errorMsg = error.error.message;
        } else if (error.status === 400) {
          errorMsg = 'Archivo inválido. Asegúrate de que sea una imagen de menos de 1 MB.';
        } else if (error.status === 401) {
          errorMsg = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
        }
        
        this.errorMessage = errorMsg;
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
    
    // Construir el objeto en el formato que espera el backend
    const updates: any = {
      people: {}
    };

    // Solo agregar campos que tengan valor Y que hayan cambiado
    if (formValues.name && formValues.name !== this.profile?.name) {
      updates.people.name = formValues.name;
    }
    if (formValues.lastName && formValues.lastName !== this.profile?.lastName) {
      updates.people.lastName = formValues.lastName;
    }
    if (formValues.telefono && formValues.telefono !== this.profile?.phone) {
      updates.people.telefono = formValues.telefono;
    }
    if (formValues.residencia && formValues.residencia !== this.profile?.address) {
      updates.people.residencia = formValues.residencia;
    }
    if (formValues.birdthDate && formValues.birdthDate !== this.profile?.dateOfBirth) {
      updates.people.birdthDate = formValues.birdthDate;
    }
    // NO enviar DNI a menos que realmente haya cambiado
    // (generalmente el DNI no debería cambiar)
    if (formValues.dni && formValues.dni !== this.profile?.dni) {
      updates.people.dni = formValues.dni;
    }

    // Manejar municipio (ciudad, estado, país) si alguno ha cambiado
    // IMPORTANTE: Si se modifica algo dentro de municipio, se debe enviar TODO el campo completo
    const currentCountryIso2 = (this.profile as any)?.countryIso2 || this.getCountryIso2FromName(this.profile?.country || '');
    const currentStateIso2 = (this.profile as any)?.stateIso2 || this.getStateIso2FromName(this.profile?.state || '');
    const currentCityName = this.profile?.city || '';
    
    const newCountryIso2 = formValues.country || currentCountryIso2;
    const newStateIso2 = formValues.state || currentStateIso2;
    
    // Obtener el nombre de la ciudad desde el array de ciudades usando el ID
    let newCityName = currentCityName;
    if (formValues.city) {
      const cityId = typeof formValues.city === 'number' ? formValues.city : parseInt(formValues.city, 10);
      const selectedCity = this.cities.find(c => c.id === cityId);
      if (selectedCity && selectedCity.name) {
        newCityName = selectedCity.name;
      }
    }
    
    // Verificar si alguno cambió
    if (newCountryIso2 !== currentCountryIso2 || 
        newStateIso2 !== currentStateIso2 || 
        newCityName !== currentCityName) {
      
      // Construir el objeto municipio completo según formato del backend
      updates.people.municipio = {
        pais: {
          iso2: newCountryIso2 || ''
        },
        state: {
          iso2: newStateIso2 || ''
        },
        city: {
          name: newCityName || ''
        }
      };
    }

    // Si people está vacío, no hay nada que actualizar
    if (Object.keys(updates.people).length === 0) {
      this.successMessage = 'No hay cambios que guardar';
      this.saving = false;
      return;
    }

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

  // Helper booleans para evitar comparaciones literales en templates
  isVerificationNoneOrError(): boolean {
    return this.verificationState === 'none' || this.verificationState === 'error';
  }

  isVerificationUploading(): boolean {
    return this.verificationState === 'uploading';
  }

  isVerificationPending(): boolean {
    return this.verificationState === 'pending';
  }

  isVerificationVerified(): boolean {
    return this.verificationState === 'verified';
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

  // ============ MÉTODOS DE VERIFICACIÓN DE DOCUMENTO ============

  /**
   * Verificar el estado de verificación del usuario
   */
  checkVerificationStatus(): void {
    const user = this.authService.currentUserValue;
    const userVerified = user?.isDocumentVerified || false;
    const profileVerified = this.profile?.isVerified || false;

    // Si está verificado, mostrar como verificado
    if (userVerified || profileVerified) {
      this.verificationState = 'verified';
      return;
    }

    // Si tiene supportId (documento subido, puede ser string o number)
    let supportId = (this.profile as any)?.supportId;
    if (!supportId && (this.profile as any)?.people) {
      supportId = (this.profile as any).people.supportId;
    }
    // Considerar supportId válido si es string no vacío o number distinto de null
    const hasSupportId = (typeof supportId === 'string' && supportId.trim() !== '') || (typeof supportId === 'number' && supportId !== null);
    const comments = this.profile?.commentSupportId || [];
    const rejectedComment = comments.find(c => c.status?.name?.toLowerCase() === 'rechazado');

    if (hasSupportId) {
      if (rejectedComment) {
        // Documento rechazado, mostrar comentario y permitir subir de nuevo
        this.verificationState = 'error';
        this.errorMessage = rejectedComment.comment || 'Documento rechazado. Por favor, revisa el motivo y vuelve a subirlo.';
      } else if (comments.length === 0) {
        // Documento subido pero sin comentarios, está pendiente
        this.verificationState = 'pending';
      } else {
        // Si hay comentarios pero ninguno rechazado, considerar pendiente
        this.verificationState = 'pending';
      }
    } else {
      // No ha subido documento
      this.verificationState = 'none';
    }
  }

  /**
   * Manejar la selección de documento para verificación
   */
  onDocumentSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      // Iniciar validación
      this.documentValidationState = 'validating';
      this.documentValidationError = '';
      this.documentFileSizeMB = '';
      
      // Simular validación asíncrona para mostrar estado
      setTimeout(() => {
        // Validar el archivo usando el servicio
        const validation = this.verificationService.validateFile(file);
        
        if (!validation.valid) {
          this.documentValidationState = 'error';
          this.documentValidationError = validation.error || 'Archivo inválido';
          this.selectedDocument = null;
          this.documentPreview = null;
          input.value = '';
          return;
        }
        
        // Archivo válido
        this.documentValidationState = 'valid';
        this.documentFileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        this.selectedDocument = file;
        this.clearMessages();
        this.verificationState = 'none';
        
        // Preview del documento (solo para imágenes)
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e: ProgressEvent<FileReader>) => {
            this.documentPreview = e.target?.result as string;
          };
          reader.readAsDataURL(file);
        } else {
          // Para PDFs, mostrar icono genérico
          this.documentPreview = 'pdf';
        }
      }, 300);
    }
  }

  /**
   * Subir documento de verificación
   */
  uploadDocument(): void {
    if (!this.selectedDocument) {
      this.errorMessage = 'Por favor selecciona un documento primero';
      return;
    }

    this.isUploadingDocument = true;
    this.verificationState = 'uploading';
    this.clearMessages();
    
    this.verificationService.uploadSupportDocument(this.selectedDocument).subscribe({
      next: (response) => {
        // Backend puede devolver un mensaje y/o un flag indicando verificación inmediata
        const msg = response?.message || 'Documento subido correctamente';
        const isVerified = (response as any)?.isVerified === true;

        if (isVerified) {
          this.verificationState = 'verified';
          this.successMessage = msg || '¡Documento verificado!';
        } else {
          // Caso más probable: queda pendiente de revisión
          this.verificationState = 'pending';
          this.successMessage = msg || 'Documento subido. Pendiente de revisión.';
        }

        this.selectedDocument = null;
        this.documentPreview = null;
        this.isUploadingDocument = false;
        
        // Recargar perfil para obtener estado actualizado desde el backend
        this.loadProfile();
      },
      error: (error) => {
        this.isUploadingDocument = false;
        this.verificationState = 'error';
        const status = error.status;
        const message = error.error?.message;
        
        this.errorMessage = this.verificationService.getErrorMessage(status, message);
      }
    });
  }

  // ============ MÉTODOS PARA CARGAR PAÍSES, ESTADOS Y CIUDADES ============

  private loadCountriesAndSetupSelects(): void {
    this.loadingCountries = true;
    this.countriesService.countriesList().subscribe({
      next: (countries) => {
        this.countries = countries;
        this.loadingCountries = false;
      },
      error: () => { this.loadingCountries = false; }
    });

    // Reactividad: cuando cambia país
    this.profileForm.get('country')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(iso2 => {
      if (iso2) this.onCountryChange(iso2, true);
    });
    // Cuando cambia estado
    this.profileForm.get('state')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(iso2 => {
      const countryIso2 = this.profileForm.get('country')?.value;
      if (countryIso2 && iso2) this.onStateChange(countryIso2, iso2, true);
    });
  }

  private onCountryChange(countryIso2: string, clearStateCity = true): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!countryIso2) {
        resolve();
        return;
      }
      
      this.loadingStates = true;
      this.countriesService.statesByCountry(countryIso2).subscribe({
        next: (states) => {
          this.states = states;
          this.loadingStates = false;
          if (clearStateCity) {
            this.profileForm.get('state')?.setValue('', { emitEvent: false });
            this.cities = [];
            this.profileForm.get('city')?.setValue('', { emitEvent: false });
          }
          resolve();
        },
        error: (err) => { 
          this.loadingStates = false;
          console.error('Error loading states:', err);
          reject(err);
        }
      });
    });
  }

  private onStateChange(countryIso2: string, stateIso2: string, clearCity = true): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!countryIso2 || !stateIso2) {
        resolve();
        return;
      }
      
      this.loadingCities = true;
      this.countriesService.citiesByState(countryIso2, stateIso2).subscribe({
        next: (cities) => {
          this.cities = cities;
          this.loadingCities = false;
          if (clearCity) {
            this.profileForm.get('city')?.setValue('', { emitEvent: false });
          }
          resolve();
        },
        error: (err) => { 
          this.loadingCities = false;
          console.error('Error loading cities:', err);
          reject(err);
        }
      });
    });
  }

  // Helper methods para obtener iso2/ID desde nombres (fallback si no vienen en el perfil)
  private getCountryIso2FromName(countryName: string): string {
    if (!countryName) return '';
    const country = this.countries.find(c => c.name === countryName);
    return country?.iso2 || '';
  }

  private getStateIso2FromName(stateName: string): string {
    if (!stateName) return '';
    const state = this.states.find(s => s.name === stateName);
    return state?.iso2 || '';
  }

  private getCityIdFromName(cityName: string): number | null {
    if (!cityName) return null;
    const city = this.cities.find(c => c.name === cityName);
    return city?.id || null;
  }
}
