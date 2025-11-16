import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface RateLimitState {
  isBlocked: boolean;
  retryAfter: number | null;
  blockedUntil: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class RateLimitService {
  private rateLimitState$ = new BehaviorSubject<RateLimitState>({
    isBlocked: false,
    retryAfter: null,
    blockedUntil: null
  });

  constructor() {}

  /**
   * Obtiene el estado actual de rate limiting
   */
  getState(): Observable<RateLimitState> {
    return this.rateLimitState$.asObservable();
  }

  /**
   * Obtiene el estado actual de forma síncrona
   */
  getCurrentState(): RateLimitState {
    return this.rateLimitState$.value;
  }

  /**
   * Verifica si las peticiones están bloqueadas
   */
  isBlocked(): boolean {
    const state = this.rateLimitState$.value;
    if (!state.isBlocked) {
      return false;
    }

    // Si el bloqueo expiró, limpiarlo
    if (state.blockedUntil && Date.now() > state.blockedUntil) {
      this.clearBlock();
      return false;
    }

    return true;
  }

  /**
   * Bloquea las peticiones por un tiempo determinado
   * @param retryAfter Segundos hasta que se pueda reintentar (del header Retry-After)
   * @param defaultSeconds Segundos por defecto si no se proporciona retryAfter
   */
  setBlock(retryAfter?: number | string, defaultSeconds: number = 60): void {
    let seconds: number;

    if (retryAfter !== undefined && retryAfter !== null) {
      // Si es string, intentar parsearlo
      if (typeof retryAfter === 'string') {
        const parsed = parseInt(retryAfter, 10);
        seconds = isNaN(parsed) ? defaultSeconds : parsed;
      } else {
        seconds = retryAfter;
      }
    } else {
      seconds = defaultSeconds;
    }

    const blockedUntil = Date.now() + (seconds * 1000);

    this.rateLimitState$.next({
      isBlocked: true,
      retryAfter: seconds,
      blockedUntil
    });
  }

  /**
   * Limpia el bloqueo de rate limiting
   */
  clearBlock(): void {
    this.rateLimitState$.next({
      isBlocked: false,
      retryAfter: null,
      blockedUntil: null
    });
  }

  /**
   * Obtiene los segundos restantes hasta que se pueda reintentar
   */
  getRemainingSeconds(): number {
    const state = this.rateLimitState$.value;
    if (!state.isBlocked || !state.blockedUntil) {
      return 0;
    }

    const remaining = Math.ceil((state.blockedUntil - Date.now()) / 1000);
    return Math.max(0, remaining);
  }
}

