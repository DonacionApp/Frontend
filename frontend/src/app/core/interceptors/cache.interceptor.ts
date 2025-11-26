import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CacheService } from '../services/cache.service';

/**
 * Interceptor de caché HTTP
 * 
 * Funcionalidad:
 * - Intercepta peticiones GET y verifica si están en caché
 * - Si existe en caché y no ha expirado, retorna la respuesta cacheada
 * - Si no existe, ejecuta la petición y guarda la respuesta en caché
 * - Invalida caché automáticamente en peticiones POST, PUT, PATCH, DELETE
 * 
 * Configuración personalizada mediante headers:
 * - 'X-Cache-TTL': Tiempo de vida en milisegundos (ej: '600000' para 10 minutos)
 * - 'X-No-Cache': 'true' para bypass del caché en esta petición
 * - 'X-Cache-Invalidate': Patrón regex para invalidar entradas (ej: '/posts/')
 * 
 * URLs excluidas del caché:
 * - /auth/* (todas las rutas de autenticación)
 * - /websocket/*
 * - URLs con 'no-cache' en query params
 * 
 * Orden de interceptors:
 * 1. CacheInterceptor (primero - verifica caché)
 * 2. RetryInterceptor (segundo - reintentos en errores)
 * 3. AuthInterceptor (tercero - agrega token y maneja 401)
 * 
 * @example
 * ```typescript
 * // Petición normal (cachea por 5 minutos)
 * this.http.get('/api/posts');
 * 
 * // Petición con TTL personalizado (10 minutos)
 * this.http.get('/api/posts', {
 *   headers: { 'X-Cache-TTL': '600000' }
 * });
 * 
 * // Petición sin caché
 * this.http.get('/api/posts', {
 *   headers: { 'X-No-Cache': 'true' }
 * });
 * 
 * // POST que invalida caché de posts
 * this.http.post('/api/posts', data, {
 *   headers: { 'X-Cache-Invalidate': '/posts/' }
 * });
 * ```
 */
@Injectable()
export class CacheInterceptor implements HttpInterceptor {
  /**
   * URLs que NUNCA deben ser cacheadas
   */
  private readonly EXCLUDED_URLS = [
    '/auth/',           // Todas las rutas de autenticación
    '/user/notify',     // Notificaciones del usuario
    '/my-notifications', // Notificaciones del usuario actual
    '/me/',             // Recursos propios del usuario
    '/websocket'
  ];

  /**
   * Métodos HTTP que invalidan caché relacionado
   */
  private readonly INVALIDATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

  constructor(private cacheService: CacheService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Solo cachear peticiones GET
    if (req.method !== 'GET') {
      return this.handleNonGetRequest(req, next);
    }

    // Verificar si la URL está excluida
    if (this.isExcludedUrl(req.url)) {
      return next.handle(req);
    }

    // Verificar si se solicita bypass del caché
    if (req.headers.has('X-No-Cache') && req.headers.get('X-No-Cache') === 'true') {
      // Remover header antes de enviar al servidor
      const cleanReq = req.clone({
        headers: req.headers.delete('X-No-Cache')
      });
      return next.handle(cleanReq);
    }

    // Verificar si hay query param no-cache
    if (req.url.includes('no-cache=true') || req.url.includes('nocache=true')) {
      return next.handle(req);
    }

    // Intentar obtener del caché
    const cachedResponse = this.cacheService.get(req.urlWithParams);
    
    if (cachedResponse) {
      console.log(`💾 [CacheInterceptor] HIT: ${req.urlWithParams}`);
      return of(cachedResponse.clone());
    }

    // No está en caché, ejecutar petición y guardar respuesta
    console.log(`🔍 [CacheInterceptor] MISS: ${req.urlWithParams}`);
    
    return next.handle(req).pipe(
      tap(event => {
        if (event instanceof HttpResponse) {
          // Obtener TTL personalizado si existe
          const customTtl = req.headers.get('X-Cache-TTL');
          const ttl = customTtl ? parseInt(customTtl, 10) : undefined;
          
          // Guardar en caché
          this.cacheService.set(
            req.urlWithParams, 
            event,
            { ttl }
          );
          
          console.log(`✅ [CacheInterceptor] CACHED: ${req.urlWithParams}${ttl ? ` (TTL: ${ttl}ms)` : ''}`);
        }
      })
    );
  }

