import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Article {
  id: number;
  name: string;
  descripcion: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleFilterDTO {
  name?: string;
  descripcion?: string;
  orderBy?: 'ASC' | 'DESC';
}

export interface CreateArticleDTO {
  name: string;
  description?: string;
}

export interface UserArticle {
  id: number;
  cant: number;
  needed: boolean;
  article: Article;
}

export interface UserArticleFilterDTO {
  needed?: boolean;
  article?: number;
  search?: string;
}

export interface AddUserArticleDTO {
  cant: number;
  needed: boolean;
  article: number;
}

export interface UpdateQuantityDTO {
  userArticleId: number;
  cant: number;
}

@Injectable({
  providedIn: 'root'
})
export class ArticlesService {
  private apiUrl = `${environment.apiBackendUrl}/article`;
  private userArticleUrl = `${environment.apiBackendUrl}/userarticle`;

  constructor(private http: HttpClient) { }

  getAllArticles(filters?: ArticleFilterDTO): Observable<Article[]> {
    return this.http.post<any>(`${this.apiUrl}/all`, filters || {}).pipe(
      map((raw) => {
        // Normalize common response shapes into an array
        if (!raw) return [] as Article[];
        if (Array.isArray(raw)) return raw as Article[];
        if (raw.data && Array.isArray(raw.data)) return raw.data as Article[];
        if (raw.items && Array.isArray(raw.items)) return raw.items as Article[];

        if (typeof raw === 'object' && raw !== null) {
          const numericKeys = Object.keys(raw).filter(k => /^\d+$/.test(k));
          if (numericKeys.length > 0) {
            const ordered = numericKeys
              .map(k => parseInt(k, 10))
              .sort((a, b) => a - b)
              .map(idx => (raw as any)[String(idx)]);
            return ordered.filter(Boolean) as Article[];
          }
          // Single object
          return [raw] as Article[];
        }

        return [] as Article[];
      })
    );
  }

  getArticleById(id: number): Observable<Article> {
    return this.http.get<Article>(`${this.apiUrl}/find/${id}`);
  }

  getArticleByName(name: string): Observable<Article> {
    return this.http.get<Article>(`${this.apiUrl}/find/name/${name}`);
  }

  createArticle(data: CreateArticleDTO): Observable<Article> {
    return this.http.post<Article>(`${this.apiUrl}/create`, data);
  }

  getMyArticles(filters?: UserArticleFilterDTO): Observable<UserArticle[]> {
    return this.http.post<UserArticle[]>(`${this.userArticleUrl}/user/me`, filters || {});
  }

  addArticleToList(data: AddUserArticleDTO): Observable<UserArticle> {
    return this.http.post<UserArticle>(`${this.userArticleUrl}/add`, data);
  }

  updateArticleQuantity(data: UpdateQuantityDTO): Observable<Partial<UserArticle>> {
    return this.http.post<Partial<UserArticle>>(`${this.userArticleUrl}/update/quantity`, data);
  }

  toggleArticleNeeded(userArticleId: number): Observable<Partial<UserArticle>> {
    return this.http.patch<Partial<UserArticle>>(`${this.userArticleUrl}/update/needed/${userArticleId}`, {});
  }

  deleteArticleFromList(userArticleId: number): Observable<{ message: string; status: number }> {
    return this.http.delete<{ message: string; status: number }>(`${this.userArticleUrl}/delete/${userArticleId}`);
  }

  // ========== MÉTODOS DE ADMIN ==========

  /**
   * Actualizar artículo (admin)
   */
  updateArticleAdmin(id: number, data: CreateArticleDTO): Observable<Article> {
    return this.http.post<Article>(`${this.apiUrl}/update/admin/${id}`, data);
  }

  /**
   * Eliminar artículo (admin)
   */
  deleteArticleAdmin(id: number): Observable<{ message: string; status: number }> {
    return this.http.delete<{ message: string; status: number }>(`${this.apiUrl}/delete/${id}`);
  }

  // ========== MÉTODOS DE ADMIN PARA USER ARTICLES ==========

  /**
   * Obtener artículos de un usuario (admin)
   */
  getUserArticlesAdmin(userId: number | string, filters?: UserArticleFilterDTO): Observable<UserArticle[]> {
    return this.http.post<UserArticle[]>(`${this.userArticleUrl}/user/admin/${userId}`, filters || {});
  }

  /**
   * Agregar artículo a un usuario (admin)
   */
  addUserArticleAdmin(data: AddUserArticleDTO & { user: number }): Observable<UserArticle> {
    return this.http.post<UserArticle>(`${this.userArticleUrl}/add/admin`, data);
  }

  /**
   * Actualizar cantidad de artículo de usuario (admin)
   */
  updateUserArticleQuantityAdmin(data: UpdateQuantityDTO): Observable<Partial<UserArticle>> {
    return this.http.post<Partial<UserArticle>>(`${this.userArticleUrl}/update/quantity/admin`, data);
  }

  /**
   * Cambiar estado "needed" de artículo de usuario (admin)
   */
  updateUserArticleNeededAdmin(userArticleId: number): Observable<Partial<UserArticle>> {
    return this.http.patch<Partial<UserArticle>>(`${this.userArticleUrl}/update/needed/admin/${userArticleId}`, {});
  }

  /**
   * Eliminar artículo de usuario (admin)
   */
  deleteUserArticleAdmin(userArticleId: number): Observable<{ message: string; status: number }> {
    return this.http.delete<{ message: string; status: number }>(`${this.userArticleUrl}/delete/admin/${userArticleId}`);
  }
}
