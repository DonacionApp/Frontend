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

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Pequeño delay para activar la animación CSS
    setTimeout(() => this.visible = true, 10);

    // Auto-cerrar después de la duración especificada
    const duration = this.notification.duration || 5000;
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
<<<<<<< HEAD
   * Siempre redirige al centro de notificaciones
   */
  onClick(): void {
    // Si hay un link específico, usarlo; si no, ir al centro de notificaciones
    const route = this.notification.link || '/notifications';
    this.router.navigate([route]);
    this.close();
=======
   */
  onClick(): void {
    if (this.notification.link) {
      this.router.navigate([this.notification.link]);
      this.close();
    }
>>>>>>> 46ceb44 ( se implemento  el websocket.io-client)
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
