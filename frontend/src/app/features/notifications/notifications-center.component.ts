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

  constructor(
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.notificationService.notifications$
      .pipe(takeUntil(this.destroy$))
      .subscribe(nots => {
        this.notifications = nots;
        this.isLoading = false;
        this.hasError = false;
        console.log('📋 Notificaciones actualizadas en el componente:', nots.length);
        if (!this.isFirstLoad) {
          this.notifications = nots;
          this.isLoading = false;
          this.hasError = false;
        }
      });

    this.notificationService.unreadCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe();

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
  }

  get filteredNotifications(): Notify[] {
    let filtered = this.notifications;
    
    if (this.activeTab === 'unread') {
      filtered = filtered.filter(notification => !notification.read);
    }
    
    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const searchLower = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(notification => 
        notification.message.toLowerCase().includes(searchLower) ||
        notification.type.type.toLowerCase().includes(searchLower) ||
        notification.title.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered;
  }

  get allCount(): number {
    return this.notifications.length;
  }

  get unreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  setActiveTab(tab: 'all' | 'unread'): void {
    this.activeTab = tab;
  }

  markAllAsRead(): void {
    console.log('Marcar todas como leídas - Funcionalidad pendiente');
  }

  allowNotifications(): void {
    console.log('Permitir notificaciones - Funcionalidad pendiente');
  }

  markAsRead(notificationId: number): void {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification && notification.read) {
      return;
    }

    this.notificationService.markNotificationAsRead(notificationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {},
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

  onNotificationClick(notification: Notify): void {
    this.markAsRead(notification.id);
    
    if (notification.link && notification.link.trim() !== '') {
      const link = notification.link.trim();
      
      if (link.startsWith('http://') || link.startsWith('https://')) {
        window.open(link, '_blank');
      } else if (link.startsWith('/')) {
        this.router.navigate([link]);
      } else {
        this.router.navigate(['/' + link]);
      }
    }
  }

  hasLink(notification: Notify): boolean {
    return !!(notification.link && notification.link.trim() !== '');
  }

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
        next: () => {
          this.closeDeleteModal();
        },
        error: (error: any) => {
          console.error('Error al eliminar notificación:', error);
          this.closeDeleteModal();
          
          if (error.status === 404) {
            alert('Notificación no encontrada');
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

  getReadOpacity(isRead: boolean): string {
    return isRead ? 'opacity-50' : 'opacity-100';
  }

  getReadStyles(isRead: boolean): string {
    return isRead ? 'grayscale' : '';
  }
}