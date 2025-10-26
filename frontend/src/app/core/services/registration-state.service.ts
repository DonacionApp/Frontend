import { Injectable, BehaviorSubject } from '@angular/core';
import { Observable } from 'rxjs';

export interface RegistrationFormData {
  // Campos comunes
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  address: string;
  acceptTerms: boolean;
  acceptNewsletter: boolean;
  
  // Campos específicos para donante
  firstName?: string;
  lastName?: string;
  identificationNumber?: string;
  dateOfBirth?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  donationFrequency?: string;
  maxDonationAmount?: number;
  
  // Campos específicos para organización
  organizationName?: string;
  description?: string;
  organizationType?: string;
  taxId?: string;
}

export type UserType = 'donor' | 'organization';

@Injectable({
  providedIn: 'root'
})
export class RegistrationStateService {
  // Estado del formulario
  private _formData = new BehaviorSubject<RegistrationFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    address: '',
    acceptTerms: false,
    acceptNewsletter: false
  });
  
  private _selectedType = new BehaviorSubject<UserType | null>(null);
  private _isLoading = new BehaviorSubject<boolean>(false);
  private _errorMessage = new BehaviorSubject<string>('');
  private _successMessage = new BehaviorSubject<string>('');

  // Getters reactivos
  formData: Observable<RegistrationFormData> = this._formData.asObservable();
  selectedType: Observable<UserType | null> = this._selectedType.asObservable();
  isLoading: Observable<boolean> = this._isLoading.asObservable();
  errorMessage: Observable<string> = this._errorMessage.asObservable();
  successMessage: Observable<string> = this._successMessage.asObservable();
  
  // Getters síncronos para el template
  get formDataValue(): RegistrationFormData {
    return this._formData.value;
  }
  
  get selectedTypeValue(): UserType | null {
    return this._selectedType.value;
  }
  
  get isLoadingValue(): boolean {
    return this._isLoading.value;
  }
  
  get errorMessageValue(): string {
    return this._errorMessage.value;
  }
  
  get successMessageValue(): string {
    return this._successMessage.value;
  }
  
  // Computed para tipo de usuario
  get isOrganizationSelected(): boolean {
    return this._selectedType.value === 'organization';
  }
  
  get isDonorSelected(): boolean {
    return this._selectedType.value === 'donor';
  }

  constructor() {}

  // Métodos para manejar el tipo de usuario
  selectUserType(type: UserType): void {
    this._selectedType.next(type);
    this.clearMessages();
  }

  // Métodos para manejar el formulario
  updateFormData(updates: Partial<RegistrationFormData>): void {
    const current = this._formData.value;
    this._formData.next({ ...current, ...updates });
  }

  resetForm(): void {
    this._formData.next({
      email: '',
      password: '',
      confirmPassword: '',
      phone: '',
      address: '',
      acceptTerms: false,
      acceptNewsletter: false
    });
    this._selectedType.next(null);
    this.clearMessages();
  }

  // Métodos para manejar el estado de carga
  setLoading(loading: boolean): void {
    this._isLoading.next(loading);
  }

  // Métodos para manejar mensajes
  setErrorMessage(message: string): void {
    this._errorMessage.next(message);
    this._successMessage.next('');
  }

  setSuccessMessage(message: string): void {
    this._successMessage.next(message);
    this._errorMessage.next('');
  }

  clearMessages(): void {
    this._errorMessage.next('');
    this._successMessage.next('');
  }
}
