import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * Interfaz para un comentario de publicación
 */
export interface PostComment {
  id: number;
  comment: string;
  postId: number;
  userId: number;
  user?: {
    id: number;
    username: string;
    profilePhoto?: string;
    emailVerified?: boolean;
    verified?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO para crear un comentario
 */
export interface CreatePostCommentDTO {
  comment: string;
  postId: number;
}

/**
 * DTO para actualizar un comentario
 */
export interface UpdatePostCommentDTO {
  comment: string;
}

@Injectable({
  providedIn: 'root'
})
export class PostCommentService {
  private apiUrl = `${environment.apiBackendUrl}/postcomment`;

  constructor(private http: HttpClient) {}

  /**
   * Crear un nuevo comentario en una publicación
   */
  createComment(data: CreatePostCommentDTO): Observable<PostComment> {
    // Agregar header para invalidar caché de comentarios después de crear
    const headers = { 'X-Cache-Invalidate': '/postcomment' };
    
    return this.http.post<PostComment>(`${this.apiUrl}/create`, data, { headers }).pipe(
      catchError((err) => {
        if (err?.status === 404) {
          return this.http.post<PostComment>(`${this.apiUrl}/create/new`, data, { headers });
        }
        return throwError(() => err);
      })
    );
  }

  /**
   * Obtener todos los comentarios de una publicación
   */
  getCommentsByPost(postId: number, bypassCache: boolean = false): Observable<PostComment[]> {
    // Permitir bypass de caché después de mutaciones
    const options = bypassCache ? { headers: { 'X-No-Cache': 'true' } } : {};
    
    // Intentar diferentes formatos de endpoint según el backend
    // Opción 1: /postcomment/post/:postId
    // Opción 2: /post/:postId/comments
    // Opción 3: /comment/post/:postId
    return this.http.get<PostComment[]>(`${this.apiUrl}/post/${postId}`, options).pipe(
      // Si falla, intentar formato alternativo
      catchError(() => {
        // Intentar formato alternativo: /post/:postId/comments
        return this.http.get<PostComment[]>(`${environment.apiBackendUrl}/post/${postId}/comments`, options);
      })
    );
  }

  /**
   * Obtener un comentario por ID
   */
  getCommentById(commentId: number): Observable<PostComment> {
    return this.http.get<PostComment>(`${this.apiUrl}/${commentId}`);
  }

  /**
   * Actualizar un comentario
   */
  updateComment(commentId: number, data: UpdatePostCommentDTO): Observable<{ message: string; success: boolean }> {
    // Agregar header para invalidar caché de comentarios después de actualizar
    const headers = { 'X-Cache-Invalidate': '/postcomment' };
    
    return this.http.post<{ message: string; success: boolean }>(`${this.apiUrl}/update/${commentId}`, data, { headers });
  }

  /**
   * Eliminar un comentario
   */
  deleteComment(commentId: number): Observable<{ message: string; success: boolean }> {
    // Agregar header para invalidar caché de comentarios después de eliminar
    const headers = { 'X-Cache-Invalidate': '/postcomment' };
    
    return this.http.delete<{ message: string; success: boolean }>(`${this.apiUrl}/delete/${commentId}`, { headers });
  }

  /**
   * Validar contenido del comentario (básico - puede extenderse con API externa)
   */
  validateContent(comment: string): { isValid: boolean; reason?: string } {
    if (!comment || comment.trim().length === 0) {
      return { isValid: false, reason: 'El comentario no puede estar vacío' };
    }

    if (comment.trim().length < 3) {
      return { isValid: false, reason: 'El comentario debe tener al menos 3 caracteres' };
    }

    // Lista básica de palabras inapropiadas (en producción usar API de moderación)
    const inappropriateWords = [
      'spam', 'scam', 'fraud', 'hack', 'virus', 'malware',
      // Agregar más según necesidad
    ];

    const lowerComment = comment.toLowerCase();
    for (const word of inappropriateWords) {
      if (lowerComment.includes(word)) {
        return { isValid: false, reason: 'El comentario contiene contenido inapropiado' };
      }
    }

    return { isValid: true };
  }
}

