import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

export interface ToastNotification {
  id?: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  link?: string;
  createdAt?: string;
  duration?: number; // Duración en ms (default: 5000)
}

@Component({
  selector: 'app-notification-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-toast.component.html',
  styleUrls: ['./notification-toast.component.scss']
})
export class NotificationToastComponent implements OnInit, OnDestroy {
  @Input() notification!: ToastNotification;
  @Output() closed = new EventEmitter<void>();

  private autoCloseTimer?: number;
  visible = false;
  progressDuration = 5; // Duración en segundos para la animación CSS
  maxMessageLength = 120; // Longitud máxima del mensaje antes de truncar
  isMessageTruncated = false;
  truncatedMessage = '';

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Truncar mensaje si es muy largo
    this.truncateMessage();

    // Pequeño delay para activar la animación CSS
    setTimeout(() => this.visible = true, 10);

    // Auto-cerrar después de la duración especificada
    const duration = this.notification.duration || 5000;
    this.progressDuration = duration / 1000; // Convertir a segundos para CSS
    this.autoCloseTimer = window.setTimeout(() => {
      this.close();
    }, duration);
  }

  ngOnDestroy(): void {
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
    }
  }

  /**
   * Cerrar la notificación
   */
  close(): void {
    this.closed.emit();
  }

  /**
   * Manejar click en la notificación
   */
  onClick(): void {
    // Si tiene un link específico, ir a ese link, sino ir al centro de notificaciones
    const targetLink = this.notification.link || '/notifications';
    this.router.navigate([targetLink]);
    this.close();
  }

  /**
   * Truncar mensaje si es muy largo
   */
  private truncateMessage(): void {
    if (this.notification.message.length > this.maxMessageLength) {
      this.isMessageTruncated = true;
      this.truncatedMessage = this.notification.message.substring(0, this.maxMessageLength) + '...';
    } else {
      this.isMessageTruncated = false;
      this.truncatedMessage = this.notification.message;
    }
  }

  /**
   * Obtener el icono según el tipo
   */
  getIcon(): string {
    switch (this.notification.type) {
      case 'success':
        return 'bi-check-circle-fill';
      case 'error':
        return 'bi-x-circle-fill';
      case 'warning':
        return 'bi-exclamation-triangle-fill';
      case 'info':
      default:
        return 'bi-info-circle-fill';
    }
  }

  /**
   * Obtener clases CSS según el tipo
   */
  getTypeClass(): string {
    return `toast-${this.notification.type}`;
  }

  /**
   * Formatear fecha relativa
   */
  getRelativeTime(): string {
    if (!this.notification.createdAt) return 'Ahora';

    const now = new Date().getTime();
    const notificationTime = new Date(this.notification.createdAt).getTime();
    const diff = Math.floor((now - notificationTime) / 1000); // diferencia en segundos

    if (diff < 60) return 'Ahora';
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
    return `Hace ${Math.floor(diff / 86400)} días`;
  }
}
