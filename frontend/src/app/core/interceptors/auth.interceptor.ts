import { Injectable, Injector } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take, tap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);
  private lastTokenUpdate = 0;
  private TOKEN_UPDATE_COOLDOWN = 30000;

  constructor(private injector: Injector) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.isAuthRequest(req.url)) {
      return next.handle(req);
    }

    const authService = this.injector.get(AuthService);
    const token = authService.getAccessToken();

    // Si es una request al backend, queremos interceptar la respuesta para capturar
    // tokens que el servidor pueda devolver incluso si no tenemos token en memoria.
    if (this.isBackendRequest(req.url)) {
      const requestToSend = token ? this.addTokenHeader(req, token) : req;

      return next.handle(requestToSend).pipe(
        tap((event: HttpEvent<any>) => {
          if (event.type === 4) {
            this.captureNewToken(event);
          }
        }),
        catchError((error: HttpErrorResponse) => {
          // Intentar capturar token incluso desde respuestas de error
          this.captureNewToken(error);

          if (error.status === 401 && !this.isAuthRequest(req.url)) {
            return this.handle401Error(req, next);
          }

          return throwError(() => error);
        })
      );
    }

    return next.handle(req);
  }

  private captureNewToken(response: any): void {
    if (!response) return;

    // Helper to safely read headers
    const getHeader = (name: string) => {
      try {
        return response.headers?.get?.(name) || response.headers?.get?.(name.toLowerCase()) || null;
      } catch (e) {
        return null;
      }
    };

    // Preferir token en headers (el backend ahora envía el nuevo token únicamente por headers)
    const newToken: string | null = getHeader('X-New-Token');

    // También soportar un header opcional para refresh token si el backend lo proporciona
    const newRefreshToken: string | null = getHeader('X-New-Refresh-Token') || getHeader('X-New-Refresh');

    if (!newToken && !newRefreshToken) return;

  const authServiceInstance = this.injector.get(AuthService);
  const currentToken = authServiceInstance.getAccessToken();
  if (newToken && currentToken === newToken) return;

    const now = Date.now();
    const isInCooldown = now - this.lastTokenUpdate < this.TOKEN_UPDATE_COOLDOWN;
  const isSignificant = currentToken ? (newToken ? this.isSignificantTokenChange(currentToken, newToken) : true) : true;

    if ((isInCooldown && !isSignificant) || !isSignificant) {
      return;
    }

    try {
      authServiceInstance.setAccessToken(newToken);
      this.lastTokenUpdate = now;
    } catch (e) {
      console.error('No se pudo actualizar accessToken en memoria:', e);
    }

    // Si hay nuevo refresh token en headers, guardarlo silenciosamente
    if (newRefreshToken) {
      try {
        authServiceInstance.updateRefreshTokenSilently(newRefreshToken);
      } catch (e) {
        try {
          localStorage.setItem('refreshToken', newRefreshToken);
        } catch (inner) {
          console.error('No se pudo guardar refreshToken:', inner);
        }
      }
    }

    try {
      // Notificar al servicio de auth para que actualice estado sin forzar un refresh-http
      if (newToken) {
        authServiceInstance.updateTokenSilently(newToken);
      }
    } catch (error) {
      console.error('Error notificando cambio de token:', error);
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

  private handle401Error(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const authService = this.injector.get(AuthService);

    // Si ya se capturó un nuevo access token (por ejemplo el backend lo devolvió
    // en la respuesta de error), usarlo y reintentar la petición sin intentar
    // un refresh adicional.
    const capturedToken = authService.getAccessToken();
    if (capturedToken) {
      // Reintentar inmediatamente con el token capturado
      this.refreshTokenSubject.next(capturedToken);
      return next.handle(this.addTokenHeader(request, capturedToken));
    }

    // Si no hay token capturado, comprobar si existe refreshToken persistente.
    // Si no existe, forzar logout (no podemos refrescar).
    const storedRefresh = localStorage.getItem('refreshToken');
    if (!storedRefresh) {
      // No hay refresh token persistente: no forzamos un redirect automático aquí.
      // Dejar que el llamador maneje la 401 (por ejemplo mostrar login o intentar acción alternativa).
      console.warn('No hay refreshToken almacenado y no se capturó token: no se intentará refresh automático');
      return throwError(() => new Error('No refresh token available'));
    }

    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return authService.refreshToken().pipe(
        switchMap((res: any) => {
          this.isRefreshing = false;

          const newToken = res?.access_token || res?.accessToken || res?.token || 
                          authService.getAccessToken();

          if (newToken) {
            this.refreshTokenSubject.next(newToken);
            return next.handle(this.addTokenHeader(request, newToken));
          }

          console.error('No se recibió un nuevo token después del refresh');
          authService.logoutAndRedirect();
          return throwError(() => new Error('No se pudo refrescar el token'));
        }),
        catchError((err) => {
          this.isRefreshing = false;
          this.refreshTokenSubject.next(null);

          const isTokenError = err?.status === 401 || 
                               err?.status === 403 || 
                               err?.status === 400 ||
                               err?.message?.includes('token') ||
                               err?.message?.includes('expired') ||
                               err?.message?.includes('invalid');

          if (isTokenError) {
            console.error('Error de autenticación al refrescar token:', err);
            authService.logoutAndRedirect();
          } else {
            authService.logout();
          }

          return throwError(() => err);
        })
      );
    } else {
      return this.refreshTokenSubject.pipe(
        filter(token => token !== null),
        take(1),
        switchMap((token) => {
          if (token) {
            return next.handle(this.addTokenHeader(request, token));
          } else {
            authService.logoutAndRedirect();
            return throwError(() => new Error('Token refresh failed'));
          }
        }),
        catchError((err) => {
          authService.logoutAndRedirect();
          return throwError(() => err);
        })
      );
    }
  }
}