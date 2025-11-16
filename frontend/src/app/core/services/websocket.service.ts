import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject, BehaviorSubject, ReplaySubject } from 'rxjs';
import { tap } from 'rxjs/operators';
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
  // Use ReplaySubject(1) so a late subscriber (opened after an edit was emitted)
  // can still receive the most recent edit. This helps when components
  // subscribe after the server emitted the 'message:edited' event.
  private messageEditedSubject = new ReplaySubject<any>(1);
  // store last edited payload so late consumers can query it synchronously
  private _lastMessageEdited: any = null;
  private messageDeletedSubject = new ReplaySubject<any>(1);
  private _lastMessageDeleted: any = null;
  private notificationMessageSubject = new Subject<any>();
  private unreadChatsSubject = new BehaviorSubject<{ chatId: number; unreadInChat: number; totalUnreadChats: number }>({ chatId: 0, unreadInChat: 0, totalUnreadChats: 0 });
  private joinedChatSubject = new Subject<{ chatId: number }>();
  private leftChatSubject = new Subject<{ chatId: number }>();
  private chatReadSubject = new Subject<{ chatId: number; userId: number }>();
  private joinedChats = new Set<number>();
  private chatNewSubject = new Subject<any>();

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
    const debugFlag = (environment as any)['debugWs'] || (environment as any)['debug'] || false;
    if (debugFlag) {
      try {
        console.debug('[WebsocketService] connect - token present:', !!cleanToken);
        try {
          const p = cleanToken ? JSON.parse(atob(cleanToken.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))) : null;
          console.debug('[WebsocketService] connect - token payload sub:', p?.sub);
        } catch (e) {}
      } catch (e) {}
    }
    
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
    const debugFlagMsg = (environment as any)['debugWs'] || (environment as any)['debug'] || false;
    if (debugFlagMsg) {
      try {
        console.debug('[WebsocketService] connectMessages - token present:', !!cleanToken);
        try {
          const p = cleanToken ? JSON.parse(atob(cleanToken.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))) : null;
          console.debug('[WebsocketService] connectMessages - token payload sub:', p?.sub);
        } catch (e) {}
      } catch (e) {}
    }
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

  private setupListeners(): void {
    if (!this.socket) return;

    this.removeListeners();

    let notificationTimeout: any = null;
    let lastNotificationTime: number = Date.now();

    this.socket.on('connect', () => {
      this.connectionStatus.next(true);
      lastNotificationTime = Date.now();
      // Solo mostrar advertencia si no se reciben notificaciones después de 60 segundos
      if (notificationTimeout) {
        clearTimeout(notificationTimeout);
      }
      notificationTimeout = setTimeout(() => {
        const timeSinceLastNotification = Date.now() - lastNotificationTime;
        // Solo mostrar advertencia si realmente no se recibió ninguna notificación
        if (timeSinceLastNotification >= 60000) {
          console.warn('ADVERTENCIA: No se reciben notificaciones en tiempo real. Verifica tu conexión o permisos.');
        }
      }, 60000); // Aumentado a 60 segundos para dar más tiempo
    });

    this.socket.on('connected', (data: { message: string; userId: number; userName: string; timestamp: Date }) => {
      this.connectionStatus.next(true);
      lastNotificationTime = Date.now();
      if (notificationTimeout) {
        clearTimeout(notificationTimeout);
      }
      // Reiniciar timeout después de conexión confirmada
      notificationTimeout = setTimeout(() => {
        const timeSinceLastNotification = Date.now() - lastNotificationTime;
        if (timeSinceLastNotification >= 60000) {
          console.warn('ADVERTENCIA: No se reciben notificaciones en tiempo real. Verifica tu conexión o permisos.');
        }
      }, 60000);
    });

    // Evento: Desconexión
    this.socket.on('disconnect', (reason) => {
      this.connectionStatus.next(false);
      if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        notificationTimeout = null;
      }
    });

    // Evento: Error de conexión
    this.socket.on('connect_error', (error) => {
      console.error('❌ Error de conexión WebSocket:', error);
      this.connectionStatus.next(false);
      if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        notificationTimeout = null;
      }
    });

    // Evento: Nueva notificación (emitido por el backend)
    this.socket.on('notification', (notification: Notification) => {
      lastNotificationTime = Date.now(); // Actualizar tiempo de última notificación
      if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        // Reiniciar timeout solo si no se reciben notificaciones por 60 segundos
        notificationTimeout = setTimeout(() => {
          const timeSinceLastNotification = Date.now() - lastNotificationTime;
          if (timeSinceLastNotification >= 60000) {
            console.warn('ADVERTENCIA: No se reciben notificaciones en tiempo real. Verifica tu conexión o permisos.');
          }
        }, 60000);
      }
      this.notificationSubject.next(notification);
    });

    // Evento: Error (emitido por el backend cuando hay problemas de autenticación)
    this.socket.on('error', (error: any) => {
      console.error('❌ Error en WebSocket:', error);
      this.connectionStatus.next(false);
      if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        notificationTimeout = null;
      }
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

      this.messageSubject.next(payload);
    });

    this.msgSocket.on('chat:new', (payload: any) => {
      try {
        let safe: any = payload;
        console.log('chat:new payload received:', payload);
        try { safe = (typeof structuredClone === 'function') ? structuredClone(payload) : JSON.parse(JSON.stringify(payload)); } catch (e) { safe = payload; }
        this.chatNewSubject.next(safe);
      } catch (e) {}
    });

    this.msgSocket.on('message:edited', (payload: any) => {
      try {
        let safePayload: any = payload;
        try {
          safePayload = (typeof structuredClone === 'function') ? structuredClone(payload) : JSON.parse(JSON.stringify(payload));
        } catch (e) { safePayload = payload; }
        this.messageEditedSubject.next(safePayload);
        try { this._lastMessageEdited = safePayload; } catch (e) {}
      } catch (e) {}
    });

    this.msgSocket.on('message:deleted', (payload: any) => {
      try {
        let safePayloadDel: any = payload;
        try {
          safePayloadDel = (typeof structuredClone === 'function') ? structuredClone(payload) : JSON.parse(JSON.stringify(payload));
        } catch (e) { safePayloadDel = payload; }
        this.messageDeletedSubject.next(safePayloadDel);
        try { this._lastMessageDeleted = safePayloadDel; } catch (e) {}
      } catch (e) {}
    });

    this.msgSocket.on('notification:message', (payload: any) => {
      this.notificationMessageSubject.next(payload);
    });

    // Server emits unread counters for chat(s)
    this.msgSocket.on('notification:unreadChats', (payload: any) => {
      try {
        const parsed = payload || {};
        const chatId = Number(parsed.chatId ?? parsed.chatID ?? parsed.chat_id) || 0;
        const unreadInChat = Number(parsed.unreadInChat ?? parsed.unread_in_chat ?? parsed.unread ?? 0) || 0;
        const totalUnreadChats = Number(parsed.totalUnreadChats ?? parsed.total_unread_chats ?? parsed.totalUnread ?? 0) || 0;
        
        // Emitir siempre que haya un totalUnreadChats válido, incluso sin chatId específico
        // Esto permite actualizar el contador general en el nav aunque no haya un chatId
        if (!isNaN(totalUnreadChats)) {
          this.unreadChatsSubject.next({ chatId, unreadInChat, totalUnreadChats });
        }
      } catch (e) {
        console.error('Error procesando notification:unreadChats:', e);
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
    this.msgSocket.off('message:edited');
    this.msgSocket.off('message:deleted');
    this.msgSocket.off('chat:new');
    this.msgSocket.off('notification:message');
    this.msgSocket.off('joinedChat');
    this.msgSocket.off('leftChat');
    this.msgSocket.off('chat:read');
    this.msgSocket.off('error');
    this.msgSocket.off('notification:unreadChats');
  }

  disconnect(): void {
   
    if (this.socket) {
      this.removeListeners();
      try { this.socket.disconnect(); } catch (e) {}
      this.socket = null;
      this.connectionStatus.next(false);
    }

   
    if (this.msgSocket) {
      this.removeMessageListeners();
      try { this.msgSocket.disconnect(); } catch (e) {}
      this.msgSocket = null;
    }
  }

 
  reconnectWithNewToken(newToken: string): void {
    const debugFlag = (environment as any)['debugWs'] || (environment as any)['debug'] || false;
    if (debugFlag) {
      try {
        console.debug('[WebsocketService] reconnectWithNewToken - called, newToken present:', !!newToken);
        try {
          const p = newToken ? JSON.parse(atob(newToken.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))) : null;
          console.debug('[WebsocketService] reconnectWithNewToken - decoded sub:', p?.sub);
        } catch (e) {}
      } catch (e) {}
    }

    if (!newToken) {
      console.warn('reconnectWithNewToken llamado sin token');
      return;
    }

    if (!this.socket) {
      
      try {
        this.connect(newToken);
        
        if (this.msgSocket !== null) this.connectMessages(newToken);
      } catch (e) {
        console.error('Error intentando conectar WebSocket con nuevo token:', e);
      }
      return;
    }
    
   
    if (this.socket.connected) {
      return;
    }
    
    
    this.disconnect();
    this.connect(newToken);
    if (this.msgSocket !== null) {
      try { this.connectMessages(newToken); } catch (e) { console.error(e); }
    }
  }

 
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

 
  isMessageConnected(): boolean {
    return this.msgSocket?.connected || false;
  }

  emit(event: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('No se puede emitir evento. WebSocket no conectado.');
    }
  }

  
  emitMessage(event: string, data: any): void {
    if (this.msgSocket?.connected) {
      this.msgSocket.emit(event, data);
    } else {
      console.warn('Mensaje socket no conectado, emit fallido:', event);
    }
  }

  
  markNotificationAsRead(notificationId: number): Promise<{ success: boolean; notificationId?: number; message?: string; error?: string }> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('WebSocket no conectado'));
        return;
      }

     
      this.socket.emit('markAsRead', { notificationId }, (response: any) => {
        if (response?.success) {
          
          resolve(response);
        } else {
          console.error('❌ Error al marcar notificación como leída:', response?.error);
          reject(new Error(response?.error || 'Error desconocido'));
        }
      });
    });
  }

  
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

  leaveChat(chatId: number): void {
    if (!this.msgSocket) return;
    try {
      this.msgSocket.emit('leaveChat', { chatId });
      this.joinedChats.delete(Number(chatId));
    } catch (e) { console.error(e); }
  }

  
  sendTextMessage(chatId: number, text: string): void {
    if (!this.msgSocket) return;
    try { this.msgSocket.emit('sendMessage', { chatId, message: text }); } catch (e) { console.error(e); }
  }

  emitEditMessage(messageId: number, chatId?: number, newText?: string): void {
    if (!this.msgSocket) { console.warn('Mensaje socket no inicializado, no se puede enviar editMessage'); return; }
    try { this.msgSocket.emit('editMessage', { messageId, chatId, newText }); } catch (e) { console.error(e); }
  }

  emitDeleteMessage(messageId: number, chatId?: number): void {
    if (!this.msgSocket) { console.warn('Mensaje socket no inicializado, no se puede enviar deleteMessage'); return; }
    try { this.msgSocket.emit('deleteMessage', { messageId, chatId }); } catch (e) { console.error(e); }
  }

  onMessageNew(): Observable<any> { return this.messageSubject.asObservable(); }
  onMessageEdited(): Observable<any> {
    return this.messageEditedSubject.asObservable();
  }
  getLastMessageEdited(): any {
    return this._lastMessageEdited;
  }
  onMessageDeleted(): Observable<any> { return this.messageDeletedSubject.asObservable(); }
  getLastMessageDeleted(): any { return this._lastMessageDeleted; }
  onChatNew(): Observable<any> { return this.chatNewSubject.asObservable(); }
  onNotificationMessage(): Observable<any> { return this.notificationMessageSubject.asObservable(); }
  onUnreadChats(): Observable<{ chatId: number; unreadInChat: number; totalUnreadChats: number }> { return this.unreadChatsSubject.asObservable(); }
  onJoinedChat(): Observable<{ chatId: number }> { return this.joinedChatSubject.asObservable(); }
  onLeftChat(): Observable<{ chatId: number }> { return this.leftChatSubject.asObservable(); }
  onChatRead(): Observable<{ chatId: number; userId: number }> { return this.chatReadSubject.asObservable(); }

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

      return () => {
        if (this.socket) {
          this.socket.off(event, handler);
        }
      };
    });
  }
}
