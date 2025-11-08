import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';

export interface AlertConfig {
  title: string;
  message: string;
  type: 'warning' | 'error' | 'success' | 'info';
  showCancelButton?: boolean;
  confirmButtonText?: string;
  cancelButtonText?: string;
  confirmButtonColor?: string;
  cancelButtonColor?: string;
}

@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alert.component.html',
  styleUrls: ['./alert.component.scss']
})
export class AlertComponent implements OnInit {
  isVisible = false;
  config: AlertConfig | null = null;
  isLoading = false;
  
  private resultSubject = new Subject<boolean>();
  
  ngOnInit(): void {}

  show(config: AlertConfig): Promise<boolean> {
    this.config = config;
    this.isVisible = true;
    this.isLoading = false;
    document.body.style.overflow = 'hidden';

    return new Promise((resolve) => {
      const subscription = this.resultSubject.subscribe((result) => {
        resolve(result);
        subscription.unsubscribe();
      });
    });
  }

  showLoading(title: string, message: string): void {
    this.config = {
      title,
      message,
      type: 'info',
      showCancelButton: false
    };
    this.isVisible = true;
    this.isLoading = true;
    document.body.style.overflow = 'hidden';
  }

  close(result: boolean = false): void {
    this.isVisible = false;
    this.isLoading = false;
    document.body.style.overflow = 'auto';
    this.resultSubject.next(result);
  }

  onConfirm(): void {
    this.close(true);
  }

  onCancel(): void {
    this.close(false);
  }

  getIconColor(): string {
    const colors = {
      warning: 'text-orange-500',
      error: 'text-red-500',
      success: 'text-green-500',
      info: 'text-blue-500'
    };
    return colors[this.config?.type || 'info'];
  }

  getIcon(): string {
    const icons = {
      warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
      error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
      success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
    };
    return icons[this.config?.type || 'info'];
  }
}
