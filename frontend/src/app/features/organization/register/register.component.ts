import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators, FormsModule } from '@angular/forms';
import { OrganizationRegistrationService } from '../../../core/services';
import { RegistrationStateService } from '../../../core/services/registration-state.service';
import { AuthService } from '../../../core/services/auth.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TermsModalComponent } from '../../../shared/components/terms-modal/terms-modal.component';
import { PrivacyPolicyModalComponent } from '../../../shared/components/privacy-policy-modal/privacy-policy-modal.component';
import { RegistrationTypeSelectorComponent } from '../../../shared/components/registration-type-selector/registration-type-selector.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { throwError } from 'rxjs';
import { finalize } from 'rxjs/operators';


@Component({
  selector: 'app-organization-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, MatDialogModule, RegistrationTypeSelectorComponent, ButtonComponent, FooterComponent],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class OrganizationRegisterComponent implements OnInit {
  step = 1;
  orgForm: any;

  countries: Array<any> = [];
  states: Array<any> = [];
  cities: Array<any> = [];

  // Se removió el manejo de archivos; el registro enviará siempre JSON al backend

  isSubmitting = false;
  message: string | null = null;
  success = false;

  // Variables para mostrar/ocultar contraseñas
  showPassword = false;
  showConfirmPassword = false;

  constructor(
    private fb: FormBuilder,
    private regService: OrganizationRegistrationService,
    private authService: AuthService,
    private router: Router,
    private state: RegistrationStateService,
    private dialog: MatDialog
  ) {
    // Inicializar formulario en el constructor para evitar usar this.fb antes de la inicialización
    this.orgForm = this.fb.group({
      organizationName: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      description: ['', [Validators.required, Validators.minLength(10)]], // Descripción requerida
      countryIso: [''],
      stateIso: [''],
      cityName: [''],
      address: ['', [Validators.required, Validators.maxLength(50)]],
      phone: ['', [Validators.required, Validators.maxLength(20)]],
      // Fecha de creación/constitución de la organización (el backend espera birdthDate)
      birdthDate: ['', Validators.required],
      tipodDni: [1, Validators.required],
      dni: ['', Validators.maxLength(20)],
      // Términos y Políticas
      acceptTerms: [false, [Validators.requiredTrue]],
      acceptPrivacyPolicy: [false, [Validators.requiredTrue]]
    });
  }

  private formatDateToDdMmYyyy(dateStr: string | null | undefined): string {
    if (!dateStr || dateStr.trim() === '') return '';
    // dateStr expected in 'YYYY-MM-DD' from <input type="date">; convert to 'DD-MM-YYYY'
    const parts = dateStr.split('-');
    if (parts.length !== 3) {
      console.warn('Invalid date format:', dateStr);
      return '';
    }
    const [y, m, d] = parts;
    // Validar que sean números válidos
    if (isNaN(Number(y)) || isNaN(Number(m)) || isNaN(Number(d))) {
      console.warn('Invalid date values:', { y, m, d });
      return '';
    }
    // Asegurar formato DD-MM-YYYY con ceros a la izquierda si es necesario
    const day = d.padStart(2, '0');
    const month = m.padStart(2, '0');
    return `${day}-${month}-${y}`;
  }

  goToDonorRegister(): void {
    try {
      // Limpiar el formulario antes de navegar
      if (this.orgForm) {
        this.orgForm.reset();
        // Restablecer valores por defecto
        this.orgForm.patchValue({
          tipodDni: 1,
          acceptTerms: false,
          acceptPrivacyPolicy: false
        });
      }
      // Limpiar mensajes y estados
      this.message = null;
      this.success = false;
      this.isSubmitting = false;
      // Resetear paso del formulario
      this.step = 1;
      // Limpiar opciones de ubicación
      this.states = [];
      this.cities = [];
      // Deshabilitar campos de ubicación
      this.orgForm.get('stateIso')?.disable();
      this.orgForm.get('cityName')?.disable();
      // Limpiar estado del servicio si está disponible
      if (this.state) {
        this.state.clearMessages();
        this.state.resetForm();
      }
      // Navegar
      this.router.navigate(['/register/donor']);
    } catch (err) {
      console.warn('Navigation to donor register failed', err);
    }
  }

  ngOnInit(): void {
    // Limpiar estados previos al inicializar
    this.message = null;
    this.success = false;
    this.isSubmitting = false;
    this.step = 1;
    this.states = [];
    this.cities = [];
    // Limpiar formulario si ya existe
    if (this.orgForm) {
      this.orgForm.reset();
      this.orgForm.patchValue({
        tipodDni: 1,
        acceptTerms: false,
        acceptPrivacyPolicy: false
      });
      // Deshabilitar campos de estado y ciudad inicialmente
      this.orgForm.get('stateIso')?.disable();
      this.orgForm.get('cityName')?.disable();
    }
    // Limpiar estado del servicio si está disponible
    if (this.state) {
      this.state.clearMessages();
    }
    this.loadCountries();
  }

  loadCountries(): void {
    this.regService.getCountries().subscribe({
      next: (res: any[]) => this.countries = res || [],
      error: () => this.countries = []
    });
  }

  onCountryChange(iso: string): void {
    this.orgForm.patchValue({ countryIso: iso, stateIso: '', cityName: '' });
    if (iso) {
      this.regService.getStates(iso).subscribe({ 
        next: (s: any[]) => {
          this.states = s || [];
          // Habilitar campo de estado si hay estados disponibles
          if (this.states.length > 0) {
            this.orgForm.get('stateIso')?.enable();
          } else {
            this.orgForm.get('stateIso')?.disable();
          }
        }, 
        error: () => {
          this.states = [];
          this.orgForm.get('stateIso')?.disable();
        }
      });
      // Deshabilitar ciudad hasta que se seleccione un estado
      this.orgForm.get('cityName')?.disable();
      this.cities = [];
    } else {
      this.states = [];
      this.cities = [];
      this.orgForm.get('stateIso')?.disable();
      this.orgForm.get('cityName')?.disable();
    }
  }

  onStateChange(isoState: string): void {
    const isoCountry = this.orgForm.value.countryIso;
    this.orgForm.patchValue({ stateIso: isoState, cityName: '' });
    if (isoCountry && isoState) {
      this.regService.getCities(isoCountry, isoState).subscribe({ 
        next: (c: any[]) => {
          this.cities = c || [];
          // Habilitar campo de ciudad si hay ciudades disponibles
          if (this.cities.length > 0) {
            this.orgForm.get('cityName')?.enable();
          } else {
            this.orgForm.get('cityName')?.disable();
          }
        }, 
        error: () => {
          this.cities = [];
          this.orgForm.get('cityName')?.disable();
        }
      });
    } else {
      this.cities = [];
      this.orgForm.get('cityName')?.disable();
    }
  }

  // Removed file upload handlers: onFilesSelected, validateFile, removeFile

  canProceed(): boolean {
    if (this.step === 1) {
      const password = this.orgForm.get('password')?.value;
      const confirmPassword = this.orgForm.get('confirmPassword')?.value;
      const passwordsMatch = password === confirmPassword && password !== '';
      
      return !!(this.orgForm.get('organizationName')?.valid && 
                this.orgForm.get('email')?.valid && 
                this.orgForm.get('password')?.valid && 
                this.orgForm.get('confirmPassword')?.valid &&
                this.orgForm.get('description')?.valid &&
                this.orgForm.get('birdthDate')?.valid &&
                passwordsMatch);
    }
    if (this.step === 2) {
      return !!(this.orgForm.get('countryIso')?.value && 
                this.orgForm.get('stateIso')?.value && 
                this.orgForm.get('cityName')?.value && 
                this.orgForm.get('address')?.valid);
    }
    return true;
  }

  next(): void {
    // Marcar todos los campos del paso actual como touched para mostrar errores
    if (this.step === 1) {
      this.orgForm.get('organizationName')?.markAsTouched();
      this.orgForm.get('email')?.markAsTouched();
      this.orgForm.get('password')?.markAsTouched();
      this.orgForm.get('confirmPassword')?.markAsTouched();
      this.orgForm.get('description')?.markAsTouched();
      this.orgForm.get('birdthDate')?.markAsTouched();
    }
    if (this.step === 2) {
      this.orgForm.get('countryIso')?.markAsTouched();
      this.orgForm.get('stateIso')?.markAsTouched();
      this.orgForm.get('cityName')?.markAsTouched();
      this.orgForm.get('address')?.markAsTouched();
    }
    
    if (this.canProceed()) {
      this.step++;
    }
  }

  prev(): void {
    if (this.step > 1) this.step--;
  }

  onSubmit(): void {
    if (this.isSubmitting) return;

    // Validar que se acepten los términos y condiciones
    if (!this.orgForm.value.acceptTerms) {
      this.message = 'Debes aceptar los términos y condiciones para continuar';
      this.success = false;
      this.orgForm.get('acceptTerms')?.markAsTouched();
      return;
    }

    // Validar que se acepte la política de privacidad
    if (!this.orgForm.value.acceptPrivacyPolicy) {
      this.message = 'Debes aceptar la política de privacidad para continuar';
      this.success = false;
      this.orgForm.get('acceptPrivacyPolicy')?.markAsTouched();
      return;
    }

    // Basic password confirm
    if (this.orgForm.value.password !== this.orgForm.value.confirmPassword) {
      this.message = 'Las contraseñas no coinciden';
      this.success = false;
      return;
    }

    // Validar fecha de creación/constitución de la organización
    if (!this.orgForm.value.birdthDate) {
      this.message = 'La fecha de creación es obligatoria';
      this.success = false;
      this.orgForm.get('birdthDate')?.markAsTouched();
      return;
    }

    // Validar que la fecha de creación no sea futura
    const selectedDate = new Date(this.orgForm.value.birdthDate);
    const today = new Date();

    if (selectedDate > today) {
      this.message = 'La fecha de creación no puede ser futura';
      this.success = false;
      this.orgForm.get('birdthDate')?.markAsTouched();
      return;
    }

    // Coerce/format fields to match backend expectations
    const tipod = Number(this.orgForm.value.tipodDni) || 1;
    
    // El backend espera el formato ISO (YYYY-MM-DD), igual que el componente de donante
    // El input type="date" ya proporciona la fecha en formato ISO
    const creationDate = this.orgForm.value.birdthDate;
    
    // Validar que tengamos una fecha válida
    if (!creationDate || creationDate === '') {
      this.message = 'La fecha de creación no es válida. Por favor, selecciona una fecha válida.';
      this.success = false;
      this.orgForm.get('birdthDate')?.markAsTouched();
      return;
    }

    const payload = {
      username: this.orgForm.value.organizationName,
      email: this.orgForm.value.email,
      password: this.orgForm.value.password,
      // El backend espera el id de rol para organización. Usamos 3 según el formato del backend.
      rolId: 3,
      profilePhoto: '',
      people: {
        name: this.orgForm.value.organizationName,
        // Serializamos la descripción en lastName para enviarla al backend
        lastName: JSON.stringify({ description: this.orgForm.value.description || '', networks: [] }),
        birdthDate: creationDate || '', // Fecha de creación/constitución de la organización
        tipodDni: tipod,
        dni: this.orgForm.value.dni || '',
        residencia: this.orgForm.value.address,
        telefono: this.orgForm.value.phone,
        supportId: '',
        municipio: {
          pais: { iso2: this.orgForm.value.countryIso },
          state: { iso2: this.orgForm.value.stateIso },
          city: { name: this.orgForm.value.cityName }
        }
      }
    };

    this.isSubmitting = true;
    this.message = null;

    // Usar el mismo método que el registro de donantes (authService.registerUser)
    this.authService.registerUser(payload).pipe(
      finalize(() => this.isSubmitting = false)
    ).subscribe({
      next: (res: any) => {
        this.success = true;
        this.message = res?.message || 'Cuenta creada, correo de verificación enviado';
        this.state.setSuccessMessage(this.message || '');
        // Redirect to the email verification page with the registered email
        try {
          const emailTo = payload?.email || this.orgForm.get('email')?.value || '';
          this.router.navigate(['/auth/email-verification'], { queryParams: { email: emailTo } });
        } catch (err) {
          // ignore navigation errors but log
          console.warn('Navigation to email-verification failed', err);
        }
      },
      error: (err: any) => {
        this.success = false;
        console.error('Error al registrar organización:', err);
        console.error('Payload enviado:', payload);
        
        if (err?.status === 400) {
          const body = err.error;
          if (typeof body === 'string') {
            this.message = body;
          } else if (body?.message) {
            this.message = body.message;
          } else if (Array.isArray(body)) {
            this.message = body.join(', ');
          } else if (body?.errors) {
            // Si hay errores de validación específicos
            const errorMessages = Object.values(body.errors).flat();
            this.message = errorMessages.join(', ') || 'Datos inválidos. Revise el formulario.';
          } else {
            this.message = 'Datos inválidos. Revise el formulario.';
          }
        } else if (err?.status === 409) {
          this.message = err.error?.message || 'Ya existe una cuenta con esos datos.';
        } else {
          this.message = err.error?.message || err?.message || 'Error del servidor. Intente de nuevo más tarde.';
        }
      }
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  openTermsModal(event: Event): void {
    event.preventDefault();
    this.dialog.open(TermsModalComponent, {
      width: '800px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      autoFocus: false,
      panelClass: 'terms-modal-container'
    });
  }

  openPrivacyPolicyModal(event: Event): void {
    event.preventDefault();
    this.dialog.open(PrivacyPolicyModalComponent, {
      width: '800px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      autoFocus: false,
      panelClass: 'privacy-modal-container'
    });
  }

}

