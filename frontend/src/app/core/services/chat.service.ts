import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface ChatUser {
  id: number;
  user: {
    id: number;
    username: string;
    email: string;
    profilePhoto: string;
    lastLogin: string;
    emailVerified: boolean;
    verified: boolean;
    block: boolean;
    location: string | null;
    createdAt: string;
    updatedAt: string;
  };
  donator: boolean;
  admin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Chat {
  id: number;
  chatName: string;
  userChat: ChatUser[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatListResponse {
  items: Chat[];
  limit: number;
  cursor?: string;
  hasMore?: boolean;
}

export interface ChatFilters {
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface CreateChatDTO {
  chatName: string;
  chatStatusId: number;
  participantIds: Array<{
    userId: number;
    isAdmin: boolean;
  }>;
}

export interface AddUserToChatDTO {
  userId: number;
  donator?: boolean;
  admin?: boolean;
}

export interface Message {
  id: number;
  message: string;
  createdAt: string;
  user: {
    id: number;
    username: string;
    profilePhoto: string;
    verrified: boolean;
    emailVerfied: boolean;
  };
  type: {
    id: number;
    type: string;
  };
  read: boolean;
}

export interface MessagesResponse {
  messages: Message[];
  count: number;
}

export interface MessageFilters {
  page?: number;
  limit?: number;
  search?: string;
  order?: 'ASC' | 'DESC';
}

export interface SendMessageDTO {
  chatId: number;
  typeMessageId?: number;
  messageText?: string;
  files?: File[];
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = `${environment.apiBackendUrl}/chat`;
  private userChatApiUrl = `${environment.apiBackendUrl}/userchat`;
  private messageChatApiUrl = `${environment.apiBackendUrl}/messagechat`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener el contador de mensajes sin leer global
   */
  getUnreadMessagesCount(): Observable<number> {
    return this.http.get<{ unreadcount: number }>(`${this.messageChatApiUrl}/unread/count`).pipe(
      map(res => res.unreadcount || 0)
    );
  }

  /**
   * Obtener lista de chats con scroll infinito y filtros
   */
  getChats(filters?: ChatFilters): Observable<ChatListResponse> {
    let params = new HttpParams();

    if (filters?.limit && filters.limit > 0) {
      params = params.set('limit', filters.limit.toString());
    }

    if (filters?.cursor && filters.cursor.trim() !== '') {
      params = params.set('cursor', filters.cursor);
    }

    if (filters?.search && filters.search.trim() !== '') {
      params = params.set('search', filters.search);
    }

    return this.http.post<ChatListResponse>(`${this.apiUrl}/admin/list`, {}, { params }).pipe(
      map(response => {
        return {
          items: Array.isArray(response.items) ? response.items : (response.items ? [response.items] : []),
          limit: response.limit || 20,
          cursor: response.cursor,
          hasMore: response.hasMore
        };
      })
    );
  }

  /**
   * Crear un nuevo chat
   */
  createChat(data: CreateChatDTO): Observable<Chat> {
    return this.http.post<Chat>(`${this.apiUrl}/admin/admin/create`, data);
  }

  /**
   * Cerrar un chat
   */
  closeChat(chatId: number): Observable<{ messageChat: string; status: number }> {
    return this.http.put<{ messageChat: string; status: number }>(`${this.apiUrl}/${chatId}/close/admin`, {});
  }

  /**
   * Agregar usuario al chat
   */
  addUserToChat(chatId: number, data: AddUserToChatDTO): Observable<any> {
    return this.http.post<any>(`${this.userChatApiUrl}/admin/add-user-to-chat/${chatId}`, data);
  }

  /**
   * Remover usuario del chat
   */
  removeUserFromChat(chatId: number, userId: number): Observable<{ message: string; status: number }> {
    return this.http.delete<{ message: string; status: number }>(`${this.userChatApiUrl}/admin/remove-user-from-chat/${chatId}/user/${userId}`);
  }

  /**
   * Obtener mensajes de un chat
   */
  getChatMessages(chatId: number, filters?: MessageFilters): Observable<MessagesResponse> {
    let params = new HttpParams();

    if (filters?.page && filters.page > 0) {
      params = params.set('page', filters.page.toString());
    }

    if (filters?.limit && filters.limit > 0) {
      params = params.set('limit', filters.limit.toString());
    }

    if (filters?.search && filters.search.trim() !== '') {
      params = params.set('search', filters.search);
    }

    if (filters?.order && (filters.order === 'ASC' || filters.order === 'DESC')) {
      params = params.set('order', filters.order);
    }

    return this.http.get<MessagesResponse>(`${this.messageChatApiUrl}/admin/by-chat/${chatId}`, { params });
  }

  /**
   * Enviar mensaje como admin
   */
  sendMessage(data: SendMessageDTO): Observable<MessagesResponse> {
    const formData = new FormData();
    formData.append('chatId', data.chatId.toString());
    
    if (data.typeMessageId) {
      formData.append('typeMessageId', data.typeMessageId.toString());
    }
    
    if (data.messageText) {
      formData.append('messageText', data.messageText);
    }
    
    if (data.files && data.files.length > 0) {
      data.files.forEach((file, index) => {
        formData.append('files', file);
      });
    }

    return this.http.post<MessagesResponse>(`${this.messageChatApiUrl}/admin/send/new/message`, formData);
  }

  /**
   * Eliminar mensaje
   */
  deleteMessage(messageId: number): Observable<{ message: string; status: number }> {
    return this.http.delete<{ message: string; status: number }>(`${this.messageChatApiUrl}/admin/delete/message/${messageId}/chat`);
  }
}
