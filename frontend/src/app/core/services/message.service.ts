import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/* Types for messaging service - allow nullable fields where appropriate */
export interface IUser {
  id: number;
  username?: string | null;
  email?: string | null;
  profilePhoto?: string | null;
  verified?: boolean | null;
  emailVerified?: boolean | null;
  lastLogin?: string | null;
}

export interface IMessageType {
  id: number;
  type?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface IMessage {
  id: number;
  message?: string | null;
  createdAt?: string | null;
  user?: IUser | null;
  type?: IMessageType | null;
  read?: boolean | null;
}

export interface IChatUser {
  id: number;
  user?: IUser | null;
  donator?: boolean | null;
  admin?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface IChat {
  id: number;
  chatName?: string | null;
  userChat?: IChatUser[] | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  // UI helper fields (optional): may be provided by client mapping
  lastMessage?: string | null;
  avatar?: string | null;
  unread?: number | null;
  participants?: number | null;
  time?: string | null;
}

export interface IChatStatus {
  id: number;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

@Injectable({ providedIn: 'root' })
export class MessageService {
  private base = environment.apiUrl || '';

  constructor(private http: HttpClient) {}

  private buildParams(params?: { [key: string]: any }): HttpParams {
    let p = new HttpParams();
    if (!params) { return p; }
    Object.keys(params).forEach(k => {
      const v = params[k];
      if (v === null || v === undefined) { return; }
      p = p.set(k, String(v));
    });
    return p;
  }

  // GET: /chatstatus/status
  getChatStatuses(): Observable<IChatStatus[]> {
    return this.http.get<IChatStatus[]>(`${this.base}/chatstatus/status`);
  }

  // GET: /typemessage/all
  getMessageTypes(): Observable<IMessageType[]> {
    return this.http.get<IMessageType[]>(`${this.base}/typemessage/all`);
  }

  // GET: /messagechat/by-chat/:chatId with query params: page, limit, search, order, type
  loadMessagesByChat(chatId: number, params?: { page?: number; limit?: number; search?: string; order?: string; type?: string; cursor?: string }): Observable<{ messages: IMessage[]; total?: number; page?: number; limit?: number; count?: number }> {
    const p = this.buildParams(params);
    return this.http.get<{ messages: IMessage[]; total?: number; page?: number; limit?: number; count?: number }>(`${this.base}/messagechat/by-chat/${chatId}`, { params: p });
  }

  // POST: /messagechat/send/new/message  (form-data)
  sendMessage(formData: FormData): Observable<any> {
    return this.http.post(`${this.base}/messagechat/send/new/message`, formData);
  }

  // DELETE: /messagechat/delete/message/:id/chat
  deleteMessage(idMessage: number): Observable<any> {
    return this.http.delete(`${this.base}/messagechat/delete/message/${idMessage}/chat`);
  }

  // PUT: /messagechat/update/message/:id/chat  body: { newMessage }
  updateMessage(idMessage: number, newMessage: string): Observable<any> {
    return this.http.put(`${this.base}/messagechat/update/message/${idMessage}/chat`, { newMessage });
  }

  // GET: /userchat/my-chats with params limit, orderBy, order
  getUserMyChats(params?: { limit?: number; orderBy?: string; order?: string; page?: number; searchParam?: string }): Observable<any> {
    const p = this.buildParams(params);
    return this.http.get<any>(`${this.base}/userchat/my-chats`, { params: p });
  }

  // GET: /chat/all/me with params searchParam, cursor, limit, page, offset
  getAllMyChats(params?: { searchParam?: string; cursor?: string; limit?: number; page?: number; offset?: number }): Observable<IChat[]> {
    const p = this.buildParams(params);
    return this.http.get<IChat[]>(`${this.base}/chat/all/me`, { params: p });
  }

  // GET: /userchat/users-by-chat/:chatId
  getUsersByChat(chatId: number): Observable<IUser[]> {
    return this.http.get<IUser[]>(`${this.base}/userchat/users-by-chat/${chatId}`);
  }

  // POST: /chat  -> create a new chat
  createChat(body: { chatName: string; chatStatusId?: number; participantIds?: Array<{ userId: number; isAdmin?: boolean }> }): Observable<any> {
    return this.http.post(`${this.base}/chat`, body);
  }

  createChatAdmin(body: { chatName: string; chatStatusId?: number; participantIds?: Array<{ userId: number; isAdmin?: boolean }> }): Observable<any> {
    return this.http.post(`${this.base}/chat/admin/admin/create`, body);
  }

  // GET: /user  -> search or list users. Accepts optional query params (search)
  searchUsers(params?: { search?: string; limit?: number; page?: number }): Observable<any> {
    const p = this.buildParams(params as any);
    return this.http.get<any>(`${this.base}/user`, { params: p });
  }

  // POST: /userchat  -> add a participant to a chat. Body depends on backend: we'll send { chatId, userId, admin }
  addUserToChat(body: { chatId: number; userId: number; admin?: boolean }): Observable<any> {
    return this.http.post(`${this.base}/userchat`, body);
  }

  // DELETE: /userchat/:id  -> remove a userchat entry by id
  removeUserFromChat(userChatId: number): Observable<any> {
    return this.http.delete(`${this.base}/userchat/${userChatId}`);
  }

  // POST: /donation/chat/create-from-donation/:donationId
  createChatFromDonation(donationId: number): Observable<any> {
    return this.http.post(`${this.base}/donation/chat/create-from-donation/${donationId}`, {});
  }

  // PUT: /chat/:chatId/close
  closeChat(chatId: number): Observable<any> {
    return this.http.put(`${this.base}/chat/${chatId}/close`, {});
  }

  // PUT: /userchat/my-chats/mark-all-as-read  <-- guessed endpoint; adjust if backend differs
  markAllMyChatsAsRead(): Observable<any> {
    return this.http.put(`${this.base}/userchat/my-chats/mark-all-as-read`, {});
  }

  // PUT: /userchat/mark-as-read/chat/:chatId  -- mark a specific chat as read for the current user
  markChatAsRead(chatId: number): Observable<any> {
    return this.http.put(`${this.base}/userchat/mark-as-read/chat/${chatId}`, {});
  }
}
