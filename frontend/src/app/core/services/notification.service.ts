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
   * Normaliza la respuesta del backend para devolver siempre un array de notificaciones.
   * Algunos endpoints o respuestas (especialmente tras refresh de token) pueden devolver
   * { success: true, data: [...] } u otros wrappers. Normalizamos ambos casos.
   */
  private normalizeNotificationsPayload(payload: any): Notify[] {
    if (!payload) return [];

    // Caso 1: ya es un array
    if (Array.isArray(payload)) {
      return payload as Notify[];
    }

    // Caso 2: wrappers comunes (data, notifications, items)
    if (payload.data && Array.isArray(payload.data)) {
      return payload.data as Notify[];
    }

    if (payload.notifications && Array.isArray(payload.notifications)) {
      return payload.notifications as Notify[];
    }

    if (payload.items && Array.isArray(payload.items)) {
      return payload.items as Notify[];
    }

    // Caso 3: objeto con claves numéricas (p.ej. {0: {...}, 1: {...}, refreshToken: '...'})
    if (typeof payload === 'object' && payload !== null) {
      const numericKeys = Object.keys(payload).filter(k => /^\d+$/.test(k));
      if (numericKeys.length > 0) {
        // Ordenar por índice numérico y mapear a array
        const ordered = numericKeys
          .map(k => parseInt(k, 10))
          .sort((a, b) => a - b)
          .map(idx => (payload as any)[String(idx)]);

        // Filtrar valores falsy por seguridad
        return ordered.filter(Boolean) as Notify[];
      }
    }

    // Caso 4: single notification object (backend or websocket may enviar un objeto único)
    if (payload && typeof payload === 'object' && (payload.id || payload.title || payload.message)) {
      return [payload as Notify];
    }

    // No es iterable ni reconocible: devolver array vacío y loggear para diagnóstico
    console.warn('normalizeNotificationsPayload: payload no contiene un array de notificaciones', payload);
    return [];
  }

  /**
   * Obtiene todas las notificaciones del usuario autenticado
   */
  getMyNotifications(): Observable<Notify[]> {
    const url = `${this.baseUrl}/user-notify/my-notifications`;

    return this.http.get<Notify[]>(url).pipe(
      tap(raw => {
        const notifications = this.normalizeNotificationsPayload(raw);
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

  getNotificationTypes(): Observable<any[]> {
    const url = `${this.baseUrl}/type-notify`;

    return this.http.get<any[]>(url).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          return throwError(() => ({
            status: 404,
            message: 'No hay tipos de notificaciones'
          }));
        }
        
        return throwError(() => error);
      })
    );
  }

  /**
   * Crear notificación para administradores
   */
  createNotificationForAdmins(data: {
    title: string;
    message: string;
    typeNotifyId: number;
    link?: string;
  }): Observable<{
    id: number;
    title: string;
    message: string;
    link: string;
    type: {
      id: number;
      type: string;
      createdAt: string;
      updatedAt: string;
    };
    userNotify: Array<{
      id: number;
      user: {
        id: number;
        username: string;
        email: string;
        profilePhoto: string;
        emailVerified: boolean;
        verified: boolean;
        createdAt: string;
        updatedAt: string;
      };
      read: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
    createdAt: string;
    updatedAt: string;
  }> {
    const url = `${this.baseUrl}/notify/create/admins/new`;

    return this.http.post<{
      id: number;
      title: string;
      message: string;
      link: string;
      type: {
        id: number;
        type: string;
        createdAt: string;
        updatedAt: string;
      };
      userNotify: Array<{
        id: number;
        user: {
          id: number;
          username: string;
          email: string;
          profilePhoto: string;
          emailVerified: boolean;
          verified: boolean;
          createdAt: string;
          updatedAt: string;
        };
        read: boolean;
        createdAt: string;
        updatedAt: string;
      }>;
      createdAt: string;
      updatedAt: string;
    }>(url, data).pipe(
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error);
      })
    );
  }

  filterNotifications(filters: {
    search?: string;
    type?: number;
    minDate?: string;
    maxDate?: string;
  }): Observable<Notify[]> {
    const url = `${this.baseUrl}/user-notify/my-notifications/filters`;
    
    const body: any = {};
    
    if (filters.search && filters.search.trim() !== '') {
      body.search = filters.search.trim();
    }
    
    if (filters.type !== null && filters.type !== undefined) {
      body.type = filters.type;
    }
    
    if (filters.minDate && filters.minDate !== '') {
      body.minDate = new Date(filters.minDate).toISOString();
    }
    
    if (filters.maxDate && filters.maxDate !== '') {
      const maxDateObj = new Date(filters.maxDate);
      maxDateObj.setHours(23, 59, 59, 999);
      body.maxDate = maxDateObj.toISOString();
    }

    return this.http.post<Notify[]>(url, body).pipe(
      tap(raw => {
        const notifications = this.normalizeNotificationsPayload(raw);
        this.notificationsSubject.next(notifications);
        this.updateUnreadCount(notifications);
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          this.notificationsSubject.next([]);
          return throwError(() => ({
            status: 404,
            message: 'No se encontraron notificaciones con los filtros aplicados'
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
    // Aceptar también una notificación única pasada por error (convertir a array)
    let list: Notify[] = [];

    if (!notifications) {
      console.warn('updateUnreadCount: recibido valor no definido', notifications);
      this.unreadCountSubject.next(0);
      return;
    }

    if (Array.isArray(notifications)) {
      list = notifications;
    } else if ((notifications as any).id) {
      // Un solo objeto de notificación
      list = [notifications as any as Notify];
    } else {
      console.warn('updateUnreadCount: recibido valor no iterable', notifications);
      this.unreadCountSubject.next(0);
      return;
    }

    const unreadCount = list.filter(n => !n.read).length;
    this.unreadCountSubject.next(unreadCount);
  }
}