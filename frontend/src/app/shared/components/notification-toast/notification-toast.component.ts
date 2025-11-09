import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ToastNotification } from '../../model/toast-notification.model';

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
  isExpanded = false; // para mostrar/ocultar mensaje completo
  isPaused = false; // para pausar el auto-close cuando el usuario pasa el mouse

  // control de tiempo para pausa/reanudar
  private autoCloseStart = 0;
  private remainingTime = 0;

  constructor(private router: Router) {}

  /**
   * Normaliza el tipo de notificación recibido (soporta valores en español)
   * y lo mapea a uno de: 'info' | 'success' | 'warning' | 'error'
   */
  get mappedType(): 'info' | 'success' | 'warning' | 'error' {
    if (!this.notification || !this.notification.type) return 'info';
    const t = String(this.notification.type).toLowerCase();
    // mapeo común (español + inglés)
    if (['success', 'exito', 'éxito', 'ok', 'confirmacion', 'confirmación'].includes(t)) return 'success';
    if (['error', 'danger', 'fallo'].includes(t)) return 'error';
    if (['warning', 'advertencia', 'alerta'].includes(t)) return 'warning';
    if (['info', 'informacion', 'información', 'recordatorio', 'notice'].includes(t)) return 'info';
    // fallback
    return 'info';
  }

  ngOnInit(): void {
    // Truncar mensaje si es muy largo
    this.truncateMessage();

    // Pequeño delay para activar la animación CSS
    setTimeout(() => this.visible = true, 10);

    // Auto-cerrar después de la duración especificada
    const duration = this.notification.duration || 5000;
    this.progressDuration = duration / 1000; // Convertir a segundos para CSS
    // inicializar control de tiempo para pausa/reanudar
    this.autoCloseStart = Date.now();
    this.remainingTime = duration;
    this.autoCloseTimer = window.setTimeout(() => this.close(), this.remainingTime);
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

  // Pausar el auto-close (por ejemplo, al hacer hover)
  pauseAutoClose(): void {
    if (this.isPaused) return;
    this.isPaused = true;
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = undefined;
    }
    // calcular tiempo restante
    const elapsed = Date.now() - this.autoCloseStart;
    this.remainingTime = Math.max(0, this.remainingTime - elapsed);
  }

  // Reanudar el auto-close
  resumeAutoClose(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.autoCloseStart = Date.now();
    if (this.remainingTime > 0) {
      this.autoCloseTimer = window.setTimeout(() => this.close(), this.remainingTime);
    } else {
      this.close();
    }
  }

  // Alternar expandir/colapsar mensaje cuando esté truncado
  toggleExpand(e?: Event): void {
    if (e) e.stopPropagation();
    this.isExpanded = !this.isExpanded;
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
    switch (this.mappedType) {
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
    return `toast-${this.mappedType}`;
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
