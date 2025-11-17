import { TestBed } from '@angular/core/testing';
import { StatsFilterService } from './stats-filter.service';

describe('StatsFilterService', () => {
  let service: StatsFilterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StatsFilterService);
    // Limpiar localStorage antes de cada test
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with empty filters', () => {
    const filters = service.getCurrentFilters();
    expect(filters.dateRange.startDate).toBe('');
    expect(filters.dateRange.endDate).toBe('');
  });

  it('should update date range filters', () => {
    service.setDateRange('2025-01-01', '2025-01-31');
    const filters = service.getCurrentFilters();
    
    expect(filters.dateRange.startDate).toBe('2025-01-01');
    expect(filters.dateRange.endDate).toBe('2025-01-31');
  });

  it('should apply date presets correctly', () => {
    const today = new Date().toISOString().split('T')[0];
    
    service.applyDatePreset('today');
    let filters = service.getCurrentFilters();
    expect(filters.dateRange.startDate).toBe(today);
    expect(filters.dateRange.endDate).toBe(today);
    expect(filters.preset).toBe('today');
  });

  it('should clear all filters', () => {
    service.setDateRange('2025-01-01', '2025-01-31');
    service.clearFilters();
    
    const filters = service.getCurrentFilters();
    expect(filters.dateRange.startDate).toBe('');
    expect(filters.dateRange.endDate).toBe('');
  });

  it('should detect active filters', () => {
    expect(service.hasActiveFilters()).toBe(false);
    
    service.setDateRange('2025-01-01', '2025-01-31');
    expect(service.hasActiveFilters()).toBe(true);
    
    service.clearFilters();
    expect(service.hasActiveFilters()).toBe(false);
  });

  it('should filter data by date range', () => {
    const testData = [
      { id: 1, createdAt: '2025-01-15T10:00:00Z' },
      { id: 2, createdAt: '2025-02-15T10:00:00Z' },
      { id: 3, createdAt: '2025-03-15T10:00:00Z' }
    ];

    service.setDateRange('2025-02-01', '2025-02-28');
    const filtered = service.filterDataByDateRange(testData);
    
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(2);
  });

  it('should save and load filters from localStorage', () => {
    service.setDateRange('2025-01-01', '2025-01-31');
    
    // Crear nueva instancia del servicio (simula recarga de página)
    const newService = new StatsFilterService();
    const filters = newService.getCurrentFilters();
    
    expect(filters.dateRange.startDate).toBe('2025-01-01');
    expect(filters.dateRange.endDate).toBe('2025-01-31');
  });
});
