import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Category {
  id: number;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCategoryDTO {
  name: string;
  description?: string;
}

export interface UpdateCategoryDTO {
  name?: string;
  description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private apiUrl = `${environment.apiBackendUrl}/category`;

  constructor(private http: HttpClient) {}

  getAllCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/all`).pipe(
      catchError((error) => {
        console.error('Error fetching categories:', error);
        return throwError(() => error);
      })
    );
  }

  getCategoryById(id: number): Observable<Category> {
    return this.http.get<Category>(`${this.apiUrl}/${id}`).pipe(
      catchError((error) => {
        console.error(`Error fetching category ${id}:`, error);
        return throwError(() => error);
      })
    );
  }

  createCategory(category: CreateCategoryDTO): Observable<Category> {
    return this.http.post<Category>(`${this.apiUrl}`, category).pipe(
      catchError((error) => {
        console.error('Error creating category:', error);
        return throwError(() => error);
      })
    );
  }

  updateCategory(id: number, category: UpdateCategoryDTO): Observable<Category> {
    return this.http.put<Category>(`${this.apiUrl}/${id}`, category).pipe(
      catchError((error) => {
        console.error(`Error updating category ${id}:`, error);
        return throwError(() => error);
      })
    );
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      catchError((error) => {
        console.error(`Error deleting category ${id}:`, error);
        return throwError(() => error);
      })
    );
  }

  deleteCategories(ids: number[]): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/batch`, { body: { ids } }).pipe(
      catchError((error) => {
        console.error('Error deleting categories:', error);
        return throwError(() => error);
      })
    );
  }
}

