import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { CacheInterceptor } from './cache.interceptor';
import { CacheService } from '../services/cache.service';

describe('CacheInterceptor', () => {
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;
  let cacheService: CacheService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        CacheService,
        {
          provide: HTTP_INTERCEPTORS,
          useClass: CacheInterceptor,
          multi: true
        }
      ]
    });

    httpMock = TestBed.inject(HttpTestingController);
    httpClient = TestBed.inject(HttpClient);
    cacheService = TestBed.inject(CacheService);
  });

  afterEach(() => {
    httpMock.verify();
    cacheService.clear();
  });

  it('should be created', () => {
    const interceptor = TestBed.inject(CacheInterceptor);
    expect(interceptor).toBeTruthy();
  });

  it('should cache GET requests', (done) => {
    const testUrl = '/api/test';
    const mockData = { data: 'test' };

    // Primera petición - debe hacer la llamada HTTP
    httpClient.get(testUrl).subscribe(response => {
      expect(response).toEqual(mockData);

      // Segunda petición - debe retornar del caché
      httpClient.get(testUrl).subscribe(cachedResponse => {
        expect(cachedResponse).toEqual(mockData);
        done();
      });
    });

    const req = httpMock.expectOne(testUrl);
    expect(req.request.method).toBe('GET');
    req.flush(mockData);

    // No debe haber segunda petición HTTP
    httpMock.expectNone(testUrl);
  });

  it('should not cache POST requests', () => {
    const testUrl = '/api/test';
    const mockData = { data: 'test' };

    httpClient.post(testUrl, {}).subscribe();

    const req = httpMock.expectOne(testUrl);
    expect(req.request.method).toBe('POST');
    req.flush(mockData);

    expect(cacheService.has(testUrl)).toBeFalsy();
  });

  it('should exclude authentication URLs from cache', () => {
    const authUrl = '/auth/login';

    httpClient.get(authUrl).subscribe();

    const req = httpMock.expectOne(authUrl);
    req.flush({});

    expect(cacheService.has(authUrl)).toBeFalsy();
  });

  it('should bypass cache with X-No-Cache header', () => {
    const testUrl = '/api/test';
    const mockData = { data: 'test' };

    // Primera petición con header X-No-Cache
    httpClient.get(testUrl, {
      headers: { 'X-No-Cache': 'true' }
    }).subscribe();

    const req1 = httpMock.expectOne(testUrl);
    req1.flush(mockData);

    // Verificar que no se cacheó
    expect(cacheService.has(testUrl)).toBeFalsy();

    // Segunda petición sin header
    httpClient.get(testUrl).subscribe();

    const req2 = httpMock.expectOne(testUrl);
    req2.flush(mockData);

    // Ahora sí debe estar en caché
    expect(cacheService.has(testUrl)).toBeTruthy();
  });

  it('should invalidate cache on POST request', (done) => {
    const getUrl = '/api/posts';
    const postUrl = '/api/posts';
    const getData = { items: [] };
    const postData = { id: 1, title: 'New Post' };

    // GET request - cacheará la respuesta
    httpClient.get(getUrl).subscribe(() => {
      expect(cacheService.has(getUrl)).toBeTruthy();

      // POST request - debe invalidar el caché
      httpClient.post(postUrl, postData).subscribe(() => {
        expect(cacheService.has(getUrl)).toBeFalsy();
        done();
      });

      const postReq = httpMock.expectOne(postUrl);
      postReq.flush(postData);
    });

    const getReq = httpMock.expectOne(getUrl);
    getReq.flush(getData);
  });

  it('should respect custom TTL from X-Cache-TTL header', () => {
    const testUrl = '/api/test';
    const customTtl = '1000'; // 1 segundo

    httpClient.get(testUrl, {
      headers: { 'X-Cache-TTL': customTtl }
    }).subscribe();

    const req = httpMock.expectOne(testUrl);
    req.flush({});

    expect(cacheService.has(testUrl)).toBeTruthy();
  });

  it('should invalidate cache with X-Cache-Invalidate header', (done) => {
    const getUrl = '/api/posts/123';
    const postUrl = '/api/posts/456';

    // GET request - cacheará
    httpClient.get(getUrl).subscribe(() => {
      expect(cacheService.has(getUrl)).toBeTruthy();

      // POST con header de invalidación
      httpClient.post(postUrl, {}, {
        headers: { 'X-Cache-Invalidate': '/posts/' }
      }).subscribe(() => {
        expect(cacheService.has(getUrl)).toBeFalsy();
        done();
      });

      const postReq = httpMock.expectOne(postUrl);
      postReq.flush({});
    });

    const getReq = httpMock.expectOne(getUrl);
    getReq.flush({});
  });

  it('should bypass cache with no-cache query param', () => {
    const testUrl = '/api/test?no-cache=true';

    httpClient.get(testUrl).subscribe();

    const req = httpMock.expectOne(testUrl);
    req.flush({});

    expect(cacheService.has(testUrl)).toBeFalsy();
  });
});
