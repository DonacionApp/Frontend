import { TestBed } from '@angular/core/testing';
import { RateLimitService } from './rate-limit.service';

describe('RateLimitService', () => {
  let service: RateLimitService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RateLimitService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initially not be blocked', () => {
    expect(service.isBlocked()).toBeFalse();
  });

  it('should block requests when setBlock is called', () => {
    service.setBlock(60);
    expect(service.isBlocked()).toBeTrue();
  });

  it('should clear block when clearBlock is called', () => {
    service.setBlock(60);
    expect(service.isBlocked()).toBeTrue();
    
    service.clearBlock();
    expect(service.isBlocked()).toBeFalse();
  });

  it('should calculate remaining seconds correctly', (done) => {
    service.setBlock(2); // Block for 2 seconds
    
    const remaining = service.getRemainingSeconds();
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(2);
    
    setTimeout(() => {
      expect(service.isBlocked()).toBeFalse();
      done();
    }, 2100);
  });

  it('should parse string retryAfter value', () => {
    service.setBlock('120');
    expect(service.isBlocked()).toBeTrue();
    
    const state = service.getCurrentState();
    expect(state.retryAfter).toBe(120);
  });

  it('should use default seconds when retryAfter is not provided', () => {
    service.setBlock(undefined, 30);
    expect(service.isBlocked()).toBeTrue();
    
    const state = service.getCurrentState();
    expect(state.retryAfter).toBe(30);
  });
});

