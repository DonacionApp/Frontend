import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CacheService } from './cache.service';

export interface DateFilters {
  startDate: string;
  endDate: string;
}

export interface StatsFilters {
  dateRange: DateFilters;
  preset?: string;
}

@Injectable({
  providedIn: 'root'
})
export class StatsFilterService {
  // Estado inicial de los filtros
  private readonly initialFilters: StatsFilters = {
    dateRange: {
      startDate: '',
      endDate: ''
    },
    preset: ''
  };

  // BehaviorSubject para mantener el estado actual de los filtros
  private filtersSubject = new BehaviorSubject<StatsFilters>(this.initialFilters);

  // Observable público para que los componentes se suscriban
  public filters$: Observable<StatsFilters> = this.filtersSubject.asObservable();

  constructor(private cacheService: CacheService) {
    // Intentar cargar filtros guardados del localStorage al iniciar
    this.loadFiltersFromStorage();
  }

  /**
   * Obtiene el valor actual de los filtros (sin suscripción)
   */
  getCurrentFilters(): StatsFilters {
    return this.filtersSubject.value;
  }

  /**
   * Actualiza los filtros de rango de fechas
   */
  setDateRange(startDate: string, endDate: string): void {
    const currentFilters = this.filtersSubject.value;
    const newFilters: StatsFilters = {
      ...currentFilters,
      dateRange: { startDate, endDate },
      preset: '' // Reset preset cuando se cambian fechas manualmente
    };
    
    this.filtersSubject.next(newFilters);
    this.saveFiltersToStorage(newFilters);
    
    // Invalidar caché de estadísticas cuando cambien los filtros
    this.invalidateStatsCache();
    
    console.log('🔍 Filtros actualizados:', newFilters);
  }

  /**
   * Aplica un preset de fecha predefinido
   */
  applyDatePreset(preset: string): void {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    let startDate = '';
    let endDate = todayStr;

    switch (preset) {
      case 'today':
        startDate = todayStr;
        endDate = todayStr;
        break;
      
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay()); // Domingo
        startDate = weekStart.toISOString().split('T')[0];
        break;
      
      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        startDate = monthStart.toISOString().split('T')[0];
        break;
      
      case 'year':
        const yearStart = new Date(today.getFullYear(), 0, 1);
        startDate = yearStart.toISOString().split('T')[0];
        break;
    }

    const newFilters: StatsFilters = {
      dateRange: { startDate, endDate },
      preset
    };
    
    this.filtersSubject.next(newFilters);
    this.saveFiltersToStorage(newFilters);
    
    // Invalidar caché de estadísticas cuando cambien los filtros
    this.invalidateStatsCache();
    
    console.log('🔍 Preset aplicado:', preset, newFilters);
  }

  /**
   * Limpia todos los filtros
   */
  clearFilters(): void {
    this.filtersSubject.next(this.initialFilters);
    this.clearFiltersFromStorage();
    
    // Invalidar caché de estadísticas cuando se limpien los filtros
    this.invalidateStatsCache();
    
    console.log('🧹 Filtros limpiados');
  }

  /**
   * Remueve solo el filtro de fecha de inicio o fin
   */
  removeDateFilter(type: 'start' | 'end'): void {
    const currentFilters = this.filtersSubject.value;
    const newDateRange = { ...currentFilters.dateRange };
    
    if (type === 'start') {
      newDateRange.startDate = '';
    } else {
      newDateRange.endDate = '';
    }
    
    const newFilters: StatsFilters = {
      dateRange: newDateRange,
      preset: '' // Reset preset
    };
    
    this.filtersSubject.next(newFilters);
    this.saveFiltersToStorage(newFilters);
    
    // Invalidar caché de estadísticas cuando se remuevan filtros
    this.invalidateStatsCache();
    
    console.log('🗑️ Filtro removido:', type);
  }

  /**
   * Verifica si hay filtros activos
   */
  hasActiveFilters(): boolean {
    const filters = this.filtersSubject.value;
    return !!(filters.dateRange.startDate || filters.dateRange.endDate);
  }

  /**
   * Filtra un array de datos según el rango de fechas actual
   */
  filterDataByDateRange<T extends { createdAt?: string | Date }>(data: T[]): T[] {
    const filters = this.filtersSubject.value;
    
    if (!filters.dateRange.startDate && !filters.dateRange.endDate) {
      return data;
    }

    return data.filter(item => {
      if (!item.createdAt) return false;
      
      const itemDate = new Date(item.createdAt);
      const startDate = filters.dateRange.startDate ? new Date(filters.dateRange.startDate) : null;
      const endDate = filters.dateRange.endDate ? new Date(filters.dateRange.endDate + 'T23:59:59') : null;

      if (startDate && itemDate < startDate) return false;
      if (endDate && itemDate > endDate) return false;
      
      return true;
    });
  }

  /**
   * Invalida el caché de estadísticas
   * Se llama automáticamente cuando se cambian los filtros
   */
  private invalidateStatsCache(): void {
    // Invalidar endpoints de estadísticas relacionados con filtros
    this.cacheService.invalidatePattern('/statistics');
    this.cacheService.invalidatePattern('/user/.*/public-stats');
    this.cacheService.invalidatePattern('/user/minimal');
    this.cacheService.invalidatePattern('/donation');
    this.cacheService.invalidatePattern('/post');
    
    console.log('🗑️ Caché de estadísticas invalidado debido a cambio en filtros');
  }

  // ============= PRIVATE METHODS - LocalStorage =============

  private readonly STORAGE_KEY = 'stats_filters';

  /**
   * Guarda los filtros en localStorage para persistencia
   */
  private saveFiltersToStorage(filters: StatsFilters): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filters));
    } catch (error) {
      console.warn('⚠️ No se pudieron guardar los filtros en localStorage:', error);
    }
  }

  /**
   * Carga los filtros desde localStorage
   */
  private loadFiltersFromStorage(): void {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const filters = JSON.parse(saved) as StatsFilters;
        this.filtersSubject.next(filters);
        console.log('📂 Filtros cargados desde localStorage:', filters);
      }
    } catch (error) {
      console.warn('⚠️ No se pudieron cargar los filtros desde localStorage:', error);
    }
  }

  /**
   * Limpia los filtros del localStorage
   */
  private clearFiltersFromStorage(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('⚠️ No se pudieron limpiar los filtros del localStorage:', error);
    }
  }
}
