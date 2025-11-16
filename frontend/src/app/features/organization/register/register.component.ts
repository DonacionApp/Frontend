import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators, FormsModule } from '@angular/forms';
import { OrganizationRegistrationService } from '../../../core/services';
import { RegistrationStateService } from '../../../core/services/registration-state.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TermsModalComponent } from '../../../shared/components/terms-modal/terms-modal.component';


@Component({
  selector: 'app-organization-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, MatDialogModule],
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
      address: ['', Validators.required],
      phone: ['', Validators.required],
      // Campos requeridos por el backend (dni ahora opcional)
      birdthDate: ['', Validators.required],
      tipodDni: [1, Validators.required],
      dni: [''],
      // Términos
      acceptTerms: [false, [Validators.requiredTrue]]
    });
  }

  private formatDateToDdMmYyyy(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    // dateStr expected in 'YYYY-MM-DD' from <input type="date">; convert to 'DD-MM-YYYY'
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    return `${d}-${m}-${y}`;
  }

  ngOnInit(): void {
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
      this.regService.getStates(iso).subscribe({ next: (s: any[]) => this.states = s || [], error: () => this.states = [] });
    } else {
      this.states = [];
      this.cities = [];
    }
  }

  onStateChange(isoState: string): void {
    const isoCountry = this.orgForm.value.countryIso;
    this.orgForm.patchValue({ stateIso: isoState, cityName: '' });
    if (isoCountry && isoState) {
      this.regService.getCities(isoCountry, isoState).subscribe({ next: (c: any[]) => this.cities = c || [], error: () => this.cities = [] });
    } else {
      this.cities = [];
    }
  }

  // Removed file upload handlers: onFilesSelected, validateFile, removeFile

  canProceed(): boolean {
    if (this.step === 1) {
      return !!(this.orgForm.get('organizationName')?.valid && 
                this.orgForm.get('email')?.valid && 
                this.orgForm.get('password')?.valid && 
                this.orgForm.get('confirmPassword')?.valid &&
                this.orgForm.get('description')?.valid); // Validar descripción
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
    if (this.canProceed()) this.step++;
  }

  prev(): void {
    if (this.step > 1) this.step--;
  }

  onSubmit(): void {
    if (this.isSubmitting) return;

    // Basic password confirm
    if (this.orgForm.value.password !== this.orgForm.value.confirmPassword) {
      this.message = 'Las contraseñas no coinciden';
      this.success = false;
      return;
    }

    // Coerce/format fields to match backend expectations
    const tipod = Number(this.orgForm.value.tipodDni) || 1;
    const birdth = this.formatDateToDdMmYyyy(this.orgForm.value.birdthDate);

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
        birdthDate: birdth || '',
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

    // Enviar siempre JSON (sin archivos)
    this.regService.registerOrganizationJson(payload).subscribe({
      next: (res: any) => {
        this.success = true;
        if (res?.status === 'pending' || res?.message?.toLowerCase?.().includes('pending')) {
          this.message = 'Registro recibido. Su organización está en estado "pendiente". Verificaremos su correo electrónico.';
        } else {
          this.message = res?.message || 'Registro completado.';
        }
        this.state.setSuccessMessage(this.message || '');
        setTimeout(() => this.router.navigate(['/auth/email-verification'], {
          queryParams: { email: this.orgForm.value.email }
        }), 1500);
        this.isSubmitting = false;
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.success = false;
        if (err?.status === 400) {
          const body = err.error;
          if (typeof body === 'string') {
            this.message = body;
          } else if (body?.message) {
            this.message = body.message;
          } else if (Array.isArray(body)) {
            this.message = body.join(',');
          } else {
            this.message = 'Datos inválidos. Revise el formulario.';
          }
        } else if (err?.status === 409) {
          this.message = err.error?.message || 'Ya existe una cuenta con esos datos.';
        } else {
          this.message = 'Error del servidor. Intente de nuevo más tarde.';
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

}