  /**
   * Maneja peticiones no-GET (POST, PUT, PATCH, DELETE)
   * Invalida caché relacionado después de la operación exitosa
   */
  private handleNonGetRequest(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.INVALIDATING_METHODS.includes(req.method)) {
      return next.handle(req);
    }

    return next.handle(req).pipe(
      tap(event => {
        if (event instanceof HttpResponse) {
          // Verificar si hay header de invalidación personalizado
          const invalidatePattern = req.headers.get('X-Cache-Invalidate');
          
          if (invalidatePattern) {
            this.cacheService.invalidatePattern(invalidatePattern);
          } else {
            // Invalidación automática basada en la URL
            this.autoInvalidateCache(req.url);
          }
        }
      })
    );
  }

  /**
   * Invalida automáticamente el caché relacionado con la URL modificada
   * 
   * Ejemplos:
   * - POST /api/posts → invalida /api/posts*
   * - PUT /api/posts/123 → invalida /api/posts*
   * - DELETE /api/donation/456 → invalida /api/donation*
   * - POST /api/postcomment/create → invalida /api/postcomment* (todos los comentarios)
   * - POST /api/donation/update/123 → invalida /api/donation* (todas las donaciones)
   */
  private autoInvalidateCache(url: string): void {
    try {
      // Extraer el path base sin IDs ni query params
      let basePath = url.split('?')[0]; // Remover query params
      
      // Remover posibles IDs numéricos al final del path
      basePath = basePath.replace(/\/\d+$/, '');
      
      // Para endpoints de comentarios, invalidar TODO el recurso base
      // Ejemplo: /postcomment/create/123 → /postcomment
      // Esto asegura que GET /postcomment/post/:postId se invalide correctamente
      if (basePath.includes('/postcomment/')) {
        basePath = basePath.substring(0, basePath.indexOf('/postcomment/') + '/postcomment'.length);
      }
      
      // Para endpoints de donación con acciones (update, delete, etc.), invalidar TODO el recurso
      // Ejemplo: /donation/update/123 → /donation (invalida tanto /donation/:id como /donation/users/:userId)
      if (basePath.match(/\/donation\/(update|delete|create)/)) {
        basePath = basePath.substring(0, basePath.indexOf('/donation/') + '/donation'.length);
      }
      
      // También manejar /post/:postId/comments (formato alternativo)
      if (basePath.match(/\/post\/\d+\/comments/)) {
        // Invalidar tanto /postcomment como /post/*/comments
        const postCommentPattern = /\/postcomment/;
        const postCommentsPattern = /\/post\/.*\/comments/;
        this.cacheService.invalidatePattern(postCommentPattern);
        this.cacheService.invalidatePattern(postCommentsPattern);
        console.log(`🔄 [CacheInterceptor] Auto-invalidación: /postcomment* y /post/*/comments`);
        return;
      }
      
      // Crear patrón que coincida con todas las URLs relacionadas
      const pattern = new RegExp(basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      
      this.cacheService.invalidatePattern(pattern);
      
      console.log(`🔄 [CacheInterceptor] Auto-invalidación: ${basePath}*`);
    } catch (error) {
      console.error('[CacheInterceptor] Error en auto-invalidación:', error);
    }
  }

  /**
   * Verifica si una URL debe ser excluida del caché
   */
  private isExcludedUrl(url: string): boolean {
    return this.EXCLUDED_URLS.some(excluded => url.includes(excluded));
  }
}
