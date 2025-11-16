import { TestBed } from '@angular/core/testing';
import { RetryService } from './retry.service';
import { HttpErrorResponse } from '@angular/common/http';

describe('RetryService', () => {
  let service: RetryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RetryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should identify retryable errors', () => {
    const retryableErrors = [429, 500, 502, 503, 504];
    
    retryableErrors.forEach(status => {
      const error = new HttpErrorResponse({ status, statusText: 'Error' });
      expect(service.isRetryableError(error)).toBeTrue();
    });
  });

  it('should not identify non-retryable errors', () => {
    const nonRetryableErrors = [400, 401, 403, 404];
    
    nonRetryableErrors.forEach(status => {
      const error = new HttpErrorResponse({ status, statusText: 'Error' });
      expect(service.isRetryableError(error)).toBeFalse();
    });
  });

  it('should calculate exponential backoff delay', () => {
    const delay1 = service.calculateBackoffDelay(1);
    const delay2 = service.calculateBackoffDelay(2);
    const delay3 = service.calculateBackoffDelay(3);
    
    expect(delay2).toBeGreaterThan(delay1);
    expect(delay3).toBeGreaterThan(delay2);
  });

  it('should cap backoff delay at maximum', () => {
    const delay = service.calculateBackoffDelay(20); // Very high attempt number
    expect(delay).toBeLessThanOrEqual(30000); // MAX_DELAY
  });

  it('should start retry state', () => {
    const error = new HttpErrorResponse({ status: 500, statusText: 'Error' });
    service.startRetry(error, 1, 3);
    
    const state = service.getCurrentState();
    expect(state.isRetrying).toBeTrue();
    expect(state.attempt).toBe(1);
    expect(state.maxAttempts).toBe(3);
    expect(state.error).toBe(error);
  });

  it('should stop retry state', () => {
    const error = new HttpErrorResponse({ status: 500, statusText: 'Error' });
    service.startRetry(error, 1, 3);
    service.stopRetry();
    
    const state = service.getCurrentState();
    expect(state.isRetrying).toBeFalse();
    expect(state.attempt).toBe(0);
  });

  it('should check if max attempts reached', () => {
    expect(service.hasReachedMaxAttempts(4, 3)).toBeTrue();
    expect(service.hasReachedMaxAttempts(2, 3)).toBeFalse();
  });
});

