import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { ToastNotification } from '../model/toast-notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private subject = new Subject<ToastNotification>();
  private idSeq = 1;

  /** Observable para que el contenedor se suscriba */
  get notifications$(): Observable<ToastNotification> {
    return this.subject.asObservable();
  }

  /** Encolar / emitir una notificación */
  notify(payload: Partial<ToastNotification>) {
    const n: ToastNotification = {
      id: this.idSeq++,
      title: payload.title || 'Notificación',
      message: payload.message || '',
      type: (payload.type as any) || 'info',
      link: payload.link,
      createdAt: payload.createdAt || new Date().toISOString(),
      duration: payload.duration ?? 5000,
    };
    this.subject.next(n);
    return n.id;
  }

  // helpers
  info(title: string, message: string, opts?: Partial<ToastNotification>) {
    return this.notify({ ...opts, title, message, type: 'info' });
  }
  success(title: string, message: string, opts?: Partial<ToastNotification>) {
    return this.notify({ ...opts, title, message, type: 'success' });
  }
  warning(title: string, message: string, opts?: Partial<ToastNotification>) {
    return this.notify({ ...opts, title, message, type: 'warning' });
  }
  error(title: string, message: string, opts?: Partial<ToastNotification>) {
    return this.notify({ ...opts, title, message, type: 'error' });
  }

  // No persistence here; container maneja la cola/local state
}
