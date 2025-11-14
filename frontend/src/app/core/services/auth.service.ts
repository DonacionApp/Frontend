import { Injectable, Injector } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, switchMap } from 'rxjs/operators';
import { WebsocketService } from './websocket.service';
import { NotificationService } from './notification.service';

export interface User {
  id: string;
  email: string;
  role: 'donor' | 'organization' | 'admin';
  name: string;
  username?: string;
  firstLogin?: boolean;
  isDocumentVerified?: boolean;
  verified?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private accessTokenSubject = new BehaviorSubject<string | null>(null);
  public accessToken$ = this.accessTokenSubject.asObservable();
  private readonly TOKEN_STORAGE_KEY = 'token';
  private baseUrl = environment.apiBaseUrl;
  private api=environment.apiBackendUrl;
  private router: Router | null = null;

  constructor(
    private http: HttpClient, 
    private websocketService: WebsocketService,
    private notificationService: NotificationService,
    private injector: Injector
  ) {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      this.currentUserSubject.next(JSON.parse(savedUser));
    }
    const token = localStorage.getItem(this.TOKEN_STORAGE_KEY);
    if (token) {
      this.setAccessToken(token);
      try {
        this.websocketService.connect(token);
        this.websocketService.connectMessages(token);
      } catch (e) {}
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

  setAccessToken(token: string | null): void {
    this.accessTokenSubject.next(token);
    try {
      if (token) {
        localStorage.setItem(this.TOKEN_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(this.TOKEN_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('No se pudo persistir token en localStorage:', e);
    }
  }

  getAccessToken(): string | null {
    const storage = localStorage.getItem(this.TOKEN_STORAGE_KEY);
    return storage;
  }

  clearAccessToken(): void {
    this.accessTokenSubject.next(null);
    try { localStorage.removeItem(this.TOKEN_STORAGE_KEY); } catch(e) {}
  }

  forgotPassword(email: string) {
    const url = `${this.baseUrl}/forgot-password`;
    return this.http.post<any>(url, { email });
  }

  resetPassword(token: string, password: string) {
    const url = `${this.baseUrl}/reset-password`;
    return this.http.post<any>(url, { token, password });
  }

  verifyResetToken(code: string) {
    const urlVerify = `${this.baseUrl}/verify-reset-passord-token`;
    return this.http.post<any>(urlVerify, { token: code });
  }

  resetWithToken(code: string, newPassword: string) {
  const urlVerify = `${this.baseUrl}/verify-reset-passord-token`;
    const url1 = `${this.baseUrl}/reset-password-token`;
    const url2 = `${this.baseUrl}/reset-password`;

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
          tap(() => {}),
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
        const token = res.access_token || res.accessToken || res.token;
        const refresh = res.refresh_token || res.refreshToken;
        if (token) {
          this.setAccessToken(token);
          this.websocketService.connect(token);
          this.websocketService.connectMessages(token);
        }
        if (refresh) {
          localStorage.setItem('refreshToken', refresh);
        }

          if (token) {
          const payload = this.decodeToken(token);
          const rawRole = payload?.role || payload?.roles || payload?.rol || 'donor';
          const normalizedRole = this.normalizeRole(rawRole);
          const user: User = {
            id: payload?.sub || payload?.id || '',
            email: payload?.email || '',
            role: normalizedRole,
            name: payload?.name || '',
            firstLogin: res.firstLogin || payload?.firstLogin || false,
            isDocumentVerified: res.isDocumentVerified || payload?.isDocumentVerified || false,
            verified: payload?.verified || res.verified || false
          };
          localStorage.setItem('currentUser', JSON.stringify(user));
          this.currentUserSubject.next(user);
        }
      }),
      catchError(err => {
        throw err;
      })
    );
  }

  logout(): void {
    this.clearAuthData();
  }

  updateTokenSilently(newToken: string): void {
    try {
      this.setAccessToken(newToken);
      const payload = this.decodeToken(newToken);
      if ((environment as any)['debugWs'] || (environment as any)['debug']) {
        try { console.debug('[AuthService] updateTokenSilently - newToken payload:', payload); } catch (e) {}
      }
      if (payload) {
        const currentUser = this.currentUserSubject.value;
        if (currentUser && currentUser.id === (payload.sub || payload.id)) {
          if (this.websocketService) {
            if ((environment as any)['debugWs'] || (environment as any)['debug']) {
              try { console.debug('[AuthService] updateTokenSilently - reconnecting websockets with refreshed token'); } catch (e) {}
            }
            this.websocketService.reconnectWithNewToken(newToken);
          }
        }
      }
    } catch (error) {
      console.error('Error actualizando token silenciosamente:', error);
    }
  }

  updateRefreshTokenSilently(newRefreshToken: string): void {
    try {
      if (!newRefreshToken) return;
      const current = localStorage.getItem('refreshToken');
      if (current === newRefreshToken) return; // no hay cambio

      if ((environment as any)['debugWs'] || (environment as any)['debug']) {
        try { console.debug('[AuthService] updateRefreshTokenSilently - oldRefresh:', !!current, 'newRefresh:', !!newRefreshToken); } catch (e) {}
      }

      localStorage.setItem('refreshToken', newRefreshToken);


      const access = this.getAccessToken();
      if (access) {
        try {
          this.websocketService.reconnectWithNewToken(access);
          try {
            this.notificationService.getMyNotifications().subscribe({ next: () => {}, error: () => {} });
          } catch (e) {
            console.warn('No se pudo recargar notificaciones tras actualizar refreshToken:', e);
          }
        } catch (e) {
          console.warn('Error reconectando WebSocket tras refreshToken:', e);
        }
      }
    } catch (error) {
      console.error('Error en updateRefreshTokenSilently:', error);
    }
  }

  private clearAuthData(): void {
    localStorage.removeItem('currentUser');
    this.clearAccessToken();
    localStorage.removeItem('refreshToken');
    
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('token') || key.includes('auth') || key.includes('user'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    this.currentUserSubject.next(null);
    
  this.websocketService.disconnect();
  }

  logoutAndRedirect(): void {
    this.clearAuthData();
    
    if (!this.router) {
      this.router = this.injector.get(Router);
    }
    this.router?.navigate(['/auth/login'], {
      queryParams: { 
        expired: 'true',
        message: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
      }
    });
    
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
    if (this.currentUserValue?.role === 'admin') {
      return true;
    }
    return this.currentUserValue?.verified === true || this.currentUserValue?.isDocumentVerified === true;
  }

  canCreatePost(): boolean {
    if (this.currentUserValue?.role === 'admin') {
      return this.isAuthenticated();
    }
    return this.isAuthenticated() && this.isVerified();
  }

  canRequestDonation(): boolean {
    if (this.currentUserValue?.role === 'admin') {
      return this.isAuthenticated();
    }
    return this.isAuthenticated() && this.isVerified();
  }

  canLike(): boolean {
    return this.isAuthenticated(); 
  }

  refreshToken(): Observable<any> {
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!refreshToken) {
      console.warn('⚠️ No hay refresh token disponible');
      this.logoutAndRedirect();
      return throwError(() => new Error('No hay refresh token disponible'));
    }
    const url = `${this.baseUrl}/refresh`;
    
    if ((environment as any)['debugWs'] || (environment as any)['debug']) {
      try {
        console.debug('[AuthService] refreshToken - refreshToken present:', !!refreshToken, 'localStorage.tokenExists:', !!localStorage.getItem(this.TOKEN_STORAGE_KEY));
      } catch (e) {}
    }
    return this.http.post<any>(url, { refresh_token: refreshToken }, {
      observe: 'response' 
    }).pipe(
      switchMap((response) => {
        
        
        const body = response.body || {};
        const headers = response.headers;
        
       
        let newToken = body.access_token || body.accessToken || body.token;
        
       
        if (!newToken) {
          newToken = headers.get('x-access-token') || 
                    headers.get('authorization')?.replace('Bearer ', '') ||
                    headers.get('access-token');
        }
        
       
        let newRefreshToken = body.refresh_token || body.refreshToken || refreshToken;
        if (!newRefreshToken || newRefreshToken === refreshToken) {
          newRefreshToken = headers.get('x-refresh-token') || 
                          headers.get('refresh-token') || 
                          refreshToken;
        }
        
        if (newToken) {
          if ((environment as any)['debugWs'] || (environment as any)['debug']) {
            try {
              const p = this.decodeToken(newToken);
              console.debug('[AuthService] refreshToken - received newToken payload:', p);
            } catch (e) {}
          }
          
          this.setAccessToken(newToken);
          
          
          if (newRefreshToken && newRefreshToken !== refreshToken) {
            localStorage.setItem('refreshToken', newRefreshToken);
          }
          
          
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
          
         
          return new Observable(observer => {
            observer.next(body);
            observer.complete();
          });
        }
        
        return throwError(() => new Error('No se recibió un nuevo token'));
      }),
      catchError(err => {
        
        if (err.status === 400 || err.status === 401) {
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
          this.setAccessToken(newToken);
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
                
                return new Observable(observer => {
                  observer.next(body);
                  observer.complete();
                });
              }
              
              return throwError(() => new Error('No se recibió un nuevo token'));
            }),
            catchError(finalErr => {
              console.error('Error al refrescar token (intento con headers):', finalErr);
              this.logoutAndRedirect();
              return throwError(() => finalErr);
            })
          );
        }
        
        console.error('Error al refrescar token:', err);
        this.logoutAndRedirect();
        return throwError(() => err);
      })
    );
  }

  private normalizeRole(roleName: string): 'donor' | 'organization' | 'admin' {
    const normalizedRol = roleName.toLowerCase();
    if (normalizedRol === 'donante' || normalizedRol === 'donor' || normalizedRol === 'user') return 'donor';
    if (normalizedRol === 'organizacion' || normalizedRol === 'organization') return 'organization';
    if (normalizedRol === 'admin' || normalizedRol === 'administrador') return 'admin';
    return 'donor';
  }

  private decodeToken(token: string): any | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = parts[1];
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