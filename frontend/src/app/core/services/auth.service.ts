import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

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
  private baseUrl = 'http://localhost:5000/auth'; // backend auth base (ajustable)

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

  login(email: string, password: string): Observable<any> {
    const url = `${this.baseUrl}/login`;
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