// ...existing code...
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CountriesService } from '../../../core/services/countries.service';
import { Countris, StatesbyCountrySelect, CitiesByStateSelect } from '../../../shared/model/countries.model';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { OrganizationProfileService, OrganizationProfile, OrganizationActivityLog } from '../../../core/services/organization-profile.service';
import { AuthService, User } from '../../../core/services/auth.service';
import { VerificationService } from '../../../core/services/verification.service';
import { environment } from '../../../../environments/environment';
import { LocationPickerComponent } from '../../../shared/components/location-picker/location-picker.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-organization-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, LocationPickerComponent, SpinnerComponent],
  templateUrl: './organization-profile.component.html',
  styleUrls: ['./organization-profile.component.scss']
})
export class OrganizationProfileComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  activeTab: 'general' | 'security' | 'activity' | 'location' = 'general';
  profile: OrganizationProfile | null = null;

  /**
   * Devuelve el último comentario de rechazo si existe, o null
   */
  get lastRejectionComment(): string | null {
    const comments = this.profile?.commentSupportId;
    if (comments && comments.length > 0) {
      const last = comments[comments.length - 1];
      if (last?.status?.name?.toLowerCase() === 'rechazado') {
        return last.comment || null;
      }
    }
    return null;
  }
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
  // Estados de validación para logo
  logoValidationState: 'idle' | 'validating' | 'valid' | 'error' = 'idle';
  logoValidationError: string = '';
  logoFileSizeMB: string = '';
  
  selectedCover: File | null = null;
  coverPreview: string | null = null;
  // Estados de validación para cover
  coverValidationState: 'idle' | 'validating' | 'valid' | 'error' = 'idle';
  coverValidationError: string = '';
  coverFileSizeMB: string = '';

  showLocationPicker = false;
  selectedLocation: { lat: number; lng: number } | null = null;
  public env = environment;
  selectedDocument: File | null = null;
  documentPreview: string | null = null;
  isUploadingDocument = false;
  verificationState: 'none' | 'uploading' | 'pending' | 'verified' | 'error' = 'none';
  // Estados de validación para documento
  documentValidationState: 'idle' | 'validating' | 'valid' | 'error' = 'idle';
  documentValidationError: string = '';
  documentFileSizeMB: string = '';
  
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  // Select options
  countries: Countris[] = [];
  states: StatesbyCountrySelect[] = [];
  cities: CitiesByStateSelect[] = [];
  loadingCountries = false;
  loadingStates = false;
  loadingCities = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private profileService: OrganizationProfileService,
    private authService: AuthService,
    private verificationService: VerificationService,
    private countriesService: CountriesService
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
    this.checkVerificationStatus();
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(q => {
      const tab = q.get('tab');
      if (tab === 'security' || tab === 'activity' || tab === 'location') {
        this.activeTab = tab as any;
      } else {
        this.activeTab = 'general';
      }
    });
    // Cargar países y setear selects reactivos
    this.loadCountriesAndSetupSelects();
  }

  private loadCountriesAndSetupSelects(): void {
    this.loadingCountries = true;
    this.countriesService.countriesList().subscribe({
      next: (countries) => {
        this.countries = countries;
        this.loadingCountries = false;
        // No seleccionar país aquí, se hará en populateForm cuando el perfil esté cargado
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForms(): void {
    this.profileForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      lastName: [''],
      email: [{ value: '', disabled: true }],
      phone: ['', [Validators.pattern(/^[0-9\-\+\(\)\s]*$/)]],
      address: [''],
      city: [''],
      state: [''],
      country: [''],
      postalCode: [''],
      website: ['', [Validators.pattern(/^https?:\/\/.+/)]],
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
    this.profileService.getMyOrganizationProfile().subscribe({
      next: (profile) => {
        this.populateForm(profile);
        this.checkVerificationStatus();
      },
      error: (error) => {
        this.errorMessage = 'Error al cargar el perfil. Por favor, intenta de nuevo.';
        console.error('Error loading organization profile:', error);
      }
    });
  }

  private populateForm(profile: OrganizationProfile): void {
    this.profileForm.patchValue({
      name: profile.name,
      lastName: profile.lastName || '',
      email: profile.email,
      phone: profile.phone || '',
      address: profile.address || '',
      postalCode: profile.postalCode || '',
      website: profile.website || '',
      missionStatement: profile.missionStatement || '',
      legalRepresentative: profile.legalRepresentative || '',
      facebookUrl: profile.socialMedia?.facebook || '',
      twitterUrl: profile.socialMedia?.twitter || '',
      instagramUrl: profile.socialMedia?.instagram || '',
      linkedinUrl: profile.socialMedia?.linkedin || ''
    });

    // Cargar y seleccionar país, estado y ciudad usando iso2
    const countryIso2 = profile.countryIso2;
    const stateIso2 = profile.stateIso2;
    const cityId = profile.cityId;
    
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

    if (profile.logo) {
      this.logoPreview = profile.logo;
    }
    if (profile.coverImage) {
      this.coverPreview = profile.coverImage;
    }

    // Si el perfil incluye ubicación, precargarla en el selector
    if ((profile as any).location && (profile as any).location.lat && (profile as any).location.lng) {
      this.selectedLocation = {
        lat: (profile as any).location.lat,
        lng: (profile as any).location.lng
      };
    }
  }

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
    this.activityLog = [];
  }

  setActiveTab(tab: 'general' | 'security' | 'activity' | 'location'): void {
    this.activeTab = tab;
    this.clearMessages();
    // Actualizar query param 'tab' para recordar la pestaña seleccionada.
    // No añadimos el parámetro cuando es 'general' para mantener la URL limpia.
    const queryParams: any = {};
    if (tab && tab !== 'general') queryParams.tab = tab;
    this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      // Iniciar validación
      this.logoValidationState = 'validating';
      this.logoValidationError = '';
      this.logoFileSizeMB = '';
      
      // Simular validación asíncrona para mostrar estado
      setTimeout(() => {
        // Validar tipo de archivo
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
          this.logoValidationState = 'error';
          this.logoValidationError = 'Por favor selecciona una imagen válida (JPG, PNG, GIF, WEBP)';
          input.value = '';
          return;
        }
        
        // Validar tamaño (máximo 1 MB)
        const maxSize = 1048576; // 1 MB
        if (file.size > maxSize) {
          const sizeMB = (file.size / 1048576).toFixed(2);
          this.logoValidationState = 'error';
          this.logoValidationError = `La imagen es demasiado grande (${sizeMB} MB). El tamaño máximo permitido es 1 MB.`;
          input.value = '';
          return;
        }
        
        // Archivo válido
        this.logoValidationState = 'valid';
        this.logoFileSizeMB = (file.size / 1048576).toFixed(2);
        this.selectedLogo = file;
        this.clearMessages();
        
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
          this.logoPreview = e.target?.result as string;
        };
        reader.readAsDataURL(this.selectedLogo);
      }, 300);
    }
  }

  onCoverSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      // Iniciar validación
      this.coverValidationState = 'validating';
      this.coverValidationError = '';
      this.coverFileSizeMB = '';
      
      // Simular validación asíncrona para mostrar estado
      setTimeout(() => {
        // Validar tipo de archivo
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
          this.coverValidationState = 'error';
          this.coverValidationError = 'Por favor selecciona una imagen válida (JPG, PNG, GIF, WEBP)';
          input.value = '';
          return;
        }
        
        // Validar tamaño (máximo 1 MB)
        const maxSize = 1048576; // 1 MB
        if (file.size > maxSize) {
          const sizeMB = (file.size / 1048576).toFixed(2);
          this.coverValidationState = 'error';
          this.coverValidationError = `La imagen es demasiado grande (${sizeMB} MB). El tamaño máximo permitido es 1 MB.`;
          input.value = '';
          return;
        }
        
        // Archivo válido
        this.coverValidationState = 'valid';
        this.coverFileSizeMB = (file.size / 1048576).toFixed(2);
        this.selectedCover = file;
        this.clearMessages();
        
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
          this.coverPreview = e.target?.result as string;
        };
        reader.readAsDataURL(this.selectedCover);
      }, 300);
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
    
    // Para organizaciones, enviar descripción y networks como JSON en lastName
    const description = formValue.lastName || '';
    const networks: string[] = [];
    if (formValue.website) {
      networks.push(formValue.website);
    }
    // Agregar otras redes sociales si existen
    if (formValue.facebookUrl) networks.push(formValue.facebookUrl);
    if (formValue.twitterUrl) networks.push(formValue.twitterUrl);
    if (formValue.instagramUrl) networks.push(formValue.instagramUrl);
    if (formValue.linkedinUrl) networks.push(formValue.linkedinUrl);
    
    const lastNameJson = JSON.stringify({ description, networks });
    
    // Obtener el nombre de la ciudad desde el array de ciudades usando el ID
    let cityName = '';
    if (formValue.city) {
      const cityId = typeof formValue.city === 'number' ? formValue.city : parseInt(formValue.city, 10);
      const selectedCity = this.cities.find(c => c.id === cityId);
      if (selectedCity && selectedCity.name) {
        cityName = selectedCity.name;
      }
    }
    
    const updates = {
      name: formValue.name,
      phone: formValue.phone,
      address: formValue.address,
      city: cityName, // Enviar nombre de la ciudad, no el ID
      state: formValue.state,
      country: formValue.country,
      postalCode: formValue.postalCode,
      website: formValue.website,
      missionStatement: formValue.missionStatement,
      legalRepresentative: formValue.legalRepresentative,
      description: description, // También enviar description directamente
      lastName: lastNameJson, // Enviar JSON en lastName para el backend
      socialMedia: {
        facebook: formValue.facebookUrl,
        twitter: formValue.twitterUrl,
        instagram: formValue.instagramUrl,
        linkedin: formValue.linkedinUrl
      }
    };

    // Nota: la ubicación la gestiona el LocationPicker (se envía directamente
    // desde allí). No añadimos `location` aquí para evitar duplicidad.

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

  // Helper booleans para evitar comparaciones literales en templates (mejora compatibilidad con el type-checker)
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

  // ============ MÉTODOS DEL SELECTOR DE UBICACIÓN ============

  openLocationPicker(): void {
    this.showLocationPicker = true;
  }
  
  onLocationSaved(loc: { lat: number; lng: number }): void {
    this.selectedLocation = loc;
    this.showLocationPicker = false;
  }

  /** Handler específico cuando el picker está renderizado inline en la pestaña Ubicación */
  onLocationSavedInline(loc: { lat: number; lng: number }): void {
    this.selectedLocation = loc;
    // Recargar el perfil para sincronizar cualquier cambio retornado por backend
    this.loadProfile();
  }

  /** Getter que unifica la ubicación a mostrar (seleccionada por el usuario o la del perfil) */
  get displayLocation(): { lat: number; lng: number } | null {
    return this.selectedLocation || ((this.profile as any)?.location ?? null);
  }

  /** Coordenadas formateadas para mostrar en la plantilla */
  get displayLocationString(): string {
    const d = this.displayLocation;
    return d ? `${d.lat.toFixed(6)}, ${d.lng.toFixed(6)}` : '';
  }

  /**
   * Obtener la URL de la imagen estática de Google Maps para previsualizar la ubicación
   */
  getStaticMapUrl(loc: { lat: number; lng: number } | null | undefined): string {
    if (!loc) return '';
    const lat = loc.lat;
    const lng = loc.lng;
    const size = '600x300';
    const zoom = 14;
    const marker = `color:red%7C${lat},${lng}`;
    const key = encodeURIComponent(this.env.apiKeyGoogleMaps || '');
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&markers=${marker}&key=${key}`;
  }

  /**
   * Eliminar la ubicación del perfil (setear null en backend)
   */
  removeLocation(): void {
    if (!this.organizationId) return;
    const updates: any = { location: null };
    this.saving = true;
    this.clearMessages();
    this.profileService.updateOrganizationProfile(this.organizationId, updates).subscribe({
      next: () => {
        this.successMessage = 'Ubicación eliminada correctamente';
        this.selectedLocation = null;
        this.saving = false;
        // Recargar perfil para sincronizar el estado
        this.loadProfile();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'No se pudo eliminar la ubicación';
        this.saving = false;
        console.error('Error removing location:', err);
      }
    });
  }

  cancelLocationPicker(): void {
    // Cerrar sin guardar
    this.showLocationPicker = false;
  }

  // ============ MÉTODOS DE VERIFICACIÓN DE DOCUMENTO ============

  /**
   * Verificar el estado de verificación de la organización
   */
  checkVerificationStatus(): void {
    const user = this.authService.currentUserValue;
    const userVerified = user?.isDocumentVerified || false;
    const profileVerified = this.profile?.isVerified || false;
    const supportId = this.profile?.supportId;
    const commentSupportId = this.profile?.commentSupportId || [];

    if (userVerified || profileVerified) {
      this.verificationState = 'verified';
    } else if (supportId && commentSupportId.length > 0) {
      // Si hay comentarios de rechazo
      const lastComment = commentSupportId[commentSupportId.length - 1];
      if (lastComment.status?.name?.toLowerCase() === 'rechazado' || lastComment.status?.name?.toLowerCase() === 'rejected') {
        this.verificationState = 'error';
      } else {
        this.verificationState = 'pending';
      }
    } else if (supportId && commentSupportId.length === 0) {
      this.verificationState = 'pending';
    } else {
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
  // Algunos responses no tipados pueden incluir isVerified; proteger con any
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
}
