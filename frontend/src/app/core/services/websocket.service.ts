import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Notification {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  link?: string;
  read: boolean;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private socket: Socket | null = null;
  private notificationSubject = new Subject<Notification>();
  private connectionStatus = new BehaviorSubject<boolean>(false);

  // Observable público para que los componentes se suscriban
  public notification$ = this.notificationSubject.asObservable();
  public connectionStatus$ = this.connectionStatus.asObservable();

  constructor() {}

  /**
   * Conectar al servidor WebSocket con autenticación
   */
  connect(token: string): void {
    // Si ya hay una conexión activa, desconectar primero
    if (this.socket) {
      if (this.socket.connected) {
        console.log('WebSocket ya está conectado');
        return;
      }
      // Si hay un socket pero no está conectado, limpiarlo
      this.removeListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    // Limpiar el token si viene con "Bearer "
    const cleanToken = token.replace('Bearer ', '').trim();
    
    console.log('Conectando WebSocket al namespace /notifications con token');
    // El backend usa el namespace /notifications según notify.gateway.ts
    this.socket = io(`${environment.socketUrl}/notifications`, {
      transports: ['websocket', 'polling'],
      // El backend busca el token en auth.token, headers.authorization o query.token
      // Usamos auth.token que es la forma más directa
      auth: {
        token: cleanToken
      },
      // También podemos enviarlo en query como alternativa
      query: {
        token: cleanToken
      },
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.setupListeners();
  }

  /**
   * Configurar listeners de eventos del socket
   */
  private setupListeners(): void {
    if (!this.socket) return;

    // Limpiar listeners anteriores si existen (evitar duplicados)
    this.removeListeners();

    // Timeout para advertencia de no recepción de notificaciones
    let notificationTimeout: any = setTimeout(() => {
      console.warn('ADVERTENCIA: No se reciben notificaciones en tiempo real. Verifica tu conexión o permisos.');
    }, 30000);

    // Evento: Conexión establecida (evento nativo de socket.io)
    this.socket.on('connect', () => {
      console.log('✅ WebSocket conectado:', this.socket?.id);
      this.connectionStatus.next(true);
      clearTimeout(notificationTimeout);
    });

    // Evento: Conectado exitosamente (emitido por el backend después de validar el token)
    // El backend emite este evento en handleConnection después de validar el token
    this.socket.on('connected', (data: { message: string; userId: number; userName: string; timestamp: Date }) => {
      console.log('✅ Conectado al servidor de notificaciones:', data);
      this.connectionStatus.next(true);
      clearTimeout(notificationTimeout);
    });

    // Evento: Desconexión
    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket desconectado:', reason);
      this.connectionStatus.next(false);
      clearTimeout(notificationTimeout);
    });

    // Evento: Error de conexión
    this.socket.on('connect_error', (error) => {
      console.error('❌ Error de conexión WebSocket:', error);
      this.connectionStatus.next(false);
      clearTimeout(notificationTimeout);
    });

    // Evento: Nueva notificación (emitido por el backend)
    this.socket.on('notification', (notification: Notification) => {
      console.log('📬 Evento WebSocket recibido:', notification);
      clearTimeout(notificationTimeout);
      this.notificationSubject.next(notification);
    });

    // Evento: Error (emitido por el backend cuando hay problemas de autenticación)
    this.socket.on('error', (error: any) => {
      console.error('❌ Error en WebSocket:', error);
      this.connectionStatus.next(false);
      clearTimeout(notificationTimeout);
    });
  }

  /**
   * Remover todos los listeners del socket para evitar memory leaks
   */
  private removeListeners(): void {
    if (!this.socket) return;
    
    this.socket.off('connect');
    this.socket.off('connected');
    this.socket.off('disconnect');
    this.socket.off('connect_error');
    this.socket.off('notification');
    this.socket.off('error');
  }

  /**
   * Desconectar del servidor WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      this.removeListeners();
      this.socket.disconnect();
      this.socket = null;
      this.connectionStatus.next(false);
      console.log('WebSocket desconectado manualmente');
    }
  }

  /**
   * Reconectar WebSocket con nuevo token (usado cuando el token se renueva)
   */
  reconnectWithNewToken(newToken: string): void {
    if (!newToken) {
      console.warn('reconnectWithNewToken llamado sin token');
      return;
    }

    if (!this.socket) {
      // No hay socket inicializado: intentar conectar directamente con el nuevo token
      console.log('⚠️ No hay socket activo, intentando conectar con el nuevo token');
      try {
        this.connect(newToken);
      } catch (e) {
        console.error('Error intentando conectar WebSocket con nuevo token:', e);
      }
      return;
    }
    
    // Si el socket está conectado, no hacer nada (evitar desconexiones innecesarias)
    if (this.socket.connected) {
      console.log('✅ WebSocket ya está conectado, no es necesario reconectar');
      return;
    }
    
    // Si no está conectado, reconectar con el nuevo token
    console.log('🔄 Reconectando WebSocket con nuevo token...');
    this.disconnect();
    this.connect(newToken);
  }

  /**
   * Verificar si está conectado
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Emitir un evento al servidor
   */
  emit(event: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('No se puede emitir evento. WebSocket no conectado.');
    }
  }

  /**
   * Marcar una notificación como leída (usa el evento markAsRead del backend)
   */
  markNotificationAsRead(notificationId: number): Promise<{ success: boolean; notificationId?: number; message?: string; error?: string }> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('WebSocket no conectado'));
        return;
      }

      // El backend espera el evento 'markAsRead' con { notificationId: number }
      this.socket.emit('markAsRead', { notificationId }, (response: any) => {
        if (response?.success) {
          console.log('✓ Notificación marcada como leída:', notificationId);
          resolve(response);
        } else {
          console.error('❌ Error al marcar notificación como leída:', response?.error);
          reject(new Error(response?.error || 'Error desconocido'));
        }
      });
    });
  }

  /**
   * Obtener notificaciones del servidor (usa el evento getNotifications del backend)
   */
  getNotifications(): Promise<{ success: boolean; message?: string; error?: string }> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('WebSocket no conectado'));
        return;
      }

      this.socket.emit('getNotifications', {}, (response: any) => {
        if (response?.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Error desconocido'));
        }
      });
    });
  }

  /**
   * Escuchar un evento específico del servidor
   */
  on(event: string): Observable<any> {
    return new Observable(observer => {
      if (!this.socket) {
        observer.error('Socket no inicializado');
        return;
      }

      const handler = (data: any) => {
        observer.next(data);
      };

      this.socket.on(event, handler);

      // Cleanup cuando se desuscriba
      return () => {
        if (this.socket) {
          this.socket.off(event, handler);
        }
      };
    });
  }
}
