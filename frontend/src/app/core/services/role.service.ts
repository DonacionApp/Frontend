import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Rol } from '../../shared/model/rol.model';

export interface CreateRoleDTO {
  rol: string;
}

export interface UpdateRoleDTO {
  rol?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RoleService {
  private apiUrl = `${environment.apiBackendUrl}/rol`;

  constructor(private http: HttpClient) {}

  getAllRoles(): Observable<Rol[]> {
    return this.http.get<Rol[]>(`${this.apiUrl}/all/roles`).pipe(
      catchError((error) => {
        console.error('Error fetching roles:', error);
        return throwError(() => error);
      })
    );
  }

  getRoleById(id: number): Observable<Rol> {
    return this.http.get<Rol>(`${this.apiUrl}/${id}`).pipe(
      catchError((error) => {
        console.error(`Error fetching role ${id}:`, error);
        return throwError(() => error);
      })
    );
  }

  createRole(role: CreateRoleDTO): Observable<Rol> {
    return this.http.post<Rol>(`${this.apiUrl}`, role).pipe(
      catchError((error) => {
        console.error('Error creating role:', error);
        return throwError(() => error);
      })
    );
  }

  updateRole(id: number, role: UpdateRoleDTO): Observable<Rol> {
    return this.http.put<Rol>(`${this.apiUrl}/${id}`, role).pipe(
      catchError((error) => {
        console.error(`Error updating role ${id}:`, error);
        return throwError(() => error);
      })
    );
  }

  deleteRole(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      catchError((error) => {
        console.error(`Error deleting role ${id}:`, error);
        return throwError(() => error);
      })
    );
  }

  deleteRoles(ids: number[]): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/batch`, { body: { ids } }).pipe(
      catchError((error) => {
        console.error('Error deleting roles:', error);
        return throwError(() => error);
      })
    );
  }
}

