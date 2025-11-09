import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';
import { ToastNotification, NotificationToastComponent } from '../notification-toast/notification-toast.component';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule, NotificationToastComponent],
  templateUrl: './toast-container.component.html',
  styleUrls: ['./toast-container.component.scss']
})
export class ToastContainerComponent implements OnInit {
  toasts: ToastNotification[] = [];

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.toastService.toasts$.subscribe((toasts: ToastNotification[]) => {
      this.toasts = toasts;
    });
  }

  onToastClosed(id: number | undefined): void {
    if (id) {
      this.toastService.close(id);
    }
  }

  trackByToastId(index: number, toast: ToastNotification): number | undefined {
    return toast.id;
  }
}
