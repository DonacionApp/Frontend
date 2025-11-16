import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RetryService } from '../../../core/services/retry.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-retry-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="isRetrying" 
         class="fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-sm">
      <div class="flex items-center gap-3">
        <div class="flex-shrink-0">
          <div class="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div class="flex-1">
          <p class="text-sm font-medium text-gray-900">
            Reintentando petición...
          </p>
          <p class="text-xs text-gray-500 mt-1">
            Intento {{ attempt }} de {{ maxAttempts }}
          </p>
          <div *ngIf="delay > 0" class="mt-2">
            <div class="w-full bg-gray-200 rounded-full h-1.5">
              <div class="bg-blue-600 h-1.5 rounded-full transition-all duration-300" 
                   [style.width.%]="progressPercentage"></div>
            </div>
            <p class="text-xs text-gray-500 mt-1 text-right">
              Esperando {{ remainingSeconds }}s...
            </p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .animate-spin {
      animation: spin 1s linear infinite;
    }
  `]
})
export class RetryIndicatorComponent implements OnInit, OnDestroy {
  isRetrying = false;
  attempt = 0;
  maxAttempts = 3;
  delay = 0;
  remainingSeconds = 0;
  progressPercentage = 0;

  private subscription?: Subscription;
  private countdownInterval?: any;

  constructor(private retryService: RetryService) {}

  ngOnInit(): void {
    this.subscription = this.retryService.getState().subscribe(state => {
      this.isRetrying = state.isRetrying;
      this.attempt = state.attempt;
      this.maxAttempts = state.maxAttempts;
      this.delay = state.delay;

      if (state.isRetrying && state.delay > 0) {
        this.startCountdown(state.delay);
      } else {
        this.stopCountdown();
      }
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.stopCountdown();
  }

  private startCountdown(totalDelay: number): void {
    this.stopCountdown();
    
    const startTime = Date.now();
    const updateCountdown = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, totalDelay - elapsed);
      
      this.remainingSeconds = Math.ceil(remaining / 1000);
      this.progressPercentage = Math.min(100, (elapsed / totalDelay) * 100);

      if (remaining > 0) {
        this.countdownInterval = setTimeout(updateCountdown, 100);
      } else {
        this.stopCountdown();
      }
    };

    updateCountdown();
  }

  private stopCountdown(): void {
    if (this.countdownInterval) {
      clearTimeout(this.countdownInterval);
      this.countdownInterval = undefined;
    }
    this.remainingSeconds = 0;
    this.progressPercentage = 0;
  }
}

