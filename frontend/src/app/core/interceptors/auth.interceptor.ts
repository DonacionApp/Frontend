import { Injectable, Injector } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

  constructor(private injector: Injector) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // No agregar token a peticiones de autenticación (login, refresh, register)
    if (this.isAuthRequest(req.url)) {
      return next.handle(req);
    }

    // Obtener el token desde localStorage
    const token = localStorage.getItem('accessToken');
    
    // Si hay token y la petición es hacia el backend
    if (token && this.isBackendRequest(req.url)) {
      // Clonar la petición y agregar el header de autorización Bearer
      const clonedReq = this.addTokenHeader(req, token);
      
      return next.handle(clonedReq).pipe(
        catchError((error: HttpErrorResponse) => {
          // Si el error es 401 (no autorizado) y no es una petición de login/refresh
          if (error.status === 401 && !this.isAuthRequest(req.url)) {
            return this.handle401Error(req, next);
          }
          
          return throwError(() => error);
        })
      );
    }

    return next.handle(req);
  }

  /**
   * Verificar si la petición es hacia el backend
   */
  private isBackendRequest(url: string): boolean {
    return url.includes('localhost:5000') || url.includes('/auth/') || url.includes('/api/');
  }

  /**
   * Verificar si la petición es de autenticación (login, refresh, etc.)
   */
  private isAuthRequest(url: string): boolean {
    return url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/register');
  }

  /**
   * Agregar el token de autorización al header de la petición
   */
  private addTokenHeader(request: HttpRequest<any>, token: string): HttpRequest<any> {
    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  /**
   * Manejar error 401: intentar refrescar el token
   */
  private handle401Error(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Si no estamos refrescando, iniciar el proceso
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      const authService = this.injector.get(AuthService);
      
      return authService.refreshToken().pipe(
        switchMap((res: any) => {
          this.isRefreshing = false;
          
          // El nuevo token puede venir en la respuesta o en headers
          const newToken = res?.access_token || res?.accessToken || res?.token || 
                          localStorage.getItem('accessToken');
          
          if (newToken) {
            this.refreshTokenSubject.next(newToken);
            // Reintentar la petición original con el nuevo token
            return next.handle(this.addTokenHeader(request, newToken));
          }
          
          // Si no hay token, limpiar y redirigir
          console.error('❌ No se recibió un nuevo token después del refresh');
          authService.logoutAndRedirect();
          return throwError(() => new Error('No se pudo refrescar el token'));
        }),
        catchError((err) => {
          this.isRefreshing = false;
          this.refreshTokenSubject.next(null);
          const authService = this.injector.get(AuthService);
          
          // Verificar si es un error de token expirado o inválido
          const isTokenError = err?.status === 401 || 
                               err?.status === 403 || 
                               err?.status === 400 ||
                               err?.message?.includes('token') ||
                               err?.message?.includes('expired') ||
                               err?.message?.includes('invalid');
          
          if (isTokenError) {
            console.error('❌ Error de autenticación al refrescar token:', err);
            authService.logoutAndRedirect();
          } else {
            // Para otros errores, solo hacer logout sin redirigir (el error se propagará)
            authService.logout();
          }
          
          return throwError(() => err);
        })
      );
    } else {
      // Si ya estamos refrescando, esperar a que termine y usar el nuevo token
      return this.refreshTokenSubject.pipe(
        filter(token => token !== null),
        take(1),
        switchMap((token) => {
          if (token) {
            return next.handle(this.addTokenHeader(request, token));
          } else {
            // Si el token es null, significa que el refresh falló
            const authService = this.injector.get(AuthService);
            authService.logoutAndRedirect();
            return throwError(() => new Error('Token refresh failed'));
          }
        }),
        catchError((err) => {
          // Si hay un error esperando el token, limpiar y redirigir
          const authService = this.injector.get(AuthService);
          authService.logoutAndRedirect();
          return throwError(() => err);
        })
      );
    }
  }
}