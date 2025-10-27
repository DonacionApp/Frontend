import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DatabaseTestService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Probar conexión básica con el backend
  testConnection(): Observable<any> {
    return this.http.get(`${this.apiUrl}/auth/profile`);
  }

  // Probar endpoint de registro (debería devolver errores de validación)
  testRegistrationEndpoint(): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register`, {
      test: 'connection'
    });
  }

  // Obtener información del backend
  getBackendInfo(): Observable<any> {
    return this.http.get(`${this.apiUrl}/user`);
  }
}
