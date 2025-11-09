import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ToastNotification } from '../../shared/components/notification-toast/notification-toast.component';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastsSubject = new BehaviorSubject<ToastNotification[]>([]);
  public toasts$ = this.toastsSubject.asObservable();

  private idCounter = 0;

  /**
   * Mostrar una notificación toast
   */
  show(toast: Omit<ToastNotification, 'id' | 'createdAt'>): void {
    const id = ++this.idCounter;
    const newToast: ToastNotification = { 
      ...toast, 
      id,
      createdAt: new Date().toISOString()
    };
    
    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next([...currentToasts, newToast]);
  }

  /**
   * Cerrar una notificación específica
   */
  close(id: number): void {
    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next(currentToasts.filter(t => t.id !== id));
  }

  /**
   * Cerrar todas las notificaciones
   */
  closeAll(): void {
    this.toastsSubject.next([]);
  }

  /**
   * Métodos de conveniencia
   */
  success(title: string, message: string, link?: string): void {
    this.show({ title, message, type: 'success', link });
  }

  error(title: string, message: string, link?: string): void {
    this.show({ title, message, type: 'error', link });
  }

  warning(title: string, message: string, link?: string): void {
    this.show({ title, message, type: 'warning', link });
  }

  info(title: string, message: string, link?: string): void {
    this.show({ title, message, type: 'info', link });
  }
}
