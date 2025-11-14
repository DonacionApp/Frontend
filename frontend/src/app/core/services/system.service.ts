import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SystemContent {
  policies?: string;
  terms?: string;
  aboutUs?: string;
}

export interface UpdateSystemContentDTO {
  content: string;
}

@Injectable({
  providedIn: 'root'
})
export class SystemService {
  private apiUrl = `${environment.apiBackendUrl}/system`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener políticas del sistema
   */
  getPolicies(): Observable<{ policies: string }> {
    return this.http.get<{ policies: string }>(`${this.apiUrl}/policies`);
  }

  /**
   * Actualizar políticas del sistema
   */
  updatePolicies(data: UpdateSystemContentDTO): Observable<{ policies: string }> {
    return this.http.put<{ policies: string }>(`${this.apiUrl}/policies`, data);
  }

  /**
   * Obtener términos y condiciones
   */
  getTerms(): Observable<{ terms: string }> {
    return this.http.get<{ terms: string }>(`${this.apiUrl}/terms`);
  }

  /**
   * Actualizar términos y condiciones
   */
  updateTerms(data: UpdateSystemContentDTO): Observable<{ terms: string }> {
    return this.http.put<{ terms: string }>(`${this.apiUrl}/terms`, data);
  }

  /**
   * Obtener información "Acerca de Nosotros"
   */
  getAboutUs(): Observable<{ aboutUs: string }> {
    return this.http.get<{ aboutUs: string }>(`${this.apiUrl}/about-us`);
  }

  /**
   * Actualizar información "Acerca de Nosotros"
   */
  updateAboutUs(data: UpdateSystemContentDTO): Observable<{ aboutUs: string }> {
    return this.http.put<{ aboutUs: string }>(`${this.apiUrl}/about-us`, data);
  }
}

