import { Injectable } from '@angular/core';
import { HttpResponse } from '@angular/common/http';

/**
 * Entrada de caché con metadatos
 */
interface CacheEntry {
  response: HttpResponse<any>;
  timestamp: number;
  expiresAt: number;
}

/**
 * Configuración de caché
 */
export interface CacheConfig {
  /**
   * Tiempo de vida en milisegundos (default: 5 minutos)
   */
  ttl?: number;
  /**
   * Si debe cachear peticiones con parámetros de consulta (default: true)
   */
  cacheQueryParams?: boolean;
  /**
   * Tamaño máximo del caché (número de entradas, default: 100)
   */
  maxSize?: number;
}

/**
 * Servicio de caché para peticiones HTTP
 * 
 * Características:
 * - Almacenamiento en memoria (Map)
 * - TTL (Time To Live) configurable
 * - Invalidación por URL o patrón
 * - Límite de tamaño con estrategia LRU (Least Recently Used)
 * - Thread-safe para múltiples peticiones simultáneas
 * 
 * @example
 * ```typescript
 * // En un componente o servicio
 * if (this.cacheService.has(url)) {
 *   return of(this.cacheService.get(url));
 * }
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class CacheService {
  /**
   * Almacén principal del caché
   * Key: URL completa (incluyendo query params si cacheQueryParams=true)
   * Value: Entrada de caché con respuesta y metadatos
   */
  private cache = new Map<string, CacheEntry>();

  /**
   * Configuración por defecto
   */
  private defaultConfig: Required<CacheConfig> = {
    ttl: 5 * 60 * 1000, // 5 minutos
    cacheQueryParams: true,
    maxSize: 100
  };

  constructor() {
    // Limpiar caché expirado cada minuto
    setInterval(() => this.cleanExpiredEntries(), 60 * 1000);
  }

  /**
   * Genera una clave única para la entrada de caché
   * Incluye URL + parámetros de consulta si cacheQueryParams=true
   */
  private generateKey(url: string, config: CacheConfig = {}): string {
    const mergedConfig = { ...this.defaultConfig, ...config };
    
    if (!mergedConfig.cacheQueryParams) {
      // Remover query params de la URL
      return url.split('?')[0];
    }
    
    return url;
  }

  /**
   * Verifica si una URL tiene una entrada válida en caché
   */
  has(url: string, config?: CacheConfig): boolean {
    const key = this.generateKey(url, config);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    // Verificar si la entrada ha expirado
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Obtiene una respuesta del caché
   * Retorna null si no existe o ha expirado
   */
  get(url: string, config?: CacheConfig): HttpResponse<any> | null {
    const key = this.generateKey(url, config);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Verificar si la entrada ha expirado
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    // Actualizar timestamp de acceso para estrategia LRU
    entry.timestamp = Date.now();
    
    return entry.response;
  }

  /**
   * Almacena una respuesta en caché
   */
  set(url: string, response: HttpResponse<any>, config?: CacheConfig): void {
    const mergedConfig = { ...this.defaultConfig, ...config };
    const key = this.generateKey(url, mergedConfig);
    
    // Verificar límite de tamaño y aplicar estrategia LRU
    if (this.cache.size >= mergedConfig.maxSize) {
      this.evictLRU();
    }
    
    const now = Date.now();
    const entry: CacheEntry = {
      response: response.clone(),
      timestamp: now,
      expiresAt: now + mergedConfig.ttl
    };
    
    this.cache.set(key, entry);
  }

  /**
   * Invalida (elimina) una entrada específica del caché
   */
  invalidate(url: string, config?: CacheConfig): void {
    const key = this.generateKey(url, config);
    this.cache.delete(key);
  }

  /**
   * Invalida todas las entradas que coincidan con un patrón
   * @param pattern - Expresión regular o string que debe contener la URL
   * 
   * @example
   * ```typescript
   * // Invalidar todas las URLs de donaciones
   * cacheService.invalidatePattern(/\/donation\//);
   * 
   * // Invalidar por string
   * cacheService.invalidatePattern('/api/posts');
   * ```
   */
  invalidatePattern(pattern: RegExp | string): void {
    const regex = typeof pattern === 'string' 
      ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) 
      : pattern;
    
    const keysToDelete: string[] = [];
    
    this.cache.forEach((_, key) => {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`🗑️ [CacheService] Invalidadas ${keysToDelete.length} entradas por patrón`);
    }
  }

  /**
   * Limpia todo el caché
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🧹 [CacheService] Caché limpiado (${size} entradas eliminadas)`);
  }

  /**
   * Obtiene estadísticas del caché
   */
  getStats(): {
    size: number;
    maxSize: number;
    entries: Array<{ url: string; age: number; ttl: number }>;
  } {
    const now = Date.now();
    const entries: Array<{ url: string; age: number; ttl: number }> = [];
    
    this.cache.forEach((entry, url) => {
      entries.push({
        url,
        age: now - entry.timestamp,
        ttl: entry.expiresAt - now
      });
    });
    
    return {
      size: this.cache.size,
      maxSize: this.defaultConfig.maxSize,
      entries: entries.sort((a, b) => b.age - a.age) // Ordenar por edad descendente
    };
  }

  /**
   * Limpia entradas expiradas del caché
   * Se ejecuta automáticamente cada minuto
   */
  private cleanExpiredEntries(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`🧹 [CacheService] ${keysToDelete.length} entradas expiradas eliminadas`);
    }
  }

  /**
   * Elimina la entrada menos recientemente usada (LRU)
   * Se ejecuta cuando el caché alcanza el tamaño máximo
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;
    
    this.cache.forEach((entry, key) => {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    });
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log(`♻️ [CacheService] Entrada LRU eliminada: ${oldestKey}`);
    }
  }

  /**
   * Configura los valores por defecto del caché
   * Útil para ajustar configuración global desde AppModule
   */
  setDefaultConfig(config: Partial<CacheConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
    console.log('⚙️ [CacheService] Configuración actualizada:', this.defaultConfig);
  }
}
