import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor() {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Obtener el token desde localStorage
    const token = localStorage.getItem('accessToken');
    
    // Si hay token y la petición es hacia el backend (localhost:5000)
    if (token && (req.url.includes('localhost:5000') || req.url.includes('/auth/') || req.url.includes('/api/'))) {
      // Clonar la petición y agregar el header de autorización Bearer
      req = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    return next.handle(req);
  }
}