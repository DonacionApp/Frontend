import { Injectable, BehaviorSubject } from '@angular/core';
import { Observable } from 'rxjs';

export interface User {
  id?: string;
  email: string;
  name: string;
  type?: 'donor' | 'organization';
}

export type ViewType = 'home' | 'register' | 'login' | 'dashboard';

@Injectable({
  providedIn: 'root'
})
export class AppStateService {
  // Estado de autenticación
  private _isAuthenticated = new BehaviorSubject<boolean>(false);
  private _user = new BehaviorSubject<User | null>(null);
  
  // Estado de navegación
  private _currentView = new BehaviorSubject<ViewType>('home');
  
  // Getters reactivos
  isAuthenticated: Observable<boolean> = this._isAuthenticated.asObservable();
  user: Observable<User | null> = this._user.asObservable();
  currentView: Observable<ViewType> = this._currentView.asObservable();
  
  // Getters síncronos para el template
  get isAuthenticatedValue(): boolean {
    return this._isAuthenticated.value;
  }
  
  get userValue(): User | null {
    return this._user.value;
  }
  
  get currentViewValue(): ViewType {
    return this._currentView.value;
  }
  
  // Computed para vistas específicas
  get isHomeView(): boolean {
    return this._currentView.value === 'home';
  }
  
  get isRegisterView(): boolean {
    return this._currentView.value === 'register';
  }
  
  get isLoginView(): boolean {
    return this._currentView.value === 'login';
  }
  
  get isDashboardView(): boolean {
    return this._currentView.value === 'dashboard';
  }

  constructor() {}

  // Métodos para manejar autenticación
  setUser(user: User): void {
    this._user.next(user);
    this._isAuthenticated.next(true);
  }

  logout(): void {
    this._user.next(null);
    this._isAuthenticated.next(false);
    this._currentView.next('home');
  }

  // Métodos para navegación
  goToHome(): void {
    this._currentView.next('home');
  }

  goToRegister(): void {
    this._currentView.next('register');
  }

  goToLogin(): void {
    this._currentView.next('login');
  }

  goToDashboard(): void {
    this._currentView.next('dashboard');
  }

  setCurrentView(view: ViewType): void {
    this._currentView.next(view);
  }
}
