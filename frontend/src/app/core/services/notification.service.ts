import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Notify } from '../../shared/model/notification.model';
import { WebsocketService } from './websocket.service';
import { NotificationService as SharedNotificationService } from '../../shared/services/notification.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private baseUrl = environment.apiBackendUrl;
  private notificationsSubject = new BehaviorSubject<Notify[]>([]);
  private unreadCountSubject = new BehaviorSubject<number>(0);
  
  public notifications$ = this.notificationsSubject.asObservable();
  public unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(
    private http: HttpClient,
    private websocketService: WebsocketService,
    private sharedNotificationService: SharedNotificationService
  ) {
    // Suscribirse a nuevas notificaciones del WebSocket
    this.websocketService.notification$.subscribe(notification => {
      this.handleWebSocketNotification(notification);
    });
  }

  /**
   * Obtiene todas las notificaciones del usuario autenticado
   */
  getMyNotifications(): Observable<Notify[]> {
    const url = `${this.baseUrl}/user-notify/my-notifications`;

    return this.http.get<Notify[]>(url).pipe(
      tap(notifications => {
        this.notificationsSubject.next(notifications);
        this.updateUnreadCount(notifications);
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          this.notificationsSubject.next([]);
          return throwError(() => ({
            status: 404,
            message: 'El usuario no tiene notificaciones'
          }));
        }
        
        if (error.status === 401) {
          return throwError(() => ({
            status: 401,
            message: 'No autorizado'
          }));
        }

        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene las notificaciones actuales del subject
   */
  getCurrentNotifications(): Notify[] {
    return this.notificationsSubject.value;
  }

  /**
   * Limpia el estado de notificaciones
   */
  clearNotifications(): void {
    this.notificationsSubject.next([]);
  }

  /**
   * Elimina una notificación del estado local
   */
  deleteNotificationLocally(notificationId: number): void {
    const currentNotifications = this.notificationsSubject.value;
    const updatedNotifications = currentNotifications.filter(
      notification => notification.id !== notificationId
    );
    this.notificationsSubject.next(updatedNotifications);
    this.updateUnreadCount(updatedNotifications);
  }

  /**
   * Marca una notificación como leída
   */
  markNotificationAsRead(notificationId: number): Observable<{ message: string }> {
    const url = `${this.baseUrl}/user-notify/my-notifications/mark-as-read/${notificationId}`;

    return this.http.patch<{ message: string }>(url, {}).pipe(
      tap(() => {
        const currentNotifications = this.notificationsSubject.value;
        const updatedNotifications = currentNotifications.map(notification => 
          notification.id === notificationId 
            ? { ...notification, read: true } 
            : notification
        );
        this.notificationsSubject.next(updatedNotifications);
        this.updateUnreadCount(updatedNotifications);
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          return throwError(() => ({
            status: 404,
            message: 'Notificación no encontrada'
          }));
        }
        
        if (error.status === 401) {
          return throwError(() => ({
            status: 401,
            message: 'No autorizado'
          }));
        }

        if (error.status === 403) {
          return throwError(() => ({
            status: 403,
            message: 'No tienes permiso para marcar esta notificación'
          }));
        }

        return throwError(() => error);
      })
    );
  }

  /**
   * Elimina una notificación del backend
   */
  deleteNotification(notificationId: number): Observable<{ message: string }> {
    const url = `${this.baseUrl}/user-notify/my-notifications/delete/${notificationId}`;

    return this.http.delete<{ message: string }>(url).pipe(
      tap(() => {
        // Actualizar el estado local eliminando la notificación
        this.deleteNotificationLocally(notificationId);
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          return throwError(() => ({
            status: 404,
            message: 'Notificación no encontrada'
          }));
        }
        
        if (error.status === 401) {
          return throwError(() => ({
            status: 401,
            message: 'No autorizado'
          }));
        }

        if (error.status === 403) {
          return throwError(() => ({
            status: 403,
            message: 'No tienes permiso para eliminar esta notificación'
          }));
        }

        return throwError(() => error);
      })
    );
  }

  /**
   * Obtener contador de notificaciones no leídas
   */
  getUnreadCount(): number {
    return this.unreadCountSubject.value;
  }

  /**
   * Manejar notificaciones recibidas por WebSocket
   */
  private handleWebSocketNotification(raw: any): void {
    if (raw.action === 'deleted') {
      this.deleteNotificationLocally(raw.notificationId);
      return;
    }

    if (raw.action === 'updated') {
      this.getMyNotifications().subscribe();
      return;
    }

    if (raw.id) {
      this.getMyNotifications().subscribe({
        next: () => {
          try {
            this.sharedNotificationService.notify({
              title: raw.title || 'Nueva notificación',
              message: raw.message || '',
              type: raw.type || 'info',
              duration: 6000,
              createdAt: raw.createdAt
            });
          } catch (e) {
            console.warn('No se pudo emitir toast:', e);
          }
        },
        error: (error) => {
          console.error('Error al recargar notificaciones:', error);
          this.addNotificationDirectly(raw);
        }
      });
    }
  }

  /**
   * Agregar notificación directamente sin recargar (fallback)
   */
  private addNotificationDirectly(raw: any): void {
    const notification: Notify = {
      id: raw.id,
      title: raw.title,
      message: raw.message,
      type: raw.type,
      read: false,
      createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date()
    };

    const currentNotifications = this.notificationsSubject.value;
    if (!currentNotifications.some(n => n.id === notification.id)) {
      const updatedNotifications = [notification, ...currentNotifications];
      this.notificationsSubject.next(updatedNotifications);
      this.updateUnreadCount(updatedNotifications);
      
      try {
        this.sharedNotificationService.notify({
          title: raw.title || notification.title || 'Nueva notificación',
          message: raw.message || notification.message || '',
          type: (raw.type as any) || 'info',
          duration: 6000,
          createdAt: raw.createdAt || notification.createdAt?.toString()
        });
      } catch (e) {
        console.warn('No se pudo emitir toast:', e);
      }
    }
  }

  /**
   * Actualizar contador de no leídas
   */
  private updateUnreadCount(notifications: Notify[]): void {
    const unreadCount = notifications.filter(n => !n.read).length;
    this.unreadCountSubject.next(unreadCount);
  }
}