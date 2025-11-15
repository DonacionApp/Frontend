import { Component, OnInit, OnDestroy, inject, HostListener } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { filter } from 'rxjs/operators';

// Importar solo el componente que se usa directamente
import { NavComponent } from './shared/components/nav/nav.component';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';
// Servicios integrados directamente
import { BehaviorSubject, Observable } from 'rxjs';
import { WebsocketService, ToastService, NotificationService, AuthService } from './core/services';

export interface User {
  id?: string;
  email: string;
  name: string;
  type?: 'donor' | 'organization';
}

export type ViewType = 'home' | 'register' | 'login' | 'dashboard';

export interface RegistrationFormData {
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  address: string;
  acceptTerms: boolean;
  acceptNewsletter: boolean;
  firstName?: string;
  lastName?: string;
  identificationNumber?: string;
  dateOfBirth?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  donationFrequency?: string;
  maxDonationAmount?: number;
  organizationName?: string;
  description?: string;
  organizationType?: string;
  taxId?: string;
}

export type UserType = 'donor' | 'organization';

class AppStateService {
  private _isAuthenticated = new BehaviorSubject<boolean>(false);
  private _user = new BehaviorSubject<User | null>(null);
  private _currentView = new BehaviorSubject<ViewType>('home');

  get isAuthenticatedValue(): boolean { return this._isAuthenticated.value; }
  get userValue(): User | null { return this._user.value; }
  get currentViewValue(): ViewType { return this._currentView.value; }
  get isHomeView(): boolean { return this._currentView.value === 'home'; }
  get isRegisterView(): boolean { return this._currentView.value === 'register'; }
  get isLoginView(): boolean { return this._currentView.value === 'login'; }
  get isDashboardView(): boolean { return this._currentView.value === 'dashboard'; }

  setUser(user: User): void {
    this._user.next(user);
    this._isAuthenticated.next(true);
  }

  logout(): void {
    this._user.next(null);
    this._isAuthenticated.next(false);
    this._currentView.next('home');
  }

  goToDashboard(): void {
    this._currentView.next('dashboard');
  }
}

class RegistrationStateService {
  private _formData = new BehaviorSubject<RegistrationFormData>({
    email: '', password: '', confirmPassword: '', phone: '', address: '',
    acceptTerms: false, acceptNewsletter: false
  });
  private _selectedType = new BehaviorSubject<UserType | null>(null);
  private _isLoading = new BehaviorSubject<boolean>(false);
  private _errorMessage = new BehaviorSubject<string>('');
  private _successMessage = new BehaviorSubject<string>('');

  get formDataValue(): RegistrationFormData { return this._formData.value; }
  get selectedTypeValue(): UserType | null { return this._selectedType.value; }
  get isOrganizationSelected(): boolean { return this._selectedType.value === 'organization'; }

  setLoading(loading: boolean): void { this._isLoading.next(loading); }
  setErrorMessage(message: string): void { this._errorMessage.next(message); this._successMessage.next(''); }
  setSuccessMessage(message: string): void { this._successMessage.next(message); this._errorMessage.next(''); }
  clearMessages(): void { this._errorMessage.next(''); this._successMessage.next(''); }
  resetForm(): void {
    this._formData.next({ email: '', password: '', confirmPassword: '', phone: '', address: '', acceptTerms: false, acceptNewsletter: false });
    this._selectedType.next(null);
    this.clearMessages();
  }
}

