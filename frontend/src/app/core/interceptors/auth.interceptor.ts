import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor() {}
  
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
        console.error('🚫 Token expirado - NO se agregará al header');
        // No agregamos el token si está expirado, para que el backend responda con 401
        // y el usuario pueda ver claramente que necesita re-autenticarse
        return next.handle(req);
      }
      
      // Clonar la petición y agregar el header de autorización Bearer
      const clonedReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log('✅ Token agregado al header Authorization');
      return next.handle(clonedReq);
    }
    
    if (isBackendRequest && !token) {
      console.warn('⚠️ Petición al backend sin token - Se enviará sin autenticación');
      console.warn('💡 Esto causará un error 401 si el endpoint requiere autenticación');
    }

    return next.handle(req);
  }
}