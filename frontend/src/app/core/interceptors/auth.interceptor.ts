import { Injectable, Injector } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(
    private injector: Injector,
    private router: Router
  ) {}
  
  /**
   * Verificar si el token JWT está expirado
   */
  private isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;
      
      const payload = parts[1];
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      const decoded = JSON.parse(json);
      
      // Verificar expiración (exp está en segundos)
      if (decoded.exp) {
        const expirationDate = new Date(decoded.exp * 1000);
        const now = new Date();
        const isExpired = expirationDate < now;
        
        if (isExpired) {
          console.warn('⏰ Token expirado:', {
            expira: expirationDate.toISOString(),
            ahora: now.toISOString()
          });
        }
        
        return isExpired;
      }
      
      return false; // Si no tiene exp, asumimos que no expira
    } catch (e) {
      console.error('❌ Error al decodificar token:', e);
      return true;
    }
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Obtener el token desde localStorage
    const token = localStorage.getItem('accessToken');
    
    // Verificar si la petición es hacia el backend (más flexible)
    const isBackendRequest = req.url.includes('localhost:5000') || 
                             req.url.includes('5000') || 
                             req.url.includes('/auth/') || 
                             req.url.includes('/api/') ||
                             req.url.includes('/post/');
    
    // Log para debug
    if (isBackendRequest) {
      console.log('🔐 AuthInterceptor - Petición al backend detectada');
      console.log('  URL:', req.url);
      console.log('  Método:', req.method);
      console.log('  Token encontrado:', token ? '✅ SÍ' : '❌ NO');
      
      if (token) {
        console.log('  Token (primeros 20 chars):', token.substring(0, 20) + '...');
        
        // Verificar si el token está expirado
        const expired = this.isTokenExpired(token);
        if (expired) {
          console.error('❌ Token EXPIRADO - La petición fallará con 401');
          console.warn('💡 Solución: Cierra sesión y vuelve a iniciar sesión');
        } else {
          console.log('✅ Token válido (no expirado)');
        }
      }
    }
    
    // Si hay token y la petición es hacia el backend
    if (token && isBackendRequest) {
      // Verificar si está expirado
      if (this.isTokenExpired(token)) {
        console.error('🚫 Token expirado - Limpiando y redirigiendo al login');
        // Limpiar token expirado inmediatamente
        this.handleTokenExpired();
        // Retornar error para que el componente sepa que no puede continuar
        return throwError(() => new HttpErrorResponse({
          status: 401,
          statusText: 'Unauthorized',
          error: { message: 'Token expirado' }
        }));
      }
      
      // Clonar la petición y agregar el header de autorización Bearer
      const clonedReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log('✅ Token agregado al header Authorization');
      return next.handle(clonedReq).pipe(
        catchError((error: HttpErrorResponse) => {
          // Manejar error 401 (token expirado o inválido)
          if (error.status === 401) {
            console.error('🚫 Error 401: Token expirado o inválido');
            this.handleTokenExpired();
            return throwError(() => error);
          }
          return throwError(() => error);
        })
      );
    }
    
    if (isBackendRequest && !token) {
      console.warn('⚠️ Petición al backend sin token - Se enviará sin autenticación');
      console.warn('💡 Esto causará un error 401 si el endpoint requiere autenticación');
    }

    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        // Manejar error 401 incluso si no había token
        if (error.status === 401 && isBackendRequest) {
          console.error('🚫 Error 401: No autorizado');
          // Solo redirigir si realmente hay un token expirado
          const existingToken = localStorage.getItem('accessToken');
          if (existingToken) {
            this.handleTokenExpired();
          }
        }
        return throwError(() => error);
      })
    );
  }

  /**
   * Manejar token expirado: limpiar datos y redirigir al login
   */
  private handleTokenExpired(): void {
    console.warn('🔄 Token expirado - Limpiando sesión y redirigiendo al login...');
    
    // Obtener AuthService para hacer logout correctamente
    try {
      const authService = this.injector.get(AuthService);
      authService.logout();
    } catch (e) {
      // Si no se puede obtener el servicio, limpiar manualmente
      console.warn('⚠️ No se pudo obtener AuthService, limpiando manualmente');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('currentUser');
    }
    
    // Redirigir al login
    console.log('🔐 Redirigiendo al login...');
    this.router.navigate(['/auth/login'], {
      queryParams: {
        expired: 'true',
        message: 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.'
      }
    });
  }
}