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
      req.url.includes('/postliked/');      // /postliked/* endpoints para likes

    // Si hay token Y es una solicitud al backend, agregar el header Authorization
    if (token && isBackendRequest) {
      console.log('✅ Token encontrado:', token.substring(0, 20) + '... | Enviando a:', req.url);
      console.log('📋 Request Details:', {
        method: req.method,
        url: req.url,
        headers: req.headers.keys(),
        body: req.body
      });

      // Clonar la petición y agregar el header de autorización Bearer
      const clonedReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });

      console.log('🔐 Headers después de interceptor:', {
        Authorization: clonedReq.headers.get('Authorization') ? 'Bearer ...' : 'MISSING'
      });

      return next.handle(clonedReq);
    }

    // Log para debugging si hay problema
    if (!token && isBackendRequest) {
      console.warn('⚠️ Solicitud al backend SIN token:', req.method, req.url);
    }

    return next.handle(req);
  }
}