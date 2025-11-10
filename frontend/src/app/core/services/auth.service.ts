import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, switchMap } from 'rxjs/operators';
import { WebsocketService } from './websocket.service';

export interface User {
  id: string;
  email: string;
  role: 'donor' | 'organization' | 'admin';
  name: string;
  username?: string;
  firstLogin?: boolean;
  isDocumentVerified?: boolean;
  verified?: boolean; // Campo verified del token
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private baseUrl = environment.apiBaseUrl; // backend auth base (configurado por environment)
  private api=environment.apiBackendUrl;

  constructor(private http: HttpClient, private websocketService: WebsocketService) {
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
          name: payload.name || '',
          verified: payload.verified || false
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
          // Conectar WebSocket con el token
          this.websocketService.connect(token);
          console.log('✅ WebSocket conectado después del login');
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
            name: payload?.name || '',
            firstLogin: res.firstLogin || payload?.firstLogin || false,
            isDocumentVerified: res.isDocumentVerified || payload?.isDocumentVerified || false,
            verified: payload?.verified || res.verified || false
          };
          console.log('👤 Usuario final guardado:', user);
          console.log('🎯 firstLogin:', user.firstLogin);
          console.log('📄 isDocumentVerified:', user.isDocumentVerified);
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
    // Desconectar WebSocket
    this.websocketService.disconnect();
    console.log('❌ WebSocket desconectado en logout');
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

  isVerified(): boolean {
    // Los admins siempre están verificados
    if (this.currentUserValue?.role === 'admin') {
      return true;
    }
    return this.currentUserValue?.verified === true || this.currentUserValue?.isDocumentVerified === true;
  }

  canCreatePost(): boolean {
    // Los admins pueden crear posts sin verificación
    if (this.currentUserValue?.role === 'admin') {
      return this.isAuthenticated();
    }
    return this.isAuthenticated() && this.isVerified();
  }

  canRequestDonation(): boolean {
    // Los admins pueden solicitar donaciones sin verificación
    if (this.currentUserValue?.role === 'admin') {
      return this.isAuthenticated();
    }
    return this.isAuthenticated() && this.isVerified();
  }

  canLike(): boolean {
    return this.isAuthenticated(); // Los autenticados pueden dar like, incluso sin verificar
  }

  /**
   * Refrescar el token de acceso usando el refresh token
   * El refresh token puede venir en el body, headers o respuesta del backend
   */
  refreshToken(): Observable<any> {
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!refreshToken) {
      return throwError(() => new Error('No hay refresh token disponible'));
    }

    // Intentar diferentes endpoints según la implementación del backend
    // El refresh token puede enviarse en el body o en headers
    // Intentamos primero en el body (más común)
    const url = `${this.baseUrl}/refresh`;
    
    // Intentar primero con el refresh token en el body
    return this.http.post<any>(url, { refresh_token: refreshToken }, {
      observe: 'response' // Observar la respuesta completa para acceder a headers
    }).pipe(
      switchMap((response) => {
        // El nuevo access token puede venir en:
        // 1. El body de la respuesta (más común)
        // 2. Los headers de la respuesta (x-access-token, authorization, etc.)
        // 3. Ambos (body tiene prioridad)
        
        const body = response.body || {};
        const headers = response.headers;
        
        // Intentar obtener el token del body primero
        let newToken = body.access_token || body.accessToken || body.token;
        
        // Si no está en el body, intentar desde headers
        if (!newToken) {
          newToken = headers.get('x-access-token') || 
                    headers.get('authorization')?.replace('Bearer ', '') ||
                    headers.get('access-token');
        }
        
        // El refresh token también puede venir en el body o headers
        let newRefreshToken = body.refresh_token || body.refreshToken || refreshToken;
        if (!newRefreshToken || newRefreshToken === refreshToken) {
          newRefreshToken = headers.get('x-refresh-token') || 
                          headers.get('refresh-token') || 
                          refreshToken;
        }
        
        if (newToken) {
          localStorage.setItem('accessToken', newToken);
          
          // Actualizar refresh token si viene uno nuevo
          if (newRefreshToken && newRefreshToken !== refreshToken) {
            localStorage.setItem('refreshToken', newRefreshToken);
          }
          
          // Actualizar usuario si viene información en el token
          const payload = this.decodeToken(newToken);
          if (payload) {
            const rawRole = payload.role || payload.roles || payload.rol || 'donor';
            const normalizedRole = this.normalizeRole(rawRole);
            
            const user: User = {
              id: payload.sub || payload.id || '',
              email: payload.email || '',
              role: normalizedRole,
              name: payload.name || '',
              verified: payload.verified || false
            };
            
            localStorage.setItem('currentUser', JSON.stringify(user));
            this.currentUserSubject.next(user);
          }
          
          // Reconectar WebSocket con el nuevo token
          this.websocketService.connect(newToken);
          console.log('✅ Token refrescado y WebSocket reconectado');
          
          // Retornar el body de la respuesta para compatibilidad
          return new Observable(observer => {
            observer.next(body);
            observer.complete();
          });
        }
        
        return throwError(() => new Error('No se recibió un nuevo token'));
      }),
      catchError(err => {
        // Si el refresh falla, intentar con headers si no se intentó antes
        if (err.status === 400 || err.status === 401) {
          // Intentar con refresh token en headers
          return this.http.post<any>(url, {}, {
            headers: {
              'x-refresh-token': refreshToken,
              'refresh-token': refreshToken
            },
            observe: 'response'
          }).pipe(
            switchMap((response) => {
              const body = response.body || {};
              const headers = response.headers;
              
              let newToken = body.access_token || body.accessToken || body.token ||
                            headers.get('x-access-token') || 
                            headers.get('authorization')?.replace('Bearer ', '') ||
                            headers.get('access-token');
              
              if (newToken) {
                localStorage.setItem('accessToken', newToken);
                const payload = this.decodeToken(newToken);
                if (payload) {
                  const rawRole = payload.role || payload.roles || payload.rol || 'donor';
                  const normalizedRole = this.normalizeRole(rawRole);
                  
                  const user: User = {
                    id: payload.sub || payload.id || '',
                    email: payload.email || '',
                    role: normalizedRole,
                    name: payload.name || '',
                    verified: payload.verified || false
                  };
                  
                  localStorage.setItem('currentUser', JSON.stringify(user));
                  this.currentUserSubject.next(user);
                }
                
                this.websocketService.connect(newToken);
                console.log('✅ Token refrescado desde headers y WebSocket reconectado');
                
                return new Observable(observer => {
                  observer.next(body);
                  observer.complete();
                });
              }
              
              return throwError(() => new Error('No se recibió un nuevo token'));
            }),
            catchError(finalErr => {
              // Si el refresh falla completamente, hacer logout
              console.error('Error al refrescar token:', finalErr);
              this.logout();
              return throwError(() => finalErr);
            })
          );
        }
        
        // Si el refresh falla, hacer logout
        console.error('Error al refrescar token:', err);
        this.logout();
        return throwError(() => err);
      })
    );
  }

  /**
   * Normalizar el rol del backend al formato del frontend
   */
  private normalizeRole(roleName: string): 'donor' | 'organization' | 'admin' {
    const normalizedRol = roleName.toLowerCase();
    if (normalizedRol === 'donante' || normalizedRol === 'donor' || normalizedRol === 'user') return 'donor';
    if (normalizedRol === 'organizacion' || normalizedRol === 'organization') return 'organization';
    if (normalizedRol === 'admin' || normalizedRol === 'administrador') return 'admin';
    return 'donor'; // default
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