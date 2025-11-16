import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

export interface RetryState {
  isRetrying: boolean;
  attempt: number;
  maxAttempts: number;
  delay: number;
  error: HttpErrorResponse | null;
}

@Injectable({
  providedIn: 'root'
})
export class RetryService {
  private retryState$ = new BehaviorSubject<RetryState>({
    isRetrying: false,
    attempt: 0,
    maxAttempts: 3,
    delay: 0,
    error: null
  });

  // Configuración de backoff exponencial
  private readonly INITIAL_DELAY = 1000; // 1 segundo
  private readonly MAX_DELAY = 30000; // 30 segundos
  private readonly BACKOFF_MULTIPLIER = 2;

  constructor() {}

  /**
   * Obtiene el estado actual de reintentos
   */
  getState(): Observable<RetryState> {
    return this.retryState$.asObservable();
  }

  /**
   * Obtiene el estado actual de forma síncrona
   */
  getCurrentState(): RetryState {
    return this.retryState$.value;
  }

  /**
   * Verifica si un error es recuperable y debe reintentarse
   */
  isRetryableError(error: HttpErrorResponse): boolean {
    const status = error.status;

    // Errores recuperables: 429, 500, 502, 503, 504
    const retryableStatuses = [429, 500, 502, 503, 504];

    // No reintentar en errores de cliente (4xx excepto 429)
    if (status >= 400 && status < 500 && status !== 429) {
      return false;
    }

    // No reintentar en errores de autenticación (401 se maneja en AuthInterceptor)
    if (status === 401 || status === 403) {
      return false;
    }

    return retryableStatuses.includes(status);
  }

  /**
   * Calcula el delay para el siguiente reintento usando backoff exponencial
   */
  calculateBackoffDelay(attempt: number): number {
    const delay = this.INITIAL_DELAY * Math.pow(this.BACKOFF_MULTIPLIER, attempt - 1);
    return Math.min(delay, this.MAX_DELAY);
  }

  /**
   * Inicia el estado de reintento
   */
  startRetry(error: HttpErrorResponse, attempt: number, maxAttempts: number = 3): void {
    const delay = this.calculateBackoffDelay(attempt);

    this.retryState$.next({
      isRetrying: true,
      attempt,
      maxAttempts,
      delay,
      error
    });
  }

  /**
   * Actualiza el estado durante el reintento
   */
  updateRetry(attempt: number): void {
    const currentState = this.retryState$.value;
    const delay = this.calculateBackoffDelay(attempt);

    this.retryState$.next({
      ...currentState,
      attempt,
      delay
    });
  }

  /**
   * Detiene el estado de reintento
   */
  stopRetry(): void {
    this.retryState$.next({
      isRetrying: false,
      attempt: 0,
      maxAttempts: 3,
      delay: 0,
      error: null
    });
  }

  /**
   * Verifica si se ha alcanzado el máximo de intentos
   */
  hasReachedMaxAttempts(attempt: number, maxAttempts: number): boolean {
    return attempt > maxAttempts;
  }
}

