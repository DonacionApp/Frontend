import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { RetryInterceptor } from './retry.interceptor';
import { RetryService } from '../services/retry.service';
import { RateLimitService } from '../services/rate-limit.service';

describe('RetryInterceptor', () => {
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;
  let retryService: jasmine.SpyObj<RetryService>;
  let rateLimitService: jasmine.SpyObj<RateLimitService>;

  beforeEach(() => {
    const retryServiceSpy = jasmine.createSpyObj('RetryService', [
      'isRetryableError',
      'hasReachedMaxAttempts',
      'calculateBackoffDelay',
      'startRetry',
      'updateRetry',
      'stopRetry'
    ]);
    const rateLimitServiceSpy = jasmine.createSpyObj('RateLimitService', ['isBlocked']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        {
          provide: HTTP_INTERCEPTORS,
          useClass: RetryInterceptor,
          multi: true
        },
        { provide: RetryService, useValue: retryServiceSpy },
        { provide: RateLimitService, useValue: rateLimitServiceSpy }
      ]
    });

    httpMock = TestBed.inject(HttpTestingController);
    httpClient = TestBed.inject(HttpClient);
    retryService = TestBed.inject(RetryService) as jasmine.SpyObj<RetryService>;
    rateLimitService = TestBed.inject(RateLimitService) as jasmine.SpyObj<RateLimitService>;

    rateLimitService.isBlocked.and.returnValue(false);
    retryService.calculateBackoffDelay.and.returnValue(100);
    retryService.hasReachedMaxAttempts.and.returnValue(false);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should not retry non-retryable errors', () => {
    retryService.isRetryableError.and.returnValue(false);

    httpClient.get('/api/test').subscribe({
      error: (error) => {
        expect(error.status).toBe(400);
      }
    });

    const req = httpMock.expectOne('/api/test');
    req.flush({}, { status: 400, statusText: 'Bad Request' });

    expect(retryService.isRetryableError).toHaveBeenCalled();
    expect(retryService.startRetry).not.toHaveBeenCalled();
  });

  it('should retry retryable errors with backoff', (done) => {
    retryService.isRetryableError.and.returnValue(true);
    retryService.hasReachedMaxAttempts.and.returnValues(false, false, true);
    retryService.calculateBackoffDelay.and.returnValue(10); // Short delay for testing

    httpClient.get('/api/test').subscribe({
      error: (error) => {
        expect(error.status).toBe(500);
        expect(retryService.startRetry).toHaveBeenCalled();
        done();
      }
    });

    // First request fails
    const req1 = httpMock.expectOne('/api/test');
    req1.flush({}, { status: 500, statusText: 'Internal Server Error' });

    // Wait for retry delay
    setTimeout(() => {
      // Retry request also fails
      const req2 = httpMock.expectOne('/api/test');
      req2.flush({}, { status: 500, statusText: 'Internal Server Error' });
    }, 20);
  });

  it('should not retry auth requests', () => {
    httpClient.post('/auth/login', {}).subscribe();

    const req = httpMock.expectOne('/auth/login');
    expect(retryService.isRetryableError).not.toHaveBeenCalled();
    req.flush({});
  });

  it('should not retry when rate limit is active', () => {
    rateLimitService.isBlocked.and.returnValue(true);

    httpClient.get('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(retryService.isRetryableError).not.toHaveBeenCalled();
    req.flush({});
  });
});

