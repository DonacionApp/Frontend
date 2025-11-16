import { Injectable, Injector } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { retryWhen, mergeMap, take, finalize, catchError } from 'rxjs/operators';
import { RetryService } from '../services/retry.service';
import { RateLimitService } from '../services/rate-limit.service';

@Injectable()
export class RetryInterceptor implements HttpInterceptor {
  private readonly MAX_RETRIES = 3;
  private readonly RETRYABLE_STATUSES = [429, 500, 502, 503, 504];

  constructor(
    private retryService: RetryService,
    private rateLimitService: RateLimitService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // No reintentar peticiones de autenticación
    if (this.isAuthRequest(req.url)) {
      return next.handle(req);
    }

    // No reintentar si hay rate limiting activo
    if (this.rateLimitService.isBlocked()) {
      return next.handle(req);
    }

    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        // Verificar si el error es recuperable
        if (!this.retryService.isRetryableError(error)) {
          return throwError(() => error);
        }

        // No reintentar si es 429 (ya se maneja en AuthInterceptor)
        if (error.status === 429) {
          return throwError(() => error);
        }

        // Iniciar reintentos con backoff exponencial
        return this.retryWithBackoff(req, next, error, 1);
      })
    );
  }

  /**
   * Reintenta la petición con backoff exponencial
   */
  private retryWithBackoff(
    request: HttpRequest<any>,
    next: HttpHandler,
    error: HttpErrorResponse,
    attempt: number
  ): Observable<HttpEvent<any>> {
    // Verificar si se alcanzó el máximo de intentos
    if (this.retryService.hasReachedMaxAttempts(attempt, this.MAX_RETRIES)) {
      this.retryService.stopRetry();
      return throwError(() => error);
    }

    // Calcular delay para el siguiente intento
    const delay = this.retryService.calculateBackoffDelay(attempt);
    
    // Actualizar estado de reintento
    this.retryService.startRetry(error, attempt, this.MAX_RETRIES);

    // Esperar el delay y reintentar
    return timer(delay).pipe(
      mergeMap(() => {
        // Actualizar estado
        this.retryService.updateRetry(attempt + 1);
        
        // Reintentar la petición
        return next.handle(request).pipe(
          finalize(() => {
            // Si la petición fue exitosa, detener el estado de reintento
            this.retryService.stopRetry();
          }),
          catchError((retryError: HttpErrorResponse) => {
            // Si el error sigue siendo recuperable, intentar de nuevo
            if (this.retryService.isRetryableError(retryError) && 
                !this.retryService.hasReachedMaxAttempts(attempt + 1, this.MAX_RETRIES)) {
              return this.retryWithBackoff(request, next, retryError, attempt + 1);
            }
            
            // Si no es recuperable o se alcanzó el máximo, detener y lanzar error
            this.retryService.stopRetry();
            return throwError(() => retryError);
          })
        );
      })
    );
  }

  /**
   * Verifica si la URL es una petición de autenticación
   */
  private isAuthRequest(url: string): boolean {
    return url.includes('/auth/login') || 
           url.includes('/auth/refresh') || 
           url.includes('/auth/register');
  }
}

