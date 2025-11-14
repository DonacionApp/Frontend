import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface UserSystem {
  user: {
    id: number;
    username: string;
    email: string;
  };
  people: {
    id: number;
    name: string;
    lastName?: string | null;
    dni?: string;
    createdAt?: string;
    updatedAt?: string;
  } | null;
  role: {
    id: number;
    name: string;
  };
}

export interface UserSystemResponse {
  items: UserSystem[];
  cursor?: string;
  hasMore?: boolean;
}

export interface UserSystemFilters {
  limit?: number;
  cursor?: string;
  search?: string;
  role?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserSystemService {
  private apiUrl = `${environment.apiBackendUrl}/usersystem`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener usuarios que han aceptado los términos y condiciones
   */
  getUserSystems(filters?: UserSystemFilters): Observable<UserSystemResponse> {
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

    if (filters?.role && filters.role.trim() !== '') {
      params = params.set('role', filters.role);
    }

    return this.http.get<UserSystemResponse>(this.apiUrl, { params }).pipe(
      map(response => {
        // Asegurar que items siempre sea un array
        return {
          items: Array.isArray(response.items) ? response.items : (response.items ? [response.items] : []),
          cursor: response.cursor,
          hasMore: response.hasMore
        };
      })
    );
  }
}

