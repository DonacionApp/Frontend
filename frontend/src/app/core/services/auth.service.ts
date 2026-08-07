import { Injectable, Injector } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Observable, throwError, Subject } from 'rxjs';
import { tap, catchError, switchMap, map, startWith } from 'rxjs/operators';
import { WebsocketService } from './websocket.service';
import { NotificationService } from './notification.service';
import { CacheService } from './cache.service';

export type SocialProvider = 'google' | 'microsoft';

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
  private userChangeSignal = new Subject<void>();
  public currentUser$ = this.userChangeSignal.pipe(
    startWith(void 0),
    map(() => this.getCurrentUser()) 
  );
  private readonly TOKEN_STORAGE_KEY = 'token';
  private baseUrl = environment.apiBaseUrl;
  private api=environment.apiBackendUrl;
  private router: Router | null = null;

  constructor(
    private http: HttpClient,
    private websocketService: WebsocketService,
    private notificationService: NotificationService,
    private injector: Injector,
    private cacheService: CacheService
  ) {
    const token = localStorage.getItem(this.TOKEN_STORAGE_KEY);
    const refreshToken = localStorage.getItem('refreshToken');
    const currentUser = this.getCurrentUser();

    if (token) {
      
      const payload = this.decodeToken(token);
      
      if (payload && payload.sub) {
        this.setAccessToken(token);
        
        if (this.isTokenValid(token)) {
          const rawRole = payload.role || payload.roles || payload.rol || 'donor';
          const normalizedRole = this.normalizeRole(rawRole);

          const user: User = {
            id: payload.sub || payload.id || '',
            email: payload.email || '',
            role: normalizedRole,
            name: payload.name || '',
            verified: payload.verified || false
          };
          this.setCurrentUser(user);
        } else {
          if (!currentUser && payload.sub) {
            const rawRole = payload.role || payload.roles || payload.rol || 'donor';
            const normalizedRole = this.normalizeRole(rawRole);

            const user: User = {
              id: payload.sub || payload.id || '',
              email: payload.email || '',
              role: normalizedRole,
              name: payload.name || '',
              verified: payload.verified || false
            };
            this.setCurrentUser(user);
          }
        }
      } else {
        if (!refreshToken) {
          this.clearAuthData();
        }
      }
    } else if (!token && currentUser) {
      this.clearAuthData();
    }
  }
  public getCurrentUser(): User | null {
    try {
      const s = localStorage.getItem('currentUser');
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  }

  public setCurrentUser(user: User | null): void {
    try {
      if (user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
      } else {
        localStorage.removeItem('currentUser');
      }
      this.userChangeSignal.next();
    } catch (e) {
      console.warn('No se pudo persistir currentUser en localStorage:', e);
    }
  }

  setAccessToken(token: string | null): void {
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
    try {
      return localStorage.getItem(this.TOKEN_STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  clearAccessToken(): void {
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

  login(email: string, password: string, captchaToken?: string): Observable<any> {
    const url = `${this.baseUrl}/login`;
    const body: any = { email, password };
    if (captchaToken) {
      body.captchaToken = captchaToken;
    }
    return this.http.post<any>(url, body).pipe(
      tap(res => {
        const token = res.access_token || res.accessToken || res.token;
        const refresh = res.refresh_token || res.refreshToken;
        if (refresh) {
          localStorage.setItem('refreshToken', refresh);
        }
        if (token) {
          this.establishSession(token, res);
        }
      }),
      catchError(err => {
        throw err;
      })
    );
  }

  private establishSession(token: string, res: any = {}): void {
    this.setAccessToken(token);
    this.websocketService.connect(token);
    this.websocketService.connectMessages(token);

    const payload = this.decodeToken(token);
    const rawRole = payload?.role || payload?.roles || payload?.rol || 'donor';
    const normalizedRole = this.normalizeRole(rawRole);
    const user: User = {
      id: payload?.sub || payload?.id || '',
      email: payload?.email || '',
      role: normalizedRole,
      name: payload?.name || '',
      firstLogin: res?.firstLogin || payload?.firstLogin || false,
      isDocumentVerified: res?.isDocumentVerified || payload?.isDocumentVerified || false,
      verified: payload?.verified || res?.verified || false
    };

    // Limpiar caché si es un usuario diferente al anterior
    try {
      const lastUserId = sessionStorage.getItem('lastUserId');
      if (lastUserId && lastUserId !== user.id.toString()) {
        // Usuario diferente, limpiar caché
        this.cacheService.clear();
        console.log('🧹 Caché limpiado debido a cambio de usuario');
      }
      sessionStorage.setItem('lastUserId', user.id.toString());
    } catch (e) {
      console.warn('Error al verificar cambio de usuario:', e);
    }

    this.setCurrentUser(user);
  }

  startSocialLogin(provider: SocialProvider): void {
    if (typeof window === 'undefined') return;
    window.location.href = `${this.baseUrl}/${provider}/login`;
  }

  loginWithSocialToken(token: string, extra: any = {}): boolean {
    if (!token) return false;
    const payload = this.decodeToken(token);
    if (!payload || !payload.sub) {
      console.error('Token social inválido');
      return false;
    }
    this.establishSession(token, extra);
    return true;
  }

  logout(): void {
    // Limpiar caché solo cuando cambia de usuario (no en cada logout)
    const currentUser = this.getCurrentUser();
    if (currentUser) {
      // Guardar el ID del último usuario
      try {
        sessionStorage.setItem('lastUserId', currentUser.id.toString());
      } catch (e) {}
    }
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
        const currentUser = this.getCurrentUser();
        if (currentUser && currentUser.id === (payload.sub || payload.id)) {
          const rawRole = payload.role || payload.roles || payload.rol;
          if (currentUser.role === 'admin' && rawRole && this.normalizeRole(rawRole) !== 'admin') {
            console.warn('[AuthService] updateTokenSilently - Token tiene rol diferente, preservando rol admin del usuario actual');

          } else if (rawRole) {
            const normalizedRole = this.normalizeRole(rawRole);
            if (normalizedRole !== currentUser.role) {
              const updatedUser: User = {
                ...currentUser,
                role: normalizedRole
              };
              this.setCurrentUser(updatedUser);
            }
          }
          
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
      if (current === newRefreshToken) return;

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
    try {
      this.setCurrentUser(null);
    } catch (e) {
      console.warn('No se pudo limpiar currentUser en memoria:', e);
    }

    try {
      this.websocketService.disconnect();
    } catch (e) {}

    try {
      this.notificationService.clearNotifications();
    } catch (e) {
      console.warn('No se pudo limpiar el estado de notificaciones:', e);
    }
    
    // Limpiar el caché cuando se cierra sesión
    this.cacheService.clear();
    console.log('🧹 [AuthService] Caché limpiado al cerrar sesión');
  }

  public forgetCurrentUser(): void {
    try { this.setCurrentUser(null); } catch (e) { console.warn('forgetCurrentUser error', e); }
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

  redirectAfterLogin(): void {
    if (!this.router) {
      this.router = this.injector.get(Router);
    }
    const user = this.currentUserValue;

    if (user?.isDocumentVerified === false) {
      if (user.role === 'organization') {
        this.router?.navigate(['/organization/profile']);
      } else if (user.role === 'donor') {
        this.router?.navigate(['/donor/profile']);
      } else if (user.role === 'admin') {
        this.router?.navigate(['/admin']);
      }
      return;
    }

    if (user?.role === 'admin') {
      this.router?.navigate(['/admin']);
    } else if (user?.role === 'organization') {
      this.router?.navigate(['/organization/dashboard']);
    } else {
      this.router?.navigate(['/donor/profile']);
    }
  }

  get currentUserValue(): User | null {
    return this.getCurrentUser();
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
            const currentUser = this.getCurrentUser();
            const rawRole = payload.role || payload.roles || payload.rol;
            
            console.log('[AuthService] refreshToken - Token payload:', {
              rawRole,
              currentUserRole: currentUser?.role,
              payload: payload
            });
            let normalizedRole: 'donor' | 'organization' | 'admin';
            
            if (currentUser?.role === 'admin') {
              normalizedRole = 'admin';
              console.log('[AuthService] refreshToken - Preservando rol admin del usuario actual');
            } else if (rawRole) {
              normalizedRole = this.normalizeRole(rawRole);
            } else {
              normalizedRole = currentUser?.role || 'donor';
              console.warn('[AuthService] refreshToken - No se encontró rol en el token, usando rol del usuario actual:', normalizedRole);
            }
            
            const user: User = {
              id: payload.sub || payload.id || currentUser?.id || '',
              email: payload.email || currentUser?.email || '',
              role: normalizedRole,
              name: payload.name || currentUser?.name || '',
              verified: payload.verified !== undefined ? payload.verified : (currentUser?.verified || false)
            };
            
            console.log('[AuthService] refreshToken - Usuario actualizado:', { id: user.id, email: user.email, role: user.role });
            this.setCurrentUser(user);
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
                  const currentUser = this.getCurrentUser();
                  const rawRole = payload.role || payload.roles || payload.rol;
                  
                  console.log('[AuthService] refreshToken (fallback) - Token payload:', {
                    rawRole,
                    currentUserRole: currentUser?.role,
                    payload: payload
                  });
                  
                  let normalizedRole: 'donor' | 'organization' | 'admin';
                  
                  if (currentUser?.role === 'admin') {
                    normalizedRole = 'admin';
                    console.log('[AuthService] refreshToken (fallback) - Preservando rol admin del usuario actual');
                  } else if (rawRole) {
                    normalizedRole = this.normalizeRole(rawRole);
                  } else {
                    normalizedRole = currentUser?.role || 'donor';
                    console.warn('[AuthService] refreshToken (fallback) - No se encontró rol en el token, usando rol del usuario actual:', normalizedRole);
                  }
                  
                  const user: User = {
                    id: payload.sub || payload.id || currentUser?.id || '',
                    email: payload.email || currentUser?.email || '',
                    role: normalizedRole,
                    name: payload.name || currentUser?.name || '',
                    verified: payload.verified !== undefined ? payload.verified : (currentUser?.verified || false)
                  };
                  
                  console.log('[AuthService] refreshToken (fallback) - Usuario actualizado:', { id: user.id, email: user.email, role: user.role });
                  this.setCurrentUser(user);
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
              return throwError(() => finalErr);
            })
          );
        }
        
        console.error('Error al refrescar token:', err);
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

  public isTokenValid(token: string): boolean {
    if (!token) return false;
    
    try {
      const payload = this.decodeToken(token);
      if (!payload) return false;
      
      const exp = payload.exp;
      if (!exp) return false;
      
      const currentTime = Math.floor(Date.now() / 1000);
      return exp > currentTime;
    } catch (e) {
      return false;
    }
  }

  public connectWebSocketIfAuthenticated(): void {
    const token = this.getAccessToken();
    if (token && this.isTokenValid(token)) {
      try {
        this.websocketService.connect(token);
        this.websocketService.connectMessages(token);
      } catch (e) {
        console.warn('Error conectando WebSocket:', e);
      }
    }
  }
}