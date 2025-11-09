import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { NotificationService } from '../../services/notification.service';
import { ToastNotification } from '../../model/toast-notification.model';
import { NotificationToastComponent } from '../notification-toast/notification-toast.component';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule, NotificationToastComponent],
  templateUrl: './toast-container.component.html',
  styleUrls: ['./toast-container.component.scss']
})
export class ToastContainerComponent implements OnInit, OnDestroy {
  private sub?: Subscription;

  visible: Array<{ id: number; notification: ToastNotification; leaving?: boolean }> = [];
  queue: ToastNotification[] = [];
  maxVisible = 2;

  // exit animation duration in ms (match SCSS)
  private exitAnim = 320;

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.sub = this.notificationService.notifications$.subscribe(n => this.enqueue(n));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private enqueue(n: ToastNotification) {
    if (!n.id) n.id = Date.now();
    if (this.visible.length < this.maxVisible) {
      this.visible.push({ id: n.id!, notification: n });
    } else {
      this.queue.push(n);
      this.startReplaceOldest();
    }
  }

  private startReplaceOldest() {
    const oldest = this.visible[0];
    if (!oldest || oldest.leaving) return;
    oldest.leaving = true;

    setTimeout(() => {
      this.removeVisibleById(oldest.id);
      const next = this.queue.shift();
      if (next) this.visible.push({ id: next.id!, notification: next });
    }, this.exitAnim);
  }

  removeVisibleById(id: number) {
    const idx = this.visible.findIndex(v => v.id === id);
    if (idx !== -1) this.visible.splice(idx, 1);
  }

  onChildClosed(item: { id: number; notification: ToastNotification }) {
    // called when NotificationToastComponent emits closed
    this.removeVisibleById(item.id);
    const next = this.queue.shift();
    if (next) this.visible.push({ id: next.id!, notification: next });
  }

  trackByToastId(index: number, item: { id: number; notification: ToastNotification }) {
    return item.id;
  }
}
