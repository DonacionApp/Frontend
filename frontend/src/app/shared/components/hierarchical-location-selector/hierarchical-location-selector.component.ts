import { Component, EventEmitter, Input, Output, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CountriesService, Country, State, City } from '../../../core/services/countries.service';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

export interface LocationSelection {
  country: Country | null;
  state: State | null;
  city: City | null;
}

@Component({
  selector: 'app-hierarchical-location-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './hierarchical-location-selector.component.html'
})
export class HierarchicalLocationSelectorComponent implements OnInit, OnDestroy {
  @Input() initialSelection: LocationSelection = { country: null, state: null, city: null };
  @Output() selectionChange = new EventEmitter<LocationSelection>();

  countries: Country[] = [];
  states: State[] = [];
  cities: City[] = [];
  
  filteredCountries: Country[] = [];
  filteredStates: State[] = [];
  filteredCities: City[] = [];
  
  selectedCountry: Country | null = null;
  selectedState: State | null = null;
  selectedCity: City | null = null;
  
  countrySearchTerm = '';
  stateSearchTerm = '';
  citySearchTerm = '';
  
  isLoadingCountries = false;
  isLoadingStates = false;
  isLoadingCities = false;
  
  showCountryDropdown = false;
  showStateDropdown = false;
  showCityDropdown = false;
  
  private destroy$ = new Subject<void>();
  private countrySearchSubject = new Subject<string>();
  private stateSearchSubject = new Subject<string>();
  private citySearchSubject = new Subject<string>();

  constructor(private countriesService: CountriesService) {}

