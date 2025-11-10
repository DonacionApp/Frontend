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
  }

  /**
   * Marca una notificación como leída
   */
  markNotificationAsRead(notificationId: number): Observable<{ message: string }> {
    const url = `${this.baseUrl}/user-notify/my-notifications/mark-as-read/${notificationId}`;

    return this.http.patch<{ message: string }>(url, {}).pipe(
      tap(() => {
        // Actualizar el estado local de la notificación
        const currentNotifications = this.notificationsSubject.value;
        const updatedNotifications = currentNotifications.map(notification => 
          notification.id === notificationId 
            ? { ...notification, read: true } 
            : notification
        );
        this.notificationsSubject.next(updatedNotifications);
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

  markAllNotificationsAsRead(): Observable<{ message: string; status: number; updated: number; refreshToken?: string }> {
    const url = `${this.baseUrl}/user-notify/my-notifications/mark-all-as-read`;

    return this.http.put<{ message: string; status: number; updated: number; refreshToken?: string }>(url, {}).pipe(
      tap((response) => {
        const currentNotifications = this.notificationsSubject.value;
        const updatedNotifications = currentNotifications.map(notification => ({
          ...notification,
          read: true
        }));
        this.notificationsSubject.next(updatedNotifications);
        this.updateUnreadCount(updatedNotifications);
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          return throwError(() => ({
            status: 401,
            message: 'Token inválido'
          }));
        }

        return throwError(() => ({
          status: error.status || 500,
          message: error.error?.message || 'Error al marcar todas las notificaciones como leídas'
        }));
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
    console.log('📬 Notificación recibida por WebSocket:', raw);

    // Si la notificación tiene una acción específica
    if (raw.action === 'deleted') {
      // Eliminar la notificación de la lista local
      this.deleteNotificationLocally(raw.notificationId);
      return;
    }

    // Si es una actualización, recargar todas las notificaciones para obtener el estado actualizado
    if (raw.action === 'updated') {
      // Recargar todas las notificaciones para obtener el estado actualizado
      this.getMyNotifications().subscribe();
      return;
    }

    // Si es una nueva notificación, recargar todas las notificaciones
    // Esto asegura que tenemos la estructura completa con userNotify y el estado correcto
      if (raw.id) {
      // Recargar todas las notificaciones para obtener la estructura completa
      this.getMyNotifications().subscribe({
        next: () => {
          console.log('✅ Notificaciones recargadas después de recibir nueva notificación por WebSocket');
          // además, notificar visualmente mediante el servicio de toasts compartido
          try {
            this.sharedNotificationService.notify({
              title: raw.title || 'Nueva notificación',
              message: raw.message || '',
              type: raw.type || 'info',
              duration: 6000,
              createdAt: raw.createdAt
            });
          } catch (e) {
            // silencioso si falla
            console.warn('No se pudo emitir toast por sharedNotificationService', e);
          }
        },
        error: (error) => {
          console.error('❌ Error al recargar notificaciones después de WebSocket:', error);
          // Si falla la recarga, intentar agregar la notificación directamente
          this.addNotificationDirectly(raw);
        }
      });
    }
  }

  /**
   * Agregar notificación directamente sin recargar (fallback)
   */
  private addNotificationDirectly(raw: any): void {
    // El backend envía: { id, title, message, type, createdAt, updatedAt?, data? }
    // Necesitamos construir la estructura Notify
    const notification: Notify = {
      id: raw.id,
      title: raw.title,
      message: raw.message,
      type: raw.type, // El backend envía el objeto type completo
      read: false, // Por defecto, las nuevas notificaciones no están leídas
      createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date()
    };

    const currentNotifications = this.notificationsSubject.value;
    // Evitar duplicados por id
    if (!currentNotifications.some(n => n.id === notification.id)) {
      const updatedNotifications = [notification, ...currentNotifications];
      this.notificationsSubject.next(updatedNotifications);
      this.updateUnreadCount(updatedNotifications);
      console.log('✅ Notificación agregada directamente a la lista');
      // emitir también como toast visual
      try {
        this.sharedNotificationService.notify({
          title: raw.title || notification.title || 'Nueva notificación',
          message: raw.message || notification.message || '',
          type: (raw.type as any) || 'info',
          duration: 6000,
          createdAt: raw.createdAt || notification.createdAt?.toString()
        });
      } catch (e) {
        console.warn('No se pudo emitir toast por sharedNotificationService', e);
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