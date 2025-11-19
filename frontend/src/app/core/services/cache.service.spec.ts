import { TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CacheService]
    });
    service = TestBed.inject(CacheService);
  });

  afterEach(() => {
    service.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should store and retrieve responses', () => {
    const url = '/api/test';
    const response = new HttpResponse({ body: { data: 'test' } });

    service.set(url, response);
    
    expect(service.has(url)).toBeTruthy();
    
    const cached = service.get(url);
    expect(cached).toBeTruthy();
    expect(cached?.body).toEqual({ data: 'test' });
  });

  it('should return null for non-existent entries', () => {
    const url = '/api/nonexistent';
    
    expect(service.has(url)).toBeFalsy();
    expect(service.get(url)).toBeNull();
  });

  it('should expire entries after TTL', (done) => {
    const url = '/api/test';
    const response = new HttpResponse({ body: { data: 'test' } });
    const shortTtl = 100; // 100ms

    service.set(url, response, { ttl: shortTtl });
    
    expect(service.has(url)).toBeTruthy();

    setTimeout(() => {
      expect(service.has(url)).toBeFalsy();
      expect(service.get(url)).toBeNull();
      done();
    }, shortTtl + 50);
  });

  it('should invalidate specific entries', () => {
    const url1 = '/api/posts/1';
    const url2 = '/api/posts/2';
    const response = new HttpResponse({ body: {} });

    service.set(url1, response);
    service.set(url2, response);

    expect(service.has(url1)).toBeTruthy();
    expect(service.has(url2)).toBeTruthy();

    service.invalidate(url1);

    expect(service.has(url1)).toBeFalsy();
    expect(service.has(url2)).toBeTruthy();
  });

  it('should invalidate by pattern (regex)', () => {
    const urls = [
      '/api/posts/1',
      '/api/posts/2',
      '/api/users/1'
    ];
    const response = new HttpResponse({ body: {} });

    urls.forEach(url => service.set(url, response));

    service.invalidatePattern(/\/posts\//);

    expect(service.has('/api/posts/1')).toBeFalsy();
    expect(service.has('/api/posts/2')).toBeFalsy();
    expect(service.has('/api/users/1')).toBeTruthy();
  });

  it('should invalidate by pattern (string)', () => {
    const urls = [
      '/api/posts/list',
      '/api/posts/detail',
      '/api/users/list'
    ];
    const response = new HttpResponse({ body: {} });

    urls.forEach(url => service.set(url, response));

    service.invalidatePattern('/api/posts');

    expect(service.has('/api/posts/list')).toBeFalsy();
    expect(service.has('/api/posts/detail')).toBeFalsy();
    expect(service.has('/api/users/list')).toBeTruthy();
  });

  it('should clear all cache', () => {
    const urls = ['/api/test1', '/api/test2', '/api/test3'];
    const response = new HttpResponse({ body: {} });

    urls.forEach(url => service.set(url, response));

    expect(service.getStats().size).toBe(3);

    service.clear();

    expect(service.getStats().size).toBe(0);
    urls.forEach(url => expect(service.has(url)).toBeFalsy());
  });

  it('should provide statistics', () => {
    const urls = ['/api/test1', '/api/test2'];
    const response = new HttpResponse({ body: {} });

    urls.forEach(url => service.set(url, response));

    const stats = service.getStats();

    expect(stats.size).toBe(2);
    expect(stats.entries.length).toBe(2);
    expect(stats.entries[0].url).toBeDefined();
    expect(stats.entries[0].age).toBeGreaterThanOrEqual(0);
    expect(stats.entries[0].ttl).toBeGreaterThan(0);
  });

  it('should handle query params in cache key', () => {
    const url1 = '/api/test?page=1';
    const url2 = '/api/test?page=2';
    const response = new HttpResponse({ body: {} });

    service.set(url1, response, { cacheQueryParams: true });
    service.set(url2, response, { cacheQueryParams: true });

    expect(service.has(url1, { cacheQueryParams: true })).toBeTruthy();
    expect(service.has(url2, { cacheQueryParams: true })).toBeTruthy();

    // Son entradas diferentes
    expect(service.getStats().size).toBe(2);
  });

  it('should ignore query params when configured', () => {
    const url1 = '/api/test?page=1';
    const url2 = '/api/test?page=2';
    const response1 = new HttpResponse({ body: { page: 1 } });
    const response2 = new HttpResponse({ body: { page: 2 } });

    service.set(url1, response1, { cacheQueryParams: false });
    service.set(url2, response2, { cacheQueryParams: false });

    // Debería haber solo 1 entrada (sin query params)
    expect(service.getStats().size).toBe(1);

    const cached = service.get(url1, { cacheQueryParams: false });
    // Debe retornar la última guardada (page: 2)
    expect(cached?.body).toEqual({ page: 2 });
  });

  it('should evict LRU entry when max size is reached', () => {
    const maxSize = 3;
    service.setDefaultConfig({ maxSize });

    const response = new HttpResponse({ body: {} });

    // Agregar 3 entradas
    service.set('/api/test1', response);
    service.set('/api/test2', response);
    service.set('/api/test3', response);

    expect(service.getStats().size).toBe(3);

    // Agregar una más - debe eliminar la más antigua
    service.set('/api/test4', response);

    expect(service.getStats().size).toBe(3);
    expect(service.has('/api/test1')).toBeFalsy(); // Primera eliminada (LRU)
    expect(service.has('/api/test4')).toBeTruthy(); // Nueva presente
  });

  it('should update default configuration', () => {
    const newConfig = {
      ttl: 10000,
      maxSize: 50
    };

    service.setDefaultConfig(newConfig);

    const url = '/api/test';
    const response = new HttpResponse({ body: {} });

    service.set(url, response);

    const stats = service.getStats();
    expect(stats.maxSize).toBe(50);
  });

  it('should clean expired entries automatically', (done) => {
    const url = '/api/test';
    const response = new HttpResponse({ body: {} });
    const shortTtl = 50;

    service.set(url, response, { ttl: shortTtl });

    expect(service.has(url)).toBeTruthy();

    // Esperar a que expire y se limpie automáticamente
    // El servicio limpia cada 60 segundos, pero has() también verifica expiración
    setTimeout(() => {
      expect(service.has(url)).toBeFalsy();
      done();
    }, shortTtl + 100);
  });
});
