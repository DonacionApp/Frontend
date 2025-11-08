import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// Interface para artículo de la donación (respuesta del backend)
export interface PostDonationArticle {
  id: number;
  quantity: string;
  postArticleId: number;
  article: {
    id: number;
    name: string;
    descripcion: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
  status?: {
    id: number;
    status: string;
  };
}

// DTO para agregar artículo
export interface AddArticleDTO {
  donationId: number;
  postArticleId: number;
  quantity: number;
}

// DTO para actualizar cantidad
export interface UpdateQuantityDTO {
  postDonationArticleId: number;
  newQuantity: number;
}

@Injectable({
  providedIn: 'root'
})
export class PostDonationArticleService {
  private apiUrl = `${environment.apiBackendUrl}/postdonationarticle`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener todos los artículos de una donación por postId
   */
  getAllArticlesByPost(postId: number): Observable<PostDonationArticle[]> {
    return this.http.get<PostDonationArticle[]>(`${this.apiUrl}/all/post/${postId}`);
  }

  /**
   * Agregar un artículo a la donación
   */
  addArticle(data: AddArticleDTO): Observable<PostDonationArticle> {
    return this.http.post<PostDonationArticle>(`${this.apiUrl}/add/article`, data);
  }

  /**
   * Actualizar la cantidad de un artículo
   */
  updateQuantity(data: UpdateQuantityDTO): Observable<PostDonationArticle> {
    return this.http.post<PostDonationArticle>(`${this.apiUrl}/update/quantity/article`, data);
  }

  /**
   * Eliminar un artículo de la donación
   */
  removeArticle(donationArticleId: number): Observable<{ message: string; status: number }> {
    return this.http.delete<{ message: string; status: number }>(`${this.apiUrl}/remove/article/${donationArticleId}`);
  }
}