interface ApiResponse {
  success: boolean;
  message: string;
  data?: any;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    RouterModule,
    NavComponent,
    ToastContainerComponent
  ],
  providers: [HttpClient, AppStateService, RegistrationStateService],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'DonacionApp';
  
  // Inyección de servicios de estado
  private appState: AppStateService;
  private registrationState: RegistrationStateService;
  
  constructor(
    public router: Router,
    private http: HttpClient,
    private websocketService: WebsocketService,
    private toastService: ToastService,
    private notificationService: NotificationService,
    private authService: AuthService
  ) {
    this.appState = new AppStateService();
    this.registrationState = new RegistrationStateService();
  }
  
  // Acceso reactivo al estado de la aplicación
  get currentView() { return this.appState.currentViewValue; }
  get isHomeView() { return this.appState.isHomeView; }
  get isRegisterView() { return this.appState.isRegisterView; }
  get isLoginView() { return this.appState.isLoginView; }
  get isDashboardView() { return this.appState.isDashboardView; }
  get isAuthenticated() { return this.appState.isAuthenticatedValue; }
  get user() { return this.appState.userValue; }


  // Datos del formulario de login
  loginData = {
    email: '',
    password: '',
    rememberMe: false
  };

  // Estado del login
  isLoginLoading = false;
  loginErrorMessage = '';
  loginSuccessMessage = '';
  showLoginPassword = false;

  // Estado del registro
  showPassword = false;
  showConfirmPassword = false;

  // Getters para el login (para usar en el template)
  getIsLoginLoading() { return this.isLoginLoading; }
  getLoginErrorMessage() { return this.loginErrorMessage; }
  getLoginSuccessMessage() { return this.loginSuccessMessage; }
  getShowLoginPassword() { return this.showLoginPassword; }

  // Getters para el registro
  get formData() { return this.registrationState.formDataValue; }
  get isOrganizationSelected() { return this.registrationState.isOrganizationSelected; }
  get selectedUserType() { return this.registrationState.selectedTypeValue; }

  // Métodos para manejar eventos del navbar
  onHomeClick(): void {
    this.router.navigate(['/']);
  }

  onLoginClick(): void {
    this.router.navigate(['/login']);
  }

  onRegisterClick(): void {
    this.router.navigate(['/donor/register']);
  }

  onOrganizationRegisterClick(): void {
    this.router.navigate(['/organization/register']);
  }

  onLogoutClick(): void {
    this.appState.logout();
  // Desconectar WebSocket
  this.websocketService.disconnect();
    this.router.navigate(['/']);
  }

  // Método para controlar cuándo mostrar el nav
  shouldShowNav(): boolean {
    const currentUrl = this.router.url;
    // Mostrar nav en todas las rutas
    return true;
  }

      ngOnInit(): void {
        // Inicialización básica
        this.initializeWebSocket();
        this.subscribeToNotifications();
      }

  /**
   * Inicializar WebSocket cuando hay un token guardado y válido
   */
  private initializeWebSocket(): void {
    // Usar AuthService para validar el token antes de conectar
    // Esto evita intentar conectar con tokens expirados
    this.authService.connectWebSocketIfAuthenticated();
  }

  /**
   * Suscribirse a notificaciones del WebSocket
   */
  private subscribeToNotifications(): void {
    this.websocketService.notification$.subscribe(notification => {
  // Mostrar notificación toast flotante
      this.toastService.show({
  title: notification.title,
  message: notification.message,
  type: this.mapNotificationType(notification.type),
  link: notification.link
      });
    });
  }

  /**
   * Mapear tipo de notificación del backend a tipo de toast
   */
  private mapNotificationType(backendType: any): 'info' | 'success' | 'warning' | 'error' {
    // Ajustar según la estructura de tipo que venga del backend
    if (typeof backendType === 'string') {
      return backendType as 'info' | 'success' | 'warning' | 'error';
    }
    if (backendType?.type) {
      return backendType.type.toLowerCase() as 'info' | 'success' | 'warning' | 'error';
    }
    return 'info';
  }



  // Métodos para el login
  toggleLoginPassword(): void {
    this.showLoginPassword = !this.showLoginPassword;
  }

  clearLoginMessages(): void {
    this.loginErrorMessage = '';
    this.loginSuccessMessage = '';
  }


  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  clearMessages(): void {
    this.registrationState.clearMessages();
  }

  validateForm(): boolean {
    const data = this.formData;
    
    if (!data.email || !data.password || !data.phone || !data.address) {
      this.registrationState.setErrorMessage('Por favor completa todos los campos obligatorios');
      return false;
    }

    if (data.password !== data.confirmPassword) {
      this.registrationState.setErrorMessage('Las contraseñas no coinciden');
      return false;
    }

    if (data.password.length < 6) {
      this.registrationState.setErrorMessage('La contraseña debe tener al menos 6 caracteres');
      return false;
    }

    if (!this.selectedUserType) {
      this.registrationState.setErrorMessage('Por favor selecciona un tipo de usuario');
      return false;
    }

    // Validaciones específicas por tipo
    if (this.selectedUserType === 'donor') {
      if (!data.firstName || !data.lastName || !data.identificationNumber || !data.dateOfBirth || !data.city || !data.country) {
        this.registrationState.setErrorMessage('Por favor completa todos los campos obligatorios para donante');
        return false;
      }
    } else if (this.selectedUserType === 'organization') {
      if (!data.organizationName || !data.description || !data.organizationType || !data.taxId) {
        this.registrationState.setErrorMessage('Por favor completa todos los campos obligatorios para organización');
        return false;
      }
    }

    if (!data.acceptTerms) {
      this.registrationState.setErrorMessage('Debes aceptar los términos y condiciones');
      return false;
    }

    return true;
  }

  async onRegisterSubmit(): Promise<void> {
    this.clearMessages();
    
    if (!this.validateForm()) {
      return;
    }

    this.registrationState.setLoading(true);

    try {
      if (this.selectedUserType === 'donor') {
        await this.registerDonor();
      } else {
        await this.registerOrganization();
      }
    } catch (error) {
      this.registrationState.setErrorMessage('Error al procesar el registro. Inténtalo de nuevo.');
    } finally {
      this.registrationState.setLoading(false);
    }
  }

  async registerDonor(): Promise<void> {
    const data = this.formData;
    
    const donorData = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: data.password,
      identificationNumber: data.identificationNumber,
      phone: data.phone,
      dateOfBirth: data.dateOfBirth,
      address: data.address,
      city: data.city,
      country: data.country,
      postalCode: data.postalCode,
      donationFrequency: data.donationFrequency,
      maxDonationAmount: data.maxDonationAmount,
      acceptNewsletter: data.acceptNewsletter
    };

    const response = await this.http.post<ApiResponse>(`${environment.apiUrl}/donors/register`, donorData).toPromise();
    
    if (response?.success) {
      this.registrationState.setSuccessMessage('¡Registro exitoso! Tu cuenta de donante ha sido creada.');
      // Reset form
      this.registrationState.resetForm();
    } else {
      this.registrationState.setErrorMessage(response?.message || 'Error al registrar donante');
    }
  }

  async registerOrganization(): Promise<void> {
    const data = this.formData;
    
    const organizationData = {
      name: data.organizationName,
      email: data.email,
      password: data.password,
      phone: data.phone,
      address: data.address,
      description: data.description,
      organizationType: data.organizationType,
      taxId: data.taxId
    };

    const response = await this.http.post<ApiResponse>(`${environment.apiUrl}/organizations/register`, organizationData).toPromise();
    
    if (response?.success) {
      this.registrationState.setSuccessMessage('¡Registro exitoso! Tu organización ha sido registrada.');
      // Reset form
      this.registrationState.resetForm();
    } else {
      this.registrationState.setErrorMessage(response?.message || 'Error al registrar organización');
    }
  }

  async onLoginSubmit(): Promise<void> {
    this.clearLoginMessages();
    
    if (!this.loginData.email || !this.loginData.password) {
      this.loginErrorMessage = 'Por favor completa todos los campos';
      return;
    }

    this.isLoginLoading = true;

    try {
      // Aquí harías la llamada al backend para autenticar
      const loginRequest = {
        email: this.loginData.email,
        password: this.loginData.password,
        rememberMe: this.loginData.rememberMe
      };

      // Simulación de login (reemplazar con llamada real al backend)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simular éxito de login
      this.loginSuccessMessage = '¡Inicio de sesión exitoso!';
      this.appState.setUser({ email: this.loginData.email, name: 'Usuario' });
      this.appState.goToDashboard();
      
      // Limpiar formulario
      this.loginData = { email: '', password: '', rememberMe: false };
      
    } catch (error) {
      this.loginErrorMessage = 'Error al iniciar sesión. Verifica tus credenciales.';
    } finally {
      this.isLoginLoading = false;
    }
  }


  ngOnDestroy(): void {
    // Desconectar WebSocket al destruir el componente
    this.websocketService.disconnect();
  }

}
