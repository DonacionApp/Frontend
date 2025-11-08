import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Notify } from '../../shared/model/notification.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private baseUrl = environment.apiBackendUrl;
  private notificationsSubject = new BehaviorSubject<Notify[]>([]);
  
  public notifications$ = this.notificationsSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Obtiene todas las notificaciones del usuario autenticado
   */
  getMyNotifications(): Observable<Notify[]> {
    const url = `${this.baseUrl}/user-notify/my-notifications`;

    return this.http.get<Notify[]>(url).pipe(
      tap(notifications => {
        this.notificationsSubject.next(notifications);
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
}