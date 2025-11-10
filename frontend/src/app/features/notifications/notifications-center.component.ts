import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NotificationService } from '../../core/services';
import { Notify } from '../../shared/model/notification.model'; 
import { Subject, takeUntil } from 'rxjs';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';

@Component({
  selector: 'app-notifications-center',
  standalone: true,
  imports: [CommonModule, RouterModule, FooterComponent, FormsModule, ModalComponent],
  templateUrl: './notifications-center.component.html',
  styleUrls: ['./notifications-center.component.scss']
})
export class NotificationsCenterComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private isFirstLoad = true;
  
  notifications: Notify[] = [];
  isLoading = true;
  hasError = false;
  errorMessage = '';
  
  // Estado de los tabs
  activeTab: 'all' | 'unread' = 'all';
  
  // Búsqueda
  searchTerm: string = '';

  // Modal de confirmación de eliminación
  showDeleteModal = false;
  notificationToDelete: number | null = null;

  // Filtros
  showFilters = false;
  notificationTypes: any[] = [];
  selectedType: number | null = null;
  minDate: string = '';
  maxDate: string = '';
  hasActiveFilters = false;

  constructor(
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Suscribirse al observable reactivo de notificaciones
    // Esto se actualizará automáticamente cuando lleguen nuevas notificaciones por WebSocket
    this.notificationService.notifications$
      .pipe(takeUntil(this.destroy$))
      .subscribe(nots => {
        console.log('📋 Notificaciones actualizadas en el componente:', nots.length);
        if (!this.isFirstLoad) {
          this.notifications = nots;
          this.isLoading = false;
          this.hasError = false;
        }
      });

    // Suscribirse al contador de no leídas para actualizarlo automáticamente
    this.notificationService.unreadCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe(count => {
        console.log('🔔 Contador de no leídas actualizado:', count);
      });

    // Cargar las notificaciones iniciales desde el backend
    this.loadNotifications();
    this.loadNotificationTypes();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga las notificaciones del backend
   */
  loadNotifications(): void {
    this.notifications = [];
    this.isLoading = true;
    this.hasError = false;
    
    this.notificationService.getMyNotifications()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (notifications: Notify[]) => {
          this.notifications = notifications;
          this.isLoading = false;
          this.isFirstLoad = false;
        },
        error: (error: any) => {
          this.isLoading = false;
          this.isFirstLoad = false;
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
    this.applyFilters();
  }

  onTypeChange(): void {
    this.applyFilters();
  }

  onDateChange(): void {
    if ((this.minDate !== '' && this.maxDate !== '') || (this.minDate === '' && this.maxDate === '')) {
      this.applyFilters();
    }
  }

  /**
   * Obtiene las notificaciones filtradas según el tab activo
   */
  get filteredNotifications(): Notify[] {
    let filtered = this.notifications;
    
    // Filtrar por tab activo
    if (this.activeTab === 'unread') {
      filtered = filtered.filter(notification => !notification.read);
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
    return this.notifications.filter(n => !n.read).length;
  }

  /**
   * Cambia el tab activo
   */
  setActiveTab(tab: 'all' | 'unread'): void {
    this.activeTab = tab;
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  clearFilters(): void {
    if (!this.hasActiveFilters) {
      return;
    }

    this.selectedType = null;
    this.minDate = '';
    this.maxDate = '';
    this.searchTerm = '';
    this.hasActiveFilters = false;
    this.loadNotifications();
  }

  loadNotificationTypes(): void {
    this.notificationService.getNotificationTypes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (types) => {
          this.notificationTypes = types;
        },
        error: (error) => {
          if (error.status === 404) {
            this.notificationTypes = [];
          } else {
            console.error('Error al cargar tipos de notificaciones:', error);
          }
        }
      });
  }

  applyFilters(): void {
    const checkActiveFilters = 
      (this.searchTerm && this.searchTerm.trim() !== '') ||
      this.selectedType !== null ||
      (this.minDate !== '' && this.maxDate !== '');

    if (!checkActiveFilters) {
      this.hasActiveFilters = false;
      this.loadNotifications();
      return;
    }

    this.hasActiveFilters = true;
    this.notifications = [];
    this.isLoading = true;
    this.hasError = false;

    const filters: {
      search?: string;
      type?: number;
      minDate?: string;
      maxDate?: string;
    } = {};

    if (this.searchTerm && this.searchTerm.trim() !== '') {
      filters.search = this.searchTerm;
    }

    if (this.selectedType !== null) {
      filters.type = this.selectedType;
    }

    if (this.minDate !== '' && this.maxDate !== '') {
      filters.minDate = this.minDate;
      filters.maxDate = this.maxDate;
    }

    this.notificationService.filterNotifications(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (notifications) => {
          this.notifications = notifications;
          this.isLoading = false;
        },
        error: (error) => {
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
            this.errorMessage = 'Error al filtrar las notificaciones. Intenta nuevamente.';
          }
        }
      });
  }

  /**
   * Marca todas las notificaciones como leídas
   */
  markAllAsRead(): void {
    const hasUnreadNotifications = this.notifications.some(n => !n.read);
    
    if (!hasUnreadNotifications) {
      return;
    }

    this.notificationService.markAllNotificationsAsRead()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.notifications = this.notifications.map(n => ({
            ...n,
            read: true
          }));
        },
        error: (error: any) => {
          if (error.status === 401) {
            alert('No autorizado. Por favor inicia sesión nuevamente.');
            this.router.navigate(['/auth/login']);
          } else {
            alert(error.message || 'Error al marcar todas las notificaciones como leídas.');
          }
        }
      });
  }

  /**
   * Maneja el click en permitir notificaciones (funcionalidad futura)
   */
  allowNotifications(): void {
    console.log('Permitir notificaciones - Funcionalidad pendiente');
  }

  /**
   * Marca una notificación como leída
   */
  markAsRead(notificationId: number): void {
    // Evitar marcar si ya está leída
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification && notification.read) {
      return;
    }

    this.notificationService.markNotificationAsRead(notificationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Notificación marcada como leída:', response.message);
          // El estado se actualiza automáticamente por el servicio
        },
        error: (error: any) => {
          console.error('Error al marcar como leída:', error);
          if (error.status === 404) {
            alert('Notificación no encontrada');
          } else if (error.status === 401) {
            alert('No autorizado. Por favor inicia sesión nuevamente.');
            this.router.navigate(['/auth/login']);
          } else if (error.status === 403) {
            alert('No tienes permiso para marcar esta notificación');
          } else {
            alert('Error al marcar la notificación como leída. Intenta nuevamente.');
          }
        }
      });
  }

  /**
   * Muestra el modal de confirmación para eliminar
   */
  openDeleteModal(notificationId: number, event: Event): void {
    event.stopPropagation();
    this.notificationToDelete = notificationId;
    this.showDeleteModal = true;
  }

  /**
   * Cierra el modal de confirmación
   */
  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.notificationToDelete = null;
  }

  /**
   * Confirma y elimina la notificación
   */
  confirmDelete(): void {
    if (this.notificationToDelete === null) {
      return;
    }

    const notificationId = this.notificationToDelete;
    
    this.notificationService.deleteNotification(notificationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Notificación eliminada:', response.message);
          // El estado se actualiza automáticamente por el servicio
          this.closeDeleteModal();
        },
        error: (error: any) => {
          console.error('Error al eliminar notificación:', error);
          this.closeDeleteModal();
          
          if (error.status === 404) {
            alert('Notificación no encontrada');
            // El estado se actualiza automáticamente por el servicio
          } else if (error.status === 401) {
            alert('No autorizado. Por favor inicia sesión nuevamente.');
            this.router.navigate(['/auth/login']);
          } else if (error.status === 403) {
            alert('No tienes permiso para eliminar esta notificación');
          } else {
            alert('Error al eliminar la notificación. Intenta nuevamente.');
          }
        }
      });
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