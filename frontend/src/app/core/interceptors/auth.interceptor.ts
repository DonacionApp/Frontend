import { Injectable, Injector } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { RateLimitService } from '../services/rate-limit.service';
import { ToastService } from '../services/toast.service';
import { environment } from '../../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private lastTokenUpdate = 0;
  private TOKEN_UPDATE_COOLDOWN = 30000;
  private isRefreshing = false;
  private refreshTokenSubject: Observable<any> | null = null;

  constructor(
    private injector: Injector,
    private rateLimitService: RateLimitService,
    private toastService: ToastService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Permitir peticiones de autenticación y endpoints públicos sin token
    if (this.isAuthRequest(req.url) || this.isPublicRequest(req.url)) {
      return next.handle(req);
    }

    const authService = this.injector.get(AuthService);
    const token = authService.getAccessToken();
    const currentUser = authService.getCurrentUser();
    if (token && currentUser) {
      const tokenPayload = this.decodeToken(token);
      if (tokenPayload) {
        const tokenUserId = tokenPayload.sub || tokenPayload.id || '';
        const currentUserId = currentUser.id || '';
        
        if (tokenUserId && currentUserId && tokenUserId !== currentUserId) {
          console.error('🚨 CRÍTICO: El token corresponde a un usuario diferente. Token userId:', tokenUserId, 'Current userId:', currentUserId);

        }
      }
    }

    if (this.isBackendRequest(req.url)) {
      const requestToSend = token ? this.addTokenHeader(req, token) : req;

      return next.handle(requestToSend).pipe(
        tap((event: HttpEvent<any>) => {
          if (event.type === 4) {
            // Capturar nuevo token del header X-New-Token si el backend lo refrescó automáticamente
            this.captureNewToken(event);
          }
        }),
        catchError((error: HttpErrorResponse) => {
          
          if (error.status === 401) {
            const newToken = error.headers?.get('X-New-Token') || error.headers?.get('x-new-token');
            if (newToken) {
              this.captureNewToken({ headers: error.headers });
              const retryRequest = this.addTokenHeader(req, newToken);
              return next.handle(retryRequest);
            }
            
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken && !this.isAuthRequest(req.url)) {
              return this.handle401Error(req, next, authService);
            }
            
            return throwError(() => error);
          }
          
          if (error.status === 429) {
            return this.handle429Error(error);
          }
          
          return throwError(() => error);
        })
      );
    }

    return next.handle(req);
  }

  private handle401Error(
    request: HttpRequest<any>,
    next: HttpHandler,
    authService: AuthService
  ): Observable<HttpEvent<any>> {
    const refreshToken = localStorage.getItem('refreshToken');

    if (!refreshToken) {
      return throwError(() => new HttpErrorResponse({
        error: 'No hay refresh token disponible',
        status: 401,
        statusText: 'Unauthorized'
      }));
    }

    if (this.isRefreshing && this.refreshTokenSubject) {
      return this.refreshTokenSubject.pipe(
        switchMap(() => {
          const newToken = authService.getAccessToken();
          const newRequest = newToken ? this.addTokenHeader(request, newToken) : request;
          return next.handle(newRequest);
        })
      );
    }

    this.isRefreshing = true;
    this.refreshTokenSubject = authService.refreshToken().pipe(
      switchMap((response) => {
        this.isRefreshing = false;
        this.refreshTokenSubject = null;
        
        const newToken = authService.getAccessToken();
        
        if (!newToken) {
          return throwError(() => new Error('No se pudo obtener el nuevo token después del refresh'));
        }

        const newRequest = this.addTokenHeader(request, newToken);
        return next.handle(newRequest);
      }),
      catchError((err) => {
        this.isRefreshing = false;
        this.refreshTokenSubject = null;
        
        if (err.status === 401 || err.status === 403) {
          this.handleSessionProblem(err);
        }
        
        return throwError(() => err);
      })
    );

    return this.refreshTokenSubject;
  }

  private captureNewToken(response: any): void {
    if (!response) return;

    const authServiceInstance = this.injector.get(AuthService);
    
    const currentToken = authServiceInstance.getAccessToken();
    const currentUser = authServiceInstance.getCurrentUser();
    
    if (!currentToken || !currentUser) {
      return;
    }

    const getHeader = (name: string) => {
      try {
        return response.headers?.get?.(name) || response.headers?.get?.(name.toLowerCase()) || null;
      } catch (e) {
        return null;
      }
    };

    const newToken: string | null = getHeader('X-New-Token');
    const newRefreshToken: string | null = getHeader('X-New-Refresh-Token') || getHeader('X-New-Refresh');

    if (!newToken && !newRefreshToken) return;

    if (newToken && currentToken === newToken) return;

    if (newToken) {
      const currentTokenPayload = this.decodeToken(currentToken);
      const newTokenPayload = this.decodeToken(newToken);
      const currentUserId = currentTokenPayload?.sub || currentTokenPayload?.id || currentUser.id;
      const newUserId = newTokenPayload?.sub || newTokenPayload?.id;
      if (newUserId && currentUserId && newUserId !== currentUserId) {
        console.error('🚨 CRÍTICO: [AuthInterceptor] El nuevo token es de un usuario diferente. No se actualizará.');
        console.error('🚨 Usuario actual:', currentUserId, 'Usuario del nuevo token:', newUserId);
        return;
      }
    }

    const debugFlag = (environment as any)['debugWs'] || (environment as any)['debug'] || false;
    if (debugFlag) {
      try {
        console.debug('[AuthInterceptor] captureNewToken - headers checked, newTokenPresent:', !!newToken, 'newRefreshPresent:', !!newRefreshToken);
        if (newToken) {
          try { console.debug('[AuthInterceptor] captureNewToken - decoded newToken payload:', this.decodeToken(newToken)); } catch (e) {}
        }
      } catch (e) {}
    }

    const now = Date.now();
    const isInCooldown = now - this.lastTokenUpdate < this.TOKEN_UPDATE_COOLDOWN;
    const isSignificant = newToken ? this.isSignificantTokenChange(currentToken, newToken) : true;

    if ((isInCooldown && !isSignificant) || !isSignificant) {
      return;
    }

    try {
      if (newToken) {
        authServiceInstance.setAccessToken(newToken);
        this.lastTokenUpdate = now;
        authServiceInstance.updateTokenSilently(newToken);
      }
    } catch (e) {
      console.error('No se pudo actualizar accessToken:', e);
    }

    if (newRefreshToken) {
      try {
        authServiceInstance.updateRefreshTokenSilently(newRefreshToken);
      } catch (e) {
        console.error('No se pudo guardar refreshToken:', e);
      }
    }
  }
  
  private isSignificantTokenChange(oldToken: string, newToken: string): boolean {
    try {
      const oldPayload = this.decodeToken(oldToken);
      const newPayload = this.decodeToken(newToken);
      
      if (!oldPayload || !newPayload) {
        return true;
      }
      
      if (oldPayload.sub !== newPayload.sub) {
        return true;
      }
      
      const oldExp = oldPayload.exp || 0;
      const newExp = newPayload.exp || 0;
      const expDiff = Math.abs(newExp - oldExp);
      
      return expDiff > 60;
      
    } catch (error) {
      return true;
    }
  }
  
  private decodeToken(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      return null;
    }
  }

  private isBackendRequest(url: string): boolean {
    return url.includes('localhost:5000') || url.includes('/auth/') || url.includes('/api/');
  }

  private isAuthRequest(url: string): boolean {
    return url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/register');
  }

  private isPublicRequest(url: string): boolean {
    // Endpoints públicos que no requieren autenticación
    return url.includes('/statistics/public') || 
           url.includes('/user/minimal/all/organizations');
  }

  private addTokenHeader(request: HttpRequest<any>, token: string): HttpRequest<any> {
    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  private handle429Error(error: HttpErrorResponse): Observable<never> {
    const retryAfterHeader = error.headers?.get('Retry-After') || 
                            error.headers?.get('retry-after') ||
                            undefined;
    
    this.rateLimitService.setBlock(retryAfterHeader || undefined, 60);
    
    const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
    const minutes = Math.ceil(retryAfter / 60);
    
    this.toastService.error(
      'Demasiadas solicitudes',
      `Has excedido el límite de solicitudes. Por favor, espera ${minutes} minuto${minutes > 1 ? 's' : ''} antes de intentar nuevamente.`
    );
    
    return throwError(() => error);
  }

  private handleSessionProblem(error: HttpErrorResponse): void {
    const authService = this.injector.get(AuthService);
    const message = error.error?.message || error.message || 'Tu sesión ha expirado o no es válida.';
    
    this.toastService.error(
      'Problema de sesión',
      message + ' Por favor, inicia sesión nuevamente.'
    );
    
    setTimeout(() => {
      authService.logoutAndRedirect();
    }, 2000);
  }
}