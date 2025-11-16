import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface SupportStatus {
  id: number;
  name: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  profilePhoto?: string;
  lastLogin?: string;
  emailVerified: boolean;
  verified: boolean;
  block: boolean;
  createdAt: string;
}

export interface CommentSupport {
  id: number;
  comment: string;
  status: SupportStatus;
  user: User;
  createdAt: string;
  updatedAt: string;
}

export interface CommentSupportFilterDTO {
  idStatusSupportId?: number;
  idUser?: number;
  search?: string;
  sortBy?: 'id' | 'createdAt' | 'updatedAt' | 'comment';
  sortOrder?: 'ASC' | 'DESC';
}

export interface AcceptSupportDTO {
  comment: string;
}

export interface RejectSupportDTO {
  comment: string;
}

export interface UpdateCommentDTO {
  newComment: string;
}

export interface UserWithSupport {
  id: number;
  username: string;
  email: string;
  profilePhoto?: string;
  createdAt?: string;
  updatedAt?: string;
  people?: {
    id?: number;
    name?: string;
    lastName?: string | null;
    dni?: string;
    supportId?: string | null;
  };
  role?: {
    id: number;
    name: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class SupportIdentificationService {
  private apiUrl = `${environment.apiBackendUrl}/commentsupportid`;
  private userApiUrl = `${environment.apiBackendUrl}/user`;

  constructor(private http: HttpClient) { }

  /**
   * Obtener todos los comentarios de soporte con filtros
   */
  getAllCommentSupports(filters?: CommentSupportFilterDTO): Observable<CommentSupport[]> {
    return this.http.post<CommentSupport[]>(`${this.apiUrl}/all`, filters || {});
  }

  /**
   * Obtener comentario de soporte de un usuario específico
   */
  getUserCommentSupport(userId: number | string): Observable<CommentSupport[]> {
    // Usar el endpoint /all con filtro idUser en lugar de /user/{userId}
    return this.http.post<CommentSupport[]>(`${this.apiUrl}/all`, { idUser: Number(userId) });
  }

  /**
   * Obtener usuarios con soporte de identificación (con filtros)
   */
  getUsersWithSupport(filters?: {
    limit?: number;
    search?: string;
    orderBy?: string;
    order?: 'ASC' | 'DESC';
  }): Observable<UserWithSupport[]> {
    let params = new HttpParams();
    
    // Solo agregar parámetros si tienen valores válidos (no vacíos, no null, no undefined)
    if (filters?.limit !== undefined && filters.limit !== null && filters.limit > 0) {
      params = params.set('limit', filters.limit.toString());
    }
    if (filters?.search !== undefined && filters.search !== null && filters.search.trim() !== '') {
      params = params.set('search', filters.search.trim());
    }
    if (filters?.orderBy !== undefined && filters.orderBy !== null && filters.orderBy.trim() !== '') {
      params = params.set('orderBy', filters.orderBy.trim());
    }
    if (filters?.order !== undefined && filters.order !== null && filters.order.trim() !== '') {
      params = params.set('order', filters.order.trim());
    }

    // Si no hay parámetros, enviar request sin params
    const options = params.keys().length > 0 ? { params } : {};
    
    return this.http.get<{ items: UserWithSupport[] }>(`${this.userApiUrl}/upload-support`, options).pipe(
      map((response) => {
        // El backend devuelve { items: [...] }
        if (!response) return [];
        if (Array.isArray(response.items)) return response.items;
        // Fallback: si viene como array directamente
        if (Array.isArray(response)) return response;
        return [];
      })
    );
  }

  /**
   * Aceptar soporte de identificación de un usuario
   */
  acceptSupport(userId: number | string, data: AcceptSupportDTO): Observable<{ message: string; status: number }> {
    return this.http.post<{ message: string; status: number }>(`${this.apiUrl}/accept/${userId}`, data);
  }

  /**
   * Rechazar soporte de identificación de un usuario
   */
  rejectSupport(userId: number | string, data: RejectSupportDTO): Observable<{ message: string; status: number }> {
    // Asegurar que userId sea un número
    const userIdParam = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const url = `${this.apiUrl}/reject/${userIdParam}`;
    console.log('URL de rechazo:', url);
    console.log('Datos:', data);
    console.log('userId recibido:', userId, 'userId procesado:', userIdParam);
    return this.http.post<{ message: string; status: number }>(url, data);
  }

  /**
   * Actualizar comentario de soporte
   */
  updateComment(commentId: number | string, data: UpdateCommentDTO): Observable<{ message: string; status: number; commentUp: string }> {
    return this.http.post<{ message: string; status: number; commentUp: string }>(`${this.apiUrl}/update/${commentId}`, data);
  }
}

