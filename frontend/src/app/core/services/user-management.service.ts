import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface UserManagement {
  id: number;
  username: string;
  email: string;
  token: string | null;
  loginAttempts: number;
  lockUntil: string | null;
  profilePhoto: string;
  dateSendCodigo: string | null;
  lastLogin: string | null;
  emailVerified: boolean;
  verified: boolean;
  code: string | null;
  block: boolean;
  location: string | null;
  people: {
    id: number;
    name: string;
    municipio: string;
    lastName: string | null;
    birdthDate: string;
    typeDni: {
      id: number;
      type: string;
      createdAt: string;
      updatedAt: string;
    };
    dni: string;
    residencia: string;
    telefono: string;
    supportId: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  rol: {
    id: number;
    rol: string;
    createdAt: string;
    updatedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserDTO {
  block?: boolean;
  verified?: boolean;
  emailVerified?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UserManagementService {
  private apiUrl = `${environment.apiBackendUrl}/user`;

  constructor(private http: HttpClient) {}

  getAllUsers(): Observable<UserManagement[]> {
    return this.http.get<UserManagement[]>(this.apiUrl).pipe(
      catchError((error) => {
        console.error('Error fetching users:', error);
        return throwError(() => error);
      })
    );
  }

  getUserById(id: number): Observable<UserManagement> {
    return this.http.get<UserManagement>(`${this.apiUrl}/${id}`).pipe(
      catchError((error) => {
        console.error(`Error fetching user ${id}:`, error);
        return throwError(() => error);
      })
    );
  }

  updateUser(id: number, user: UpdateUserDTO): Observable<UserManagement> {
    return this.http.put<UserManagement>(`${this.apiUrl}/${id}`, user).pipe(
      catchError((error) => {
        console.error(`Error updating user ${id}:`, error);
        return throwError(() => error);
      })
    );
  }

  blockUser(id: number): Observable<UserManagement> {
    return this.updateUser(id, { block: true });
  }

  unblockUser(id: number): Observable<UserManagement> {
    return this.updateUser(id, { block: false });
  }

  verifyUser(id: number): Observable<UserManagement> {
    return this.updateUser(id, { verified: true });
  }

  unverifyUser(id: number): Observable<UserManagement> {
    return this.updateUser(id, { verified: false });
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      catchError((error) => {
        console.error(`Error deleting user ${id}:`, error);
        return throwError(() => error);
      })
    );
  }

  deleteUsers(ids: number[]): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/batch`, { body: { ids } }).pipe(
      catchError((error) => {
        console.error('Error deleting users:', error);
        return throwError(() => error);
      })
    );
  }
}