  ngOnInit(): void {
    this.loadCountries();
    this.setupSearchDebouncing();
    
    // Establecer selección inicial si existe
    if (this.initialSelection.country) {
      this.selectedCountry = this.initialSelection.country;
      this.loadStates(this.selectedCountry.iso2);
    }
    if (this.initialSelection.state) {
      this.selectedState = this.initialSelection.state;
      this.loadCities(this.selectedCountry?.iso2 || '', this.selectedState.iso2);
    }
    if (this.initialSelection.city) {
      this.selectedCity = this.initialSelection.city;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearchDebouncing(): void {
    this.countrySearchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(term => this.filterCountries(term));

    this.stateSearchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(term => this.filterStates(term));

    this.citySearchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(term => this.filterCities(term));
  }

  loadCountries(): void {
    this.isLoadingCountries = true;
    this.countriesService.getCountries().subscribe({
      next: (countries) => {
        this.countries = countries;
        this.filteredCountries = countries;
        this.isLoadingCountries = false;
      },
      error: (error) => {
        console.error('Error loading countries:', error);
        this.isLoadingCountries = false;
      }
    });
  }

  loadStates(countryCode: string): void {
    if (!countryCode) return;
    
    this.isLoadingStates = true;
    this.countriesService.getStates(countryCode).subscribe({
      next: (states) => {
        this.states = states;
        this.filteredStates = states;
        this.isLoadingStates = false;
      },
      error: (error) => {
        console.error('Error loading states:', error);
        this.isLoadingStates = false;
      }
    });
  }

  loadCities(countryCode: string, stateCode?: string): void {
    if (!countryCode) return;
    
    this.isLoadingCities = true;
    this.countriesService.getCities(countryCode, stateCode).subscribe({
      next: (cities) => {
        this.cities = cities;
        this.filteredCities = cities;
        this.isLoadingCities = false;
      },
      error: (error) => {
        console.error('Error loading cities:', error);
        this.isLoadingCities = false;
      }
    });
  }

  onCountrySearch(event: any): void {
    const term = event.target?.value || '';
    this.countrySearchTerm = term;
    this.countrySearchSubject.next(term);
  }

  onStateSearch(event: any): void {
    const term = event.target?.value || '';
    this.stateSearchTerm = term;
    this.stateSearchSubject.next(term);
  }

  onCitySearch(event: any): void {
    const term = event.target?.value || '';
    this.citySearchTerm = term;
    this.citySearchSubject.next(term);
  }

  onCountryBlur(): void {
    setTimeout(() => this.showCountryDropdown = false, 200);
  }

  onStateBlur(): void {
    setTimeout(() => this.showStateDropdown = false, 200);
  }

  onCityBlur(): void {
    setTimeout(() => this.showCityDropdown = false, 200);
  }

  filterCountries(term: string): void {
    if (!term.trim()) {
      this.filteredCountries = this.countries;
    } else {
      this.filteredCountries = this.countries.filter(country =>
        country.name.toLowerCase().includes(term.toLowerCase()) ||
        country.iso2.toLowerCase().includes(term.toLowerCase())
      );
    }
  }

  filterStates(term: string): void {
    if (!term.trim()) {
      this.filteredStates = this.states;
    } else {
      this.filteredStates = this.states.filter(state =>
        state.name.toLowerCase().includes(term.toLowerCase()) ||
        state.iso2.toLowerCase().includes(term.toLowerCase())
      );
    }
  }

  filterCities(term: string): void {
    if (!term.trim()) {
      this.filteredCities = this.cities;
    } else {
      this.filteredCities = this.cities.filter(city =>
        city.name.toLowerCase().includes(term.toLowerCase())
      );
    }
  }

  selectCountry(country: Country): void {
    this.selectedCountry = country;
    this.selectedState = null;
    this.selectedCity = null;
    this.countrySearchTerm = country.name;
    this.showCountryDropdown = false;
    
    // Limpiar estados y ciudades
    this.states = [];
    this.cities = [];
    this.filteredStates = [];
    this.filteredCities = [];
    this.stateSearchTerm = '';
    this.citySearchTerm = '';
    
    this.loadStates(country.iso2);
    this.emitSelection();
  }

  selectState(state: State): void {
    this.selectedState = state;
    this.selectedCity = null;
    this.stateSearchTerm = state.name;
    this.showStateDropdown = false;
    
    // Limpiar ciudades
    this.cities = [];
    this.filteredCities = [];
    this.citySearchTerm = '';
    
    if (this.selectedCountry) {
      this.loadCities(this.selectedCountry.iso2, state.iso2);
    }
    this.emitSelection();
  }

  selectCity(city: City): void {
    this.selectedCity = city;
    this.citySearchTerm = city.name;
    this.showCityDropdown = false;
    this.emitSelection();
  }

  clearCountry(): void {
    this.selectedCountry = null;
    this.selectedState = null;
    this.selectedCity = null;
    this.countrySearchTerm = '';
    this.stateSearchTerm = '';
    this.citySearchTerm = '';
    this.states = [];
    this.cities = [];
    this.filteredStates = [];
    this.filteredCities = [];
    this.showCountryDropdown = false;
    this.showStateDropdown = false;
    this.showCityDropdown = false;
    this.emitSelection();
  }

  clearState(): void {
    this.selectedState = null;
    this.selectedCity = null;
    this.stateSearchTerm = '';
    this.citySearchTerm = '';
    this.cities = [];
    this.filteredCities = [];
    this.showStateDropdown = false;
    this.showCityDropdown = false;
    this.emitSelection();
  }

  clearCity(): void {
    this.selectedCity = null;
    this.citySearchTerm = '';
    this.showCityDropdown = false;
    this.emitSelection();
  }

  toggleCountryDropdown(): void {
    this.showCountryDropdown = !this.showCountryDropdown;
    if (this.showCountryDropdown) {
      this.showStateDropdown = false;
      this.showCityDropdown = false;
    }
  }

  toggleStateDropdown(): void {
    if (!this.selectedCountry) return;
    this.showStateDropdown = !this.showStateDropdown;
    if (this.showStateDropdown) {
      this.showCountryDropdown = false;
      this.showCityDropdown = false;
    }
  }

  toggleCityDropdown(): void {
    if (!this.selectedState) return;
    this.showCityDropdown = !this.showCityDropdown;
    if (this.showCityDropdown) {
      this.showCountryDropdown = false;
      this.showStateDropdown = false;
    }
  }

  private emitSelection(): void {
    this.selectionChange.emit({
      country: this.selectedCountry,
      state: this.selectedState,
      city: this.selectedCity
    });
  }

  getCountryDisplayText(): string {
    return this.selectedCountry ? this.selectedCountry.name : 'Seleccionar país';
  }

  getStateDisplayText(): string {
    return this.selectedState ? this.selectedState.name : 'Seleccionar estado/departamento';
  }

  getCityDisplayText(): string {
    return this.selectedCity ? this.selectedCity.name : 'Seleccionar ciudad';
  }

  isCountryDisabled(): boolean {
    return this.isLoadingCountries;
  }

  isStateDisabled(): boolean {
    return !this.selectedCountry || this.isLoadingStates;
  }

  isCityDisabled(): boolean {
    return !this.selectedState || this.isLoadingCities;
  }
}
