import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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
  private apiUrl = `${environment.apiUrl}/article`;
  private userArticleUrl = `${environment.apiUrl}/userarticle`;

  constructor(private http: HttpClient) { }

  getAllArticles(filters?: ArticleFilterDTO): Observable<Article[]> {
    return this.http.post<Article[]>(`${this.apiUrl}/all`, filters || {});
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
}
