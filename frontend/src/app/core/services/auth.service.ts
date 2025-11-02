import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

export interface User {
  id: string;
  email: string;
  role: 'donor' | 'organization' | 'admin';
  name: string;
  username?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private baseUrl = environment.apiBaseUrl; // backend auth base (configurado por environment)
  private api=environment.apiBackendUrl;

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
        const rawRole = payload.role || payload.roles || payload.rol || 'donor';
        const normalizedRole = this.normalizeRole(rawRole);
        
        const user: User = {
          id: payload.sub || payload.id || '',
          email: payload.email || '',
          role: normalizedRole,
          name: payload.name || ''
        };
        this.currentUserSubject.next(user);
      }
    }
  }

  /** Solicitar enlace de recuperación */
  forgotPassword(email: string) {
    const url = `${this.baseUrl}/forgot-password`;
    return this.http.post<any>(url, { email });
  }

  /** Restablecer contraseña usando token recibido por email */
  resetPassword(token: string, password: string) {
    const url = `${this.baseUrl}/reset-password`;
    return this.http.post<any>(url, { token, password });
  }

  /** Verifica/consume el token usando el endpoint de verificación que expone el backend */
  verifyResetToken(code: string) {
    const urlVerify = `${this.baseUrl}/verify-reset-passord-token`;
    return this.http.post<any>(urlVerify, { token: code });
  }

  /** Alternativa: enviar token y nueva contraseña al endpoint que procesa ambos campos */
  resetWithToken(code: string, newPassword: string) {
  const urlVerify = `${this.baseUrl}/verify-reset-passord-token`; // endpoint confirmado por el backend
    const url1 = `${this.baseUrl}/reset-password-token`;
    const url2 = `${this.baseUrl}/reset-password`;

    // Intentamos en este orden, intentando adaptarnos al endpoint que el backend expone:
    // 1) /verify-reset-passsord-token { token, newPassword } (según tu Postman)
    // 2) /reset-password-token { token, newPassword }
    // 3) /reset-password { token, password }
    return this.http.post<any>(urlVerify, { token: code, newPassword }).pipe(
      catchError((err) => {
        // if not found or server error, try next
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

  loadRolesDefault():Observable<any>{
    try {
      return this.http.get<any>(`${this.api}/rol/all/roles`).pipe(
        tap(),
        catchError((error) => {
          console.error('Error fetching default roles:', error);
          return throwError(error);
        })
      );
    } catch (error) {
      return throwError(error);
    }
  }

  loadTypesDni():Observable<any>{
    try {
      return this.http.get<any>(`${this.api}/typedni`).pipe(
        tap(),
        catchError((error) => {
          console.error('Error fetching TypesDni:', error);
          return throwError(error);
        })
      );
    } catch (error) {
      return throwError(error);
    }
  }

  registerUser(userData:any):Observable<any>{
    try {
      return this.http.post<any>(`${this.api}/auth/register`, userData, { headers: { 'Content-Type': 'application/json' } }).pipe(
        tap((data) => console.log('User registered:', data)),
        catchError((error) => {
          console.error('Error registering user:', error);
          return throwError(error);
        })
      );
    } catch (error) {
      return throwError(error);
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
          console.log('🔍 JWT Payload del backend:', payload);
          const rawRole = payload?.role || payload?.roles || payload?.rol || 'donor';
          console.log('🎭 Rol extraído del token:', rawRole);
          const normalizedRole = this.normalizeRole(rawRole);
          console.log('✅ Rol normalizado:', normalizedRole);
          
          const user: User = {
            id: payload?.sub || payload?.id || '',
            email: payload?.email || '',
            role: normalizedRole,
            name: payload?.name || ''
          };
          console.log('👤 Usuario final guardado:', user);
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

  /**
   * Normalizar el rol del backend al formato del frontend
   */
  private normalizeRole(roleName: string): 'donor' | 'organization' | 'admin' {
    console.log('🔄 Normalizando rol recibido del backend:', roleName);
    const normalizedRol = roleName.toLowerCase();
    
    let finalRole: 'donor' | 'organization' | 'admin';
    
    if (normalizedRol === 'donante' || normalizedRol === 'donor' || normalizedRol === 'user') {
      finalRole = 'donor';
    } else if (normalizedRol === 'organizacion' || normalizedRol === 'organization' || normalizedRol === 'org') {
      finalRole = 'organization';
    } else if (normalizedRol === 'admin' || normalizedRol === 'administrador') {
      finalRole = 'admin';
    } else {
      console.warn('⚠️ Rol no reconocido, usando "donor" por defecto. Rol recibido:', roleName);
      finalRole = 'donor';
    }
    
    console.log('✅ Rol normalizado:', finalRole);
    return finalRole;
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