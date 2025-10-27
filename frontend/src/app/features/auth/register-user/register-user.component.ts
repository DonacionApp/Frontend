import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CountriesService } from '../../../core/services/countries.service';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { Countris, StatesbyCountrySelect, CitiesByStateSelect } from '../../../shared/model/countries.model';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

@Component({
  selector: 'app-register-user',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FooterComponent, ButtonComponent],
  templateUrl: './register-user.component.html',
  styleUrls: ['./register-user.component.scss']
})
export class RegisterUserComponent implements OnInit, OnDestroy {
  registerForm!: FormGroup;
  lastPayload: any = null;

  countriesOptions: Countris[] = [];

  loadStates: boolean = false;
  loadCities = false;

  statesOptions: StatesbyCountrySelect[] = [];


  citiesOptions: CitiesByStateSelect[] = [];


  private destroy$ = new Subject<void>();

  constructor(
    private countriesService: CountriesService,
    private fb: FormBuilder,
  ) { }

  ngOnInit(): void {
    // Build empty form (user will fill values)
    console.log('cities option length', this.citiesOptions.length);
    console.log('filtered states length', this.statesOptions.length);
    this.registerForm = this.fb.group({
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      rolId: [null],
      profilePhoto: [''],
      people: this.fb.group({
        name: ['', Validators.required],
        lastName: [''],
        birdthDate: [''],
        // tipoDni field requested
        tipodDni: [''],
        dni: [''],
        residencia: [''],
        telefono: [''],
        municipio: this.fb.group({
          pais: this.fb.group({ iso2: [''], display: [''] }),
          state: this.fb.group({ iso2: [''], display: [''] }),
          city: this.fb.group({ name: [''], display: [''] })
        })
      })
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

    // No client-side filtered suggestion lists: selects will render the full options arrays directly
  }

  onSubmit(): void {
    if (!this.registerForm) { return; }
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      console.warn('Formulario inválido');
      return;
    }

    const fv = this.registerForm.value;

    // Resolve iso2 fallbacks if user typed display but didn't select
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
        tipodDni: fv.people.tipodDni,
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
    console.log('Payload submitted:', payload);
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
        this.registerForm.get('people.municipio.state.iso2')?.enable();
        this.loadStates = false;
      },
      error: () => {
        this.statesOptions = [];
        this.loadStates = false;
      }
    });
  }

  onCountryChange(event: Event): void {
    const iso2 = (event.target as HTMLSelectElement)?.value || '';
    if (!iso2) {
      this.registerForm.get('people.municipio.city.name')?.disable();
      this.registerForm.get('people.municipio.state.iso2')?.disable();
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

}
