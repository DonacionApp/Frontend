import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CountriesService } from '../../../core/services/countries.service';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { Countris, StatesbyCountrySelect, CitiesByStateSelect } from '../../../shared/model/countries.model';
import { Observable, Subject, debounceTime, distinctUntilChanged, takeUntil, throwError, finalize } from 'rxjs';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';
import { Rol } from '../../../shared/model/rol.model';
import { TypeDniModel } from '../../../shared/model/type.dni.model';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TermsModalComponent } from '../../../shared/components/terms-modal/terms-modal.component';
import { PrivacyPolicyModalComponent } from '../../../shared/components/privacy-policy-modal/privacy-policy-modal.component';

@Component({
  selector: 'app-register-user',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FooterComponent, ButtonComponent, MatDialogModule],
  templateUrl: './register-user.component.html',
  styleUrls: ['./register-user.component.scss']
})
export class RegisterUserComponent implements OnInit, OnDestroy {
  registerForm!: FormGroup;
  lastPayload: any = null;
  rolDefault: string = "user";

  rolesOptions: Rol[] = [];
  typeOptions: TypeDniModel[] = [];
  countriesOptions: Countris[] = [];

  loadStates: boolean = false;
  loadCities = false;

  // register loader / messages
  loadingRegister: boolean = false;
  successMessage: string = '';
  errorMessage: string = '';

  statesOptions: StatesbyCountrySelect[] = [];


  citiesOptions: CitiesByStateSelect[] = [];

  isFormValid: boolean = false;

  // Variables para mostrar/ocultar contraseñas
  showPassword = false;
  showConfirmPassword = false;

  private destroy$ = new Subject<void>();

  constructor(
    private countriesService: CountriesService,
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private dialog: MatDialog
  ) { }

  goToOrganizationRegister(): void {
    try {
      // Limpiar el formulario antes de navegar
      if (this.registerForm) {
        this.registerForm.reset();
        // Restablecer valores por defecto
        this.registerForm.patchValue({
          acceptTerms: false,
          acceptPrivacyPolicy: false
        });
        // Restablecer estados de campos deshabilitados
        this.registerForm.get('people.municipio.state.iso2')?.disable();
        this.registerForm.get('people.municipio.city.name')?.disable();
      }
      // Limpiar mensajes y estados
      this.successMessage = '';
      this.errorMessage = '';
      this.loadingRegister = false;
      this.lastPayload = null;
      // Limpiar opciones de ubicación
      this.statesOptions = [];
      this.citiesOptions = [];
      this.loadStates = false;
      this.loadCities = false;
      // Navegar
      this.router.navigate(['/register/organization']);
    } catch (err) {
      console.warn('Navigation to organization register failed', err);
    }
  }

  ngOnInit(): void {
    // Limpiar estados previos al inicializar
    this.successMessage = '';
    this.errorMessage = '';
    this.loadingRegister = false;
    this.lastPayload = null;
    this.statesOptions = [];
    this.citiesOptions = [];
    this.loadStates = false;
    this.loadCities = false;
    
    this.registerForm = this.fb.group({
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      confirmPassword: ['', Validators.required],
      rolId: ['', Validators.required],
      profilePhoto: [''],
      acceptTerms: [false, [Validators.requiredTrue]],
      acceptPrivacyPolicy: [false, [Validators.requiredTrue]],
      people: this.fb.group({
        name: ['', Validators.required],
        lastName: [''],
        birdthDate: [''],
        // tipoDni field requested
        tipodDni: ['', Validators.required],
        dni: ['', [Validators.required, Validators.maxLength(10)]],
        residencia: [''],
        telefono: ['', Validators.maxLength(10)],
        municipio: this.fb.group({
          pais: this.fb.group({ iso2: ['', Validators.required], display: [''] }),
          state: this.fb.group({ iso2: ['', Validators.required], display: [''] }),
          city: this.fb.group({ name: ['', Validators.required], display: [''] })
        })
      })
    }, { validators: this.passwordsMatchValidator });
    // initial valid state
    this.isFormValid = this.registerForm.valid;
    // update isFormValid whenever form status changes
    this.registerForm.statusChanges?.pipe(takeUntil(this.destroy$)).subscribe(status => {
      this.isFormValid = status === 'VALID';
    });
    this.registerForm.get('people.municipio.state.iso2')?.disable();
    this.registerForm.get('people.municipio.city.name')?.disable();

    // Load countries once and set up filtering
    this.countriesService.countriesList().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.countriesOptions = data || [];
      },
      error: () => {
        this.countriesOptions = [];
      }
    });

    this.authService.loadRolesDefault().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        data = data.filter((r: Rol) => {
          if (r.rol == this.rolDefault) {
            this.registerForm.get('rolId')?.setValue(Number(r.id));
          }
        })
      }
    });

    this.authService.loadTypesDni().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.typeOptions = data || [];
      }
    });

  }

  private passwordsMatchValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
    const pass = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    if (!pass || !confirm) { return null; }
    return pass === confirm ? null : { passwordsMismatch: true };
  }

  onSubmit(): void {
    if (!this.registerForm) { return; }
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      console.warn('Formulario inválido');
      return;
    }

    const fv = this.registerForm.value;

    let countryIso = fv.people.municipio.pais.iso2;
    if (!countryIso && fv.people.municipio.pais.display) {
      const foundC = this.countriesOptions.find(c => (c.name || '').toLowerCase() === fv.people.municipio.pais.display.toLowerCase());
      countryIso = foundC?.iso2 || '';
    }

    let stateIso = fv.people.municipio.state.iso2;
    if (!stateIso && fv.people.municipio.state.display) {
      const foundS = this.statesOptions.find(s => (s.name || '').toLowerCase() === fv.people.municipio.state.display.toLowerCase());
      stateIso = foundS?.iso2 || '';
    }

    const cityName = fv.people.municipio.city.name || fv.people.municipio.city.display || '';

    // ensure numeric tipodDni is sent (convert string -> number when possible)
    const tipodDniRaw = fv.people.tipodDni;
    const tipodDniNum = tipodDniRaw === null || tipodDniRaw === undefined || tipodDniRaw === '' ? null : Number(tipodDniRaw);

    const payload = {
      username: fv.username,
      email: fv.email,
      password: fv.password,
      profilePhoto: fv.profilePhoto,
      rolId: fv.rolId,
      people: {
        name: fv.people.name,
        lastName: fv.people.lastName,
        birdthDate: fv.people.birdthDate,
        tipodDni: tipodDniNum,
        dni: fv.people.dni,
        residencia: fv.people.residencia,
        telefono: fv.people.telefono,
        municipio: {
          pais: { iso2: countryIso },
          state: { iso2: stateIso },
          city: { name: cityName }
        }
      }
    };

    this.lastPayload = payload;
    // reset messages
    this.successMessage = '';
    this.errorMessage = '';
    if (this.lastPayload) {
      this.loadingRegister = true;
      this.registerUser().pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loadingRegister = false)
      ).subscribe({
        next: (res) => {
          this.successMessage = 'Cuenta creada, correo de verificacion enviado';
          // Redirect to the email verification page with the registered email
          try {
            const emailTo = payload?.email || this.registerForm.get('email')?.value || '';
            this.router.navigate(['/auth/email-verification'], { queryParams: { email: emailTo } });
          } catch (err) {
            // ignore navigation errors but log
            console.warn('Navigation to email-verification failed', err);
          }
        },
        error: (err) => {
          console.error('Error al registrar usuario', err);
          this.errorMessage = err?.error?.message || err?.message || 'Error al crear la cuenta';
        }
      });
    } else {
      // No payload to register
    }
  }

  registerUser(): Observable<any> {
    try {
      return this.authService.registerUser(this.lastPayload);
    } catch (error) {
      return throwError(error);
    }
  }

  selectCountry(country: Countris): void {
    if (!country) { return; }
    this.registerForm.get(['people', 'municipio', 'pais', 'iso2'])?.setValue(country.iso2 || '');
    this.registerForm.get(['people', 'municipio', 'pais', 'display'])?.setValue(country.name || '');
    // start loading states
    this.loadStates = true;
    this.countriesService.statesByCountry(country.iso2 || '').pipe(takeUntil(this.destroy$)).subscribe({
      next: (states) => {
        this.statesOptions = states || [];
        // clear previous state and city values (keeps selects visible)
        this.registerForm.get(['people', 'municipio', 'state', 'iso2'])?.setValue('');
        this.registerForm.get(['people', 'municipio', 'state', 'display'])?.setValue('');
        this.registerForm.get(['people', 'municipio', 'city', 'name'])?.setValue('');
        this.registerForm.get(['people', 'municipio', 'city', 'display'])?.setValue('');
        
        // If country has states, enable and require state field
        if (this.statesOptions.length > 0) {
          this.registerForm.get('people.municipio.state.iso2')?.enable();
          this.registerForm.get('people.municipio.state.iso2')?.setValidators([Validators.required]);
        } else {
          // If country has no states, disable and clear validators
          this.registerForm.get('people.municipio.state.iso2')?.disable();
          this.registerForm.get('people.municipio.state.iso2')?.clearValidators();
          this.registerForm.get('people.municipio.state.iso2')?.setValue('');
          // Also handle city field - make it optional when no states
          this.registerForm.get('people.municipio.city.name')?.disable();
          this.registerForm.get('people.municipio.city.name')?.clearValidators();
          this.registerForm.get('people.municipio.city.name')?.setValue('');
          this.registerForm.get('people.municipio.city.name')?.updateValueAndValidity();
        }
        this.registerForm.get('people.municipio.state.iso2')?.updateValueAndValidity();
        this.loadStates = false;
      },
      error: (err) => {
        // Silently handle countries without states (e.g., CX, CC)
        this.statesOptions = [];
        this.registerForm.get('people.municipio.state.iso2')?.disable();
        this.registerForm.get('people.municipio.state.iso2')?.clearValidators();
        this.registerForm.get('people.municipio.state.iso2')?.setValue('');
        this.registerForm.get('people.municipio.state.iso2')?.updateValueAndValidity();
        // Also handle city field - make it optional when no states
        this.registerForm.get('people.municipio.city.name')?.disable();
        this.registerForm.get('people.municipio.city.name')?.clearValidators();
        this.registerForm.get('people.municipio.city.name')?.setValue('');
        this.registerForm.get('people.municipio.city.name')?.updateValueAndValidity();
        this.citiesOptions = [];
        this.loadStates = false;
      }
    });
  }

  onCountryChange(event: Event): void {
    const iso2 = (event.target as HTMLSelectElement)?.value || '';
    if (!iso2) {
      this.registerForm.get('people.municipio.city.name')?.disable();
      this.registerForm.get('people.municipio.state.iso2')?.disable();
      this.registerForm.get('people.municipio.state.iso2')?.clearValidators();
      this.registerForm.get('people.municipio.state.iso2')?.updateValueAndValidity();
      this.statesOptions = [];
      this.citiesOptions = [];
      this.loadStates = false;
      this.loadCities = false;
      this.registerForm.get(['people', 'municipio', 'state', 'iso2'])?.setValue('');
      this.registerForm.get(['people', 'municipio', 'state', 'display'])?.setValue('');
      this.registerForm.get(['people', 'municipio', 'city', 'name'])?.setValue('');
      this.registerForm.get(['people', 'municipio', 'city', 'display'])?.setValue('');
      return;
    }
    const country = this.countriesOptions.find(c => c.iso2 === iso2);
    if (country) { this.selectCountry(country); }
  }

  selectState(state: StatesbyCountrySelect): void {
    if (!state) { return; }
    this.registerForm.get(['people', 'municipio', 'state', 'iso2'])?.setValue(state.iso2 || '');
    this.registerForm.get(['people', 'municipio', 'state', 'display'])?.setValue(state.name || '');
    this.registerForm.get('people.municipio.city.name')?.enable();
    this.loadCities = true;

    const countryIso = this.registerForm.get(['people', 'municipio', 'pais', 'iso2'])?.value;
    if (!countryIso) { return; }

    this.countriesService.citiesByState(countryIso, state.iso2 || '').pipe(takeUntil(this.destroy$)).subscribe({
      next: (cities) => {
        this.citiesOptions = cities || [];
        // clear city selection
        this.registerForm.get(['people', 'municipio', 'city', 'name'])?.setValue('');
        this.registerForm.get(['people', 'municipio', 'city', 'display'])?.setValue('');
        this.loadCities = false;
      },
      error: () => {
        this.citiesOptions = [];
        this.loadCities = false;
      }
    });
  }

  onStateChange(event: Event): void {
    const iso2 = (event.target as HTMLSelectElement)?.value || '';
    if (!iso2) {
      this.registerForm.get('people.municipio.city')?.disable();
      this.citiesOptions = [];
      this.registerForm.get(['people', 'municipio', 'city', 'name'])?.setValue('');
      this.registerForm.get(['people', 'municipio', 'city', 'display'])?.setValue('');
      this.registerForm.get('people.municipio.city.name')?.enable();
      return;
    }
    const state = this.statesOptions.find(s => s.iso2 === iso2);
    if (state) { this.selectState(state); }
  }

  selectCity(city: CitiesByStateSelect): void {
    if (!city) { return; }
    this.registerForm.get(['people', 'municipio', 'city', 'name'])?.setValue(city.name || '');
    this.registerForm.get(['people', 'municipio', 'city', 'display'])?.setValue(city.name || '');
  }

  onCityChange(event: Event): void {
    const name = (event.target as HTMLSelectElement)?.value || '';
    if (!name) {
      this.registerForm.get(['people', 'municipio', 'city', 'name'])?.setValue('');
      this.registerForm.get(['people', 'municipio', 'city', 'display'])?.setValue('');
      return;
    }
    const city = this.citiesOptions.find(c => c.name === name);
    if (city) { this.selectCity(city); }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  openTermsModal(event: Event): void {
    event.preventDefault();
    console.log('Opening terms modal...');
    const dialogRef = this.dialog.open(TermsModalComponent, {
      width: '800px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      autoFocus: false,
      panelClass: 'terms-modal-container'
    });
    console.log('Dialog ref:', dialogRef);
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

