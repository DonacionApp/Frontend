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
  private msgSocket: Socket | null = null;
  private notificationSubject = new Subject<Notification>();
  private connectionStatus = new BehaviorSubject<boolean>(false);
  // messages/events subjects
  private messageSubject = new Subject<any>();
  private notificationMessageSubject = new Subject<any>();
  private unreadChatsSubject = new Subject<{ chatId: number; unreadInChat: number; totalUnreadChats: number }>();
  private joinedChatSubject = new Subject<{ chatId: number }>();
  private leftChatSubject = new Subject<{ chatId: number }>();
  private chatReadSubject = new Subject<{ chatId: number; userId: number }>();
  private joinedChats = new Set<number>();

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
        return;
      }
      // Si hay un socket pero no está conectado, limpiarlo
      this.removeListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    // Limpiar el token si viene con "Bearer "
    const cleanToken = token.replace('Bearer ', '').trim();
    
  // Connecting WebSocket to /notifications namespace
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
   * Conectar al gateway de mensajes (root namespace) para chats y notificaciones de mensajes
   */
  connectMessages(token: string): void {
    if (this.msgSocket) {
      if (this.msgSocket.connected) return;
      this.removeMessageListeners();
      this.msgSocket.disconnect();
      this.msgSocket = null;
    }

    const cleanToken = token.replace('Bearer ', '').trim();
    this.msgSocket = io(`${environment.socketUrl}`, {
      transports: ['websocket', 'polling'],
      auth: { token: cleanToken },
      query: { token: cleanToken },
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity
    });

    this.setupMessageListeners();
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
      this.connectionStatus.next(true);
      clearTimeout(notificationTimeout);
    });

    // Evento: Conectado exitosamente (emitido por el backend después de validar el token)
    // El backend emite este evento en handleConnection después de validar el token
    this.socket.on('connected', (data: { message: string; userId: number; userName: string; timestamp: Date }) => {
      this.connectionStatus.next(true);
      clearTimeout(notificationTimeout);
    });

    // Evento: Desconexión
    this.socket.on('disconnect', (reason) => {
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

  private setupMessageListeners(): void {
    if (!this.msgSocket) return;
    this.removeMessageListeners();

    this.msgSocket.on('connect', () => {

      for (const cid of Array.from(this.joinedChats)) {
        try { this.msgSocket?.emit('joinChat', { chatId: cid }); } catch (e) {}
      }
    });

    this.msgSocket.on('connected', (data: any) => {

    });

    this.msgSocket.on('disconnect', (reason: any) => {

    });

    this.msgSocket.on('connect_error', (err: any) => {
      console.error('Message socket connect_error', err);
    });

    this.msgSocket.on('message:new', (payload: any) => {
      try {
        try {
          const chatId = Number(payload?.chatId ?? payload?.chatID ?? payload?.chat_id ?? (payload?.message?.chatId));
          const msgs = payload?.messages ?? (payload?.message ? (Array.isArray(payload.message) ? payload.message : [payload.message]) : []);
          } catch (e) {}
      } catch (e) {}

      // keep existing behavior for subscribers
      this.messageSubject.next(payload);
    });

    // Notification for users not in room
    this.msgSocket.on('notification:message', (payload: any) => {
      this.notificationMessageSubject.next(payload);
    });

    // Server emits unread counters for chat(s)
    this.msgSocket.on('notification:unreadChats', (payload: any) => {
      try {
        const parsed = payload || {};
        const chatId = Number(parsed.chatId ?? parsed.chatID ?? parsed.chat_id);
        const unreadInChat = Number(parsed.unreadInChat ?? parsed.unread_in_chat ?? parsed.unread ?? 0) || 0;
        const totalUnreadChats = Number(parsed.totalUnreadChats ?? parsed.total_unread_chats ?? parsed.totalUnread ?? 0) || 0;
        if (!isNaN(chatId)) {
          this.unreadChatsSubject.next({ chatId, unreadInChat, totalUnreadChats });
        }
      } catch (e) {
      }
    });

    this.msgSocket.on('joinedChat', (payload: any) => {
      if (payload && payload.chatId) this.joinedChatSubject.next({ chatId: payload.chatId });
    });

    this.msgSocket.on('leftChat', (payload: any) => {
      if (payload && payload.chatId) this.leftChatSubject.next({ chatId: payload.chatId });
    });

    this.msgSocket.on('chat:read', (payload: any) => {
      if (payload && payload.chatId) this.chatReadSubject.next(payload);
    });

    this.msgSocket.on('error', (err: any) => {
      console.error('Message socket error', err);
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

  private removeMessageListeners(): void {
    if (!this.msgSocket) return;
    this.msgSocket.off('connect');
    this.msgSocket.off('connected');
    this.msgSocket.off('disconnect');
    this.msgSocket.off('connect_error');
    this.msgSocket.off('message:new');
    this.msgSocket.off('notification:message');
    this.msgSocket.off('joinedChat');
    this.msgSocket.off('leftChat');
    this.msgSocket.off('chat:read');
    this.msgSocket.off('error');
    this.msgSocket.off('notification:unreadChats');
  }

  /**
   * Desconectar del servidor WebSocket
   */
  disconnect(): void {
    // Disconnect notification socket
    if (this.socket) {
      this.removeListeners();
      try { this.socket.disconnect(); } catch (e) {}
      this.socket = null;
      this.connectionStatus.next(false);
    }

    // Disconnect message socket if exists
    if (this.msgSocket) {
      this.removeMessageListeners();
      try { this.msgSocket.disconnect(); } catch (e) {}
      this.msgSocket = null;
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
  // No active socket, attempting to connect with new token
      try {
        this.connect(newToken);
        // also reconnect message socket if it existed before
        if (this.msgSocket !== null) this.connectMessages(newToken);
      } catch (e) {
        console.error('Error intentando conectar WebSocket con nuevo token:', e);
      }
      return;
    }
    
    // Si el socket está conectado, no hacer nada (evitar desconexiones innecesarias)
    if (this.socket.connected) {
      return;
    }
    
    // Si no está conectado, reconectar con el nuevo token
  // Reconnecting WebSocket with new token
    this.disconnect();
    this.connect(newToken);
    if (this.msgSocket !== null) {
      try { this.connectMessages(newToken); } catch (e) { console.error(e); }
    }
  }

  /**
   * Verificar si está conectado
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /** Check if message socket is connected */
  isMessageConnected(): boolean {
    return this.msgSocket?.connected || false;
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

  /** Emit to message socket */
  emitMessage(event: string, data: any): void {
    if (this.msgSocket?.connected) {
      this.msgSocket.emit(event, data);
    } else {
      console.warn('Mensaje socket no conectado, emit fallido:', event);
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
          // Notification marked as read
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

  /** Join a chat room via WS */
  joinChat(chatId: number): void {
    if (!this.msgSocket) {
      console.warn('Mensaje socket no inicializado, no se puede joinChat');
      return;
    }
    try {
      this.msgSocket.emit('joinChat', { chatId });
      this.joinedChats.add(Number(chatId));
    } catch (e) { console.error(e); }
  }

  /** Leave a chat room via WS */
  leaveChat(chatId: number): void {
    if (!this.msgSocket) return;
    try {
      this.msgSocket.emit('leaveChat', { chatId });
      this.joinedChats.delete(Number(chatId));
    } catch (e) { console.error(e); }
  }

  /** Send a text message via WS (server expects sendMessage event) */
  sendTextMessage(chatId: number, text: string): void {
    if (!this.msgSocket) return;
    try { this.msgSocket.emit('sendMessage', { chatId, message: text }); } catch (e) { console.error(e); }
  }

  // Observables to subscribe from components
  onMessageNew(): Observable<any> { return this.messageSubject.asObservable(); }
  onNotificationMessage(): Observable<any> { return this.notificationMessageSubject.asObservable(); }
  onUnreadChats(): Observable<{ chatId: number; unreadInChat: number; totalUnreadChats: number }> { return this.unreadChatsSubject.asObservable(); }
  onJoinedChat(): Observable<{ chatId: number }> { return this.joinedChatSubject.asObservable(); }
  onLeftChat(): Observable<{ chatId: number }> { return this.leftChatSubject.asObservable(); }
  onChatRead(): Observable<{ chatId: number; userId: number }> { return this.chatReadSubject.asObservable(); }

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
