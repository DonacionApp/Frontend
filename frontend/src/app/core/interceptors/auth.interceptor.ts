import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor() {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Obtener el token desde localStorage
    const token = localStorage.getItem('accessToken');

    // Determinar si la solicitud es hacia el backend
    // Solo enviar token a dominios/endpoints conocidos
    const isBackendRequest =
      req.url.includes('localhost:') ||     // localhost:5000, localhost:3000, etc
      req.url.includes('api.') ||           // api.dominio.com
      req.url.includes('/api/') ||          // /api/* endpoints
      req.url.includes('/auth/') ||         // /auth/* endpoints
      req.url.includes('/ia/') ||           // /ia/* endpoints (IA para tags)
      req.url.includes('/postliked/') ||    // /postliked/* endpoints para likes
      req.url.includes('/posttags/') ||     // /posttags/* endpoints para tags
      req.url.includes('/tags/') ||         // /tags/* endpoints para catálogo de tags
      req.url.includes('/post/');           // /post/* endpoints para publicaciones

    // Si hay token Y es una solicitud al backend, agregar el header Authorization
    if (token && isBackendRequest) {
      // Log detallado solo para endpoints críticos (IA, tags, posttags)
      const isCriticalEndpoint = req.url.includes('/ia/') || req.url.includes('/posttags/') || req.url.includes('/tags/');
      
      if (isCriticalEndpoint) {
        console.log('═══════════════════════════════════════════════════════');
        console.log('🔐 AUTH INTERCEPTOR - AGREGANDO TOKEN');
        console.log('═══════════════════════════════════════════════════════');
        console.log('📍 URL:', req.url);
        console.log('📍 Método:', req.method);
        console.log('📍 Token presente:', token.substring(0, 20) + '...');
        console.log('═══════════════════════════════════════════════════════');
      }

      // Clonar la petición y agregar el header de autorización Bearer
      const clonedReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });

      if (isCriticalEndpoint) {
        console.log('✅ Token agregado correctamente al header Authorization');
        console.log('═══════════════════════════════════════════════════════');
      }

      return next.handle(clonedReq);
    }

    // Log para debugging si hay problema
    if (!token && isBackendRequest) {
      const isCriticalEndpoint = req.url.includes('/ia/') || req.url.includes('/posttags/') || req.url.includes('/tags/');
      if (isCriticalEndpoint) {
        console.error('═══════════════════════════════════════════════════════');
        console.error('⚠️ AUTH INTERCEPTOR - SOLICITUD SIN TOKEN');
        console.error('═══════════════════════════════════════════════════════');
        console.error('📍 URL:', req.url);
        console.error('📍 Método:', req.method);
        console.error('💡 El token no está presente en localStorage');
        console.error('💡 Verifica que hayas iniciado sesión correctamente');
        console.error('═══════════════════════════════════════════════════════');
      } else {
        console.warn('⚠️ Solicitud al backend SIN token:', req.method, req.url);
      }
    }

    return next.handle(req);
  }
}