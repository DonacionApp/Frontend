import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const currentUser = this.authService.currentUserValue;
    
    // Log para desarrollo
    console.log('🔗 Interceptor - Request:', {
      url: req.url,
      method: req.method,
      hasToken: !!currentUser,
      timestamp: new Date().toISOString()
    });
    
    if (currentUser && req.url.startsWith('/api/')) {
      // Agregar token de autorización a las requests a la API
      req = req.clone({
        setHeaders: {
          Authorization: `Bearer ${currentUser.id}` // Ajustar según tu implementación de tokens
        }
      });
    }

    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        // Log detallado para desarrollo
        console.error('🚨 Interceptor - Error:', {
          url: req.url,
          method: req.method,
          status: error.status,
          message: error.message,
          error: error.error,
          timestamp: new Date().toISOString()
        });

        // Manejar errores específicos
        if (error.status === 401) {
          console.warn('🔐 Token expirado o inválido - redirigiendo al login');
          // Aquí puedes redirigir al login si es necesario
          // this.router.navigate(['/auth/login']);
        }

        // Re-lanzar el error para que el componente lo maneje
        return throwError(() => error);
      })
    );
  }
}