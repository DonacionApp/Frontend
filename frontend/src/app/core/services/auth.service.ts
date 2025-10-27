import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface User {
  id: string;
  email: string;
  role: 'donor' | 'organization' | 'admin';
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {
    // Verificar si hay un usuario en localStorage al iniciar
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      this.currentUserSubject.next(JSON.parse(savedUser));
    }
    // Cargar token si existe
    const token = localStorage.getItem('accessToken');
    if (token) {
      const payload = this.decodeToken(token);
      if (payload) {
        const user: User = {
          id: payload.sub || payload.id || '',
          email: payload.email || '',
          role: (payload.role || payload.roles || 'donor') as User['role'],
          name: payload.name || ''
        };
        this.currentUserSubject.next(user);
      }
    }
  }

  // Funcionalidades de registro y verificación de email (nueva funcionalidad)
  register(userData: any): Observable<User> {
    return this.http.post<User>(`${environment.apiUrl}/auth/register`, userData);
  }

  verifyEmail(token: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/verify-email`, { token });
  }

  // Funcionalidades de login y autenticación (de la rama principal)
  login(email: string, password: string): Observable<any> {
    const url = `${this.baseUrl}/auth/login`;
    return this.http.post<any>(url, { email, password }).pipe(
      tap(res => {
        // Si backend entrega access_token (o accessToken), guardarlo
        const token = res.access_token || res.accessToken || res.token;
        const refresh = res.refresh_token || res.refreshToken;
        if (token) {
          localStorage.setItem('accessToken', token);
        }
        if (refresh) {
          localStorage.setItem('refreshToken', refresh);
        }

        // Decodificar token para extraer user
        if (token) {
          const payload = this.decodeToken(token);
          const user: User = {
            id: payload?.sub || payload?.id || '',
            email: payload?.email || '',
            role: (payload?.role || payload?.roles || 'donor') as User['role'],
            name: payload?.name || ''
          };
          localStorage.setItem('currentUser', JSON.stringify(user));
          this.currentUserSubject.next(user);
        }
      }),
      catchError(err => {
        // Pasar el error hacia el componente
        throw err;
      })
    );
  }

  logout(): void {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    this.currentUserSubject.next(null);
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return !!this.currentUserValue;
  }

  hasRole(role: string): boolean {
    return this.currentUserValue?.role === role;
  }

  // Funcionalidades de recuperación de contraseña (de la rama principal)
  forgotPassword(email: string) {
    const url = `${this.baseUrl}/auth/forgot-password`;
    return this.http.post<any>(url, { email });
  }

  resetPassword(token: string, password: string) {
    const url = `${this.baseUrl}/auth/reset-password`;
    return this.http.post<any>(url, { token, password });
  }

  verifyResetToken(code: string) {
    const urlVerify = `${this.baseUrl}/auth/verify-reset-passord-token`;
    return this.http.post<any>(urlVerify, { token: code });
  }

  resetWithToken(code: string, newPassword: string) {
    const urlVerify = `${this.baseUrl}/auth/verify-reset-passord-token`;
    const url1 = `${this.baseUrl}/auth/reset-password-token`;
    const url2 = `${this.baseUrl}/auth/reset-password`;

    return this.http.post<any>(urlVerify, { token: code, newPassword }).pipe(
      catchError((err) => {
        if (err?.status === 404 || err?.status === 500) {
          return this.http.post<any>(url1, { token: code, newPassword }).pipe(
            catchError((err2) => {
              if (err2?.status === 404 || err2?.status === 500) {
                return this.http.post<any>(url2, { token: code, password: newPassword });
              }
              throw err2;
            })
          );
        }
        throw err;
      })
    );
  }

  private decodeToken(token: string): any | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = parts[1];
      // Base64 url -> base64
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }
}