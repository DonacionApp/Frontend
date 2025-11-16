import { TestBed } from '@angular/core/testing';
import { HttpInterceptorFn, HttpRequest, HttpHandler, HttpErrorResponse } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthInterceptor } from './auth.interceptor';
import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { RateLimitService } from '../services/rate-limit.service';
import { ToastService } from '../services/toast.service';
import { of, throwError } from 'rxjs';

describe('AuthInterceptor', () => {
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;
  let authService: jasmine.SpyObj<AuthService>;
  let rateLimitService: jasmine.SpyObj<RateLimitService>;
  let toastService: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    const authServiceSpy = jasmine.createSpyObj('AuthService', [
      'getAccessToken',
      'getCurrentUser',
      'refreshToken',
      'logoutAndRedirect'
    ]);
    const rateLimitServiceSpy = jasmine.createSpyObj('RateLimitService', [
      'setBlock',
      'isBlocked'
    ]);
    const toastServiceSpy = jasmine.createSpyObj('ToastService', ['error']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        {
          provide: HTTP_INTERCEPTORS,
          useClass: AuthInterceptor,
          multi: true
        },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: RateLimitService, useValue: rateLimitServiceSpy },
        { provide: ToastService, useValue: toastServiceSpy }
      ]
    });

    httpMock = TestBed.inject(HttpTestingController);
    httpClient = TestBed.inject(HttpClient);
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    rateLimitService = TestBed.inject(RateLimitService) as jasmine.SpyObj<RateLimitService>;
    toastService = TestBed.inject(ToastService) as jasmine.SpyObj<ToastService>;

    authService.getAccessToken.and.returnValue('test-token');
    authService.getCurrentUser.and.returnValue({ id: '1', email: 'test@test.com', role: 'user' });
    rateLimitService.isBlocked.and.returnValue(false);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should add Authorization header to backend requests', () => {
    authService.getAccessToken.and.returnValue('test-token');

    httpClient.get('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.has('Authorization')).toBeTruthy();
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
    req.flush({});
  });

  it('should handle 401 error and attempt token refresh', () => {
    authService.getAccessToken.and.returnValue('expired-token');
    authService.refreshToken.and.returnValue(of({ access_token: 'new-token' }));
    authService.getAccessToken.and.returnValues('expired-token', 'new-token');

    httpClient.get('/api/test').subscribe();

    const firstReq = httpMock.expectOne('/api/test');
    firstReq.flush({}, { status: 401, statusText: 'Unauthorized' });

    const refreshReq = httpMock.expectOne('/auth/refresh');
    refreshReq.flush({ access_token: 'new-token' });

    const retryReq = httpMock.expectOne('/api/test');
    expect(retryReq.request.headers.get('Authorization')).toBe('Bearer new-token');
    retryReq.flush({});
  });

  it('should handle 429 error and show rate limit notification', () => {
    const errorResponse = new HttpErrorResponse({
      status: 429,
      statusText: 'Too Many Requests',
      headers: { 'Retry-After': '60' }
    });

    httpClient.get('/api/test').subscribe({
      error: (error) => {
        expect(error.status).toBe(429);
      }
    });

    const req = httpMock.expectOne('/api/test');
    req.flush({}, { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '60' } });

    expect(rateLimitService.setBlock).toHaveBeenCalledWith('60', 60);
    expect(toastService.error).toHaveBeenCalled();
  });

  it('should not intercept auth requests', () => {
    httpClient.post('/auth/login', {}).subscribe();

    const req = httpMock.expectOne('/auth/login');
    expect(req.request.headers.has('Authorization')).toBeFalsy();
    req.flush({});
  });
});

