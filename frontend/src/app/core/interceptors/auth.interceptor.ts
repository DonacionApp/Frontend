import { Injectable, Injector } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private lastTokenUpdate = 0;
  private TOKEN_UPDATE_COOLDOWN = 30000;
  private isRefreshing = false;
  private refreshTokenSubject: Observable<any> | null = null;

  constructor(private injector: Injector) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.isAuthRequest(req.url)) {
      return next.handle(req);
    }

    const authService = this.injector.get(AuthService);
    const token = authService.getAccessToken();

    if (this.isBackendRequest(req.url)) {
      const requestToSend = token ? this.addTokenHeader(req, token) : req;

      return next.handle(requestToSend).pipe(
        tap((event: HttpEvent<any>) => {
          if (event.type === 4) {
            this.captureNewToken(event);
          }
        }),
        catchError((error: HttpErrorResponse) => {
          // Si es un error 401 (Unauthorized), intentar refrescar el token
          if (error.status === 401 && !this.isAuthRequest(req.url)) {
            return this.handle401Error(req, next, authService);
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
    const currentUser = authService.getCurrentUser();

    // Si no hay refreshToken o usuario, no intentar refrescar
    if (!refreshToken || !currentUser) {
      // No cerrar sesión automáticamente - dejar que el backend maneje
      return throwError(() => new HttpErrorResponse({
        error: 'No hay refresh token disponible',
        status: 401,
        statusText: 'Unauthorized'
      }));
    }

    // Si ya hay un refresh en progreso, esperar a que termine
    if (this.isRefreshing && this.refreshTokenSubject) {
      return this.refreshTokenSubject.pipe(
        switchMap(() => {
          const newToken = authService.getAccessToken();
          const newRequest = newToken ? this.addTokenHeader(request, newToken) : request;
          return next.handle(newRequest);
        })
      );
    }

    // Iniciar el refresh
    this.isRefreshing = true;
    this.refreshTokenSubject = authService.refreshToken().pipe(
      switchMap((response) => {
        this.isRefreshing = false;
        this.refreshTokenSubject = null;
        
        const newToken = authService.getAccessToken();
        
        if (!newToken) {
          return throwError(() => new Error('No se pudo obtener el nuevo token después del refresh'));
        }

        // Reintentar la petición original con el nuevo token
        const newRequest = this.addTokenHeader(request, newToken);
        return next.handle(newRequest);
      }),
      catchError((err) => {
        this.isRefreshing = false;
        this.refreshTokenSubject = null;
        
        // No cerrar sesión automáticamente - dejar que el componente maneje el error
        // El backend puede retornar un refresh token en la próxima petición exitosa
        return throwError(() => err);
      })
    );

    return this.refreshTokenSubject;
  }

  private captureNewToken(response: any): void {
    if (!response) return;

    const authServiceInstance = this.injector.get(AuthService);
    
    // SOLO capturar tokens si ya hay un usuario autenticado
    // Esto previene que se guarden tokens automáticamente sin que el usuario haya iniciado sesión
    const currentToken = authServiceInstance.getAccessToken();
    const currentUser = authServiceInstance.getCurrentUser();
    
    // Si no hay token ni usuario actual, NO capturar tokens automáticamente
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

    // Verificar que el nuevo token sea diferente al actual
    if (newToken && currentToken === newToken) return;

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

  private addTokenHeader(request: HttpRequest<any>, token: string): HttpRequest<any> {
    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }


}