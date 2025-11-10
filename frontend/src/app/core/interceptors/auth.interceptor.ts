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

    const token = localStorage.getItem('accessToken');
    
    if (token && this.isBackendRequest(req.url)) {
      const clonedReq = this.addTokenHeader(req, token);
      
      return next.handle(clonedReq).pipe(
        tap((event: HttpEvent<any>) => {
          if (event.type === 4) {
            this.captureNewToken(event);
          }
        }),
        catchError((error: HttpErrorResponse) => {
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
    if (!response || !response.headers) return;
    
    const newToken = response.headers.get('X-New-Token') || response.headers.get('x-new-token');
    
    if (!newToken) return;
    
    const currentToken = localStorage.getItem('accessToken');
    
    if (currentToken === newToken) return;
    
    const now = Date.now();
    const isInCooldown = now - this.lastTokenUpdate < this.TOKEN_UPDATE_COOLDOWN;
    
    const isSignificant = currentToken ? this.isSignificantTokenChange(currentToken, newToken) : true;
    
    if (isInCooldown && !isSignificant) {
      return;
    }
    
    if (!isSignificant) {
      return;
    }
    
    localStorage.setItem('accessToken', newToken);
    this.lastTokenUpdate = now;
    
    if (response.body?.refreshToken) {
      localStorage.setItem('refreshToken', response.body.refreshToken);
    }
    
    try {
      const authService = this.injector.get(AuthService);
      authService.updateTokenSilently(newToken);
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
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      const authService = this.injector.get(AuthService);
      
      return authService.refreshToken().pipe(
        switchMap((res: any) => {
          this.isRefreshing = false;
          
          const newToken = res?.access_token || res?.accessToken || res?.token || 
                          localStorage.getItem('accessToken');
          
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
          const authService = this.injector.get(AuthService);
          
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
            const authService = this.injector.get(AuthService);
            authService.logoutAndRedirect();
            return throwError(() => new Error('Token refresh failed'));
          }
        }),
        catchError((err) => {
          const authService = this.injector.get(AuthService);
          authService.logoutAndRedirect();
          return throwError(() => err);
        })
      );
    }
  }
}