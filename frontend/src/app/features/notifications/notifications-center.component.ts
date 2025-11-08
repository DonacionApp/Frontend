import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NotificationService } from '../../core/services';
import { Notify } from '../../shared/model/notification.model'; 
import { Subject, takeUntil } from 'rxjs';
import { FooterComponent } from '../../shared/components/footer/footer.component';

@Component({
  selector: 'app-notifications-center',
  standalone: true,
  imports: [CommonModule, RouterModule, FooterComponent, FormsModule],
  templateUrl: './notifications-center.component.html',
  styleUrls: ['./notifications-center.component.scss']
})
export class NotificationsCenterComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  notifications: Notify[] = [];
  isLoading = true;
  hasError = false;
  errorMessage = '';
  
  // Estado de los tabs
  activeTab: 'all' | 'unread' = 'all';
  
  // Búsqueda
  searchTerm: string = '';

  constructor(
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadNotifications();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga las notificaciones del backend
   */
  loadNotifications(): void {
    this.isLoading = true;
    this.hasError = false;
    
    this.notificationService.getMyNotifications()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (notifications: Notify[]) => {
          this.notifications = notifications;
          this.isLoading = false;
        },
        error: (error: any) => {
          this.isLoading = false;
          if (error.status === 404) {
            this.notifications = [];
            this.hasError = false;
          } else if (error.status === 401) {
            this.hasError = true;
            this.errorMessage = 'No autorizado. Por favor inicia sesión nuevamente.';
            setTimeout(() => {
              this.router.navigate(['/auth/login']);
            }, 2000);
          } else {
            this.hasError = true;
            this.errorMessage = 'Error al cargar las notificaciones. Intenta nuevamente.';
          }
        }
      });
  }

  /**
   * Maneja el cambio en el campo de búsqueda
   */
  onSearchChange(): void {
    // La búsqueda se hace en tiempo real en el getter filteredNotifications
  }

  /**
   * Obtiene las notificaciones filtradas según el tab activo y búsqueda
   */
  get filteredNotifications(): Notify[] {
    let filtered = this.notifications;
    
    // Filtrar por búsqueda
    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const searchLower = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(notification => 
        notification.message.toLowerCase().includes(searchLower) ||
        notification.type.type.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered;
  }

  /**
   * Obtiene el contador de notificaciones para cada tab
   */
  get allCount(): number {
    return this.notifications.length;
  }

  get unreadCount(): number {
    return 0;
  }

  /**
   * Cambia el tab activo
   */
  setActiveTab(tab: 'all' | 'unread'): void {
    this.activeTab = tab;
  }

  /**
   * Maneja el click en marcar todas como leídas (funcionalidad futura)
   */
  markAllAsRead(): void {
    console.log('Marcar todas como leídas - Funcionalidad pendiente');
  }

  /**
   * Maneja el click en permitir notificaciones (funcionalidad futura)
   */
  allowNotifications(): void {
    console.log('Permitir notificaciones - Funcionalidad pendiente');
  }

  /**
   * Marca una notificación como leída (funcionalidad futura)
   */
  markAsRead(notificationId: number): void {
    console.log('Marcar como leída:', notificationId);
  }

  /**
   * Elimina una notificación
   */
  deleteNotification(notificationId: number, event: Event): void {
    event.stopPropagation();
    
    this.notificationService.deleteNotificationLocally(notificationId);
    this.notifications = this.notifications.filter(n => n.id !== notificationId);
    
  }

  /**
   * Obtiene el tiempo relativo desde que se creó la notificación
   */
  getRelativeTime(date: Date): string {
    const now = new Date();
    const notificationDate = new Date(date);
    const diffMs = now.getTime() - notificationDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    
    return notificationDate.toLocaleDateString('es-ES', { 
      day: 'numeric', 
      month: 'short' 
    });
  }

  /**
   * Obtiene el color del borde izquierdo según el tipo de notificación y estado de lectura
   */
  getNotificationBorderColor(type: string, isRead: boolean): string {
    if (isRead) {
      return 'border-gray-200';
    }
    
    switch (type.toLowerCase()) {
      case 'informacion':
      case 'información':
        return 'border-green-500';
      case 'alerta':
        return 'border-yellow-500';
      case 'recordatorio':
        return 'border-blue-500';
      default:
        return 'border-gray-400';
    }
  }

  /**
   * Obtiene el color de fondo según el tipo de notificación y estado de lectura
   */
  getNotificationBgColor(type: string, isRead: boolean): string {
    if (isRead) {
      return 'bg-white';
    }
    
    switch (type.toLowerCase()) {
      case 'informacion':
      case 'información':
        return 'bg-green-50';
      case 'alerta':
        return 'bg-yellow-50';
      case 'recordatorio':
        return 'bg-blue-50';
      default:
        return 'bg-gray-50';
    }
  }

  /**
   * Obtiene el color de fondo del ícono según el tipo de notificación y estado de lectura
   */
  getNotificationIconBg(type: string, isRead: boolean): string {
    if (isRead) {
      return 'bg-gray-100';
    }
    
    switch (type.toLowerCase()) {
      case 'informacion':
      case 'información':
        return 'bg-green-100';
      case 'alerta':
        return 'bg-yellow-100';
      case 'recordatorio':
        return 'bg-blue-100';
      default:
        return 'bg-gray-100';
    }
  }

  /**
   * Obtiene el color del ícono según el tipo de notificación y estado de lectura
   */
  getNotificationIconColor(type: string, isRead: boolean): string {
    if (isRead) {
      return 'text-gray-500';
    }
    
    switch (type.toLowerCase()) {
      case 'informacion':
      case 'información':
        return 'text-green-600';
      case 'alerta':
        return 'text-yellow-600';
      case 'recordatorio':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  }

  /**
   * Obtiene el color del badge según el tipo de notificación y estado de lectura
   */
  getNotificationBadgeColor(type: string, isRead: boolean): string {
    if (isRead) {
      return 'bg-gray-100 text-gray-600';
    }
    
    switch (type.toLowerCase()) {
      case 'informacion':
      case 'información':
        return 'bg-green-100 text-green-800';
      case 'alerta':
        return 'bg-yellow-100 text-yellow-800';
      case 'recordatorio':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  /**
   * Obtiene las clases de opacidad según el estado de lectura
   */
  getReadOpacity(isRead: boolean): string {
    return isRead ? 'opacity-50' : 'opacity-100';
  }

  /**
   * Obtiene las clases adicionales de estilo para notificaciones leídas
   */
  getReadStyles(isRead: boolean): string {
    return isRead ? 'grayscale' : '';
  }
}