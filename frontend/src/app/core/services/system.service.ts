import { HttpClient, HttpResponse } from '@angular/common/http';
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

export interface ExpirationConfig {
  policiesExpiresAt?: Date;
  termsExpiresAt?: Date;
  aboutUsExpiresAt?: Date;
  expirationIntervalDays?: number;
}

export interface BackupConfig {
  autoBackupEnabled: boolean;
  backupIntervalDays?: number;
  lastBackupDate?: Date;
  retentionDays?: number;
}

export interface BackupStatus {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  fileName?: string;
  size?: number;
  error?: string;
}

export interface UpdateExpirationDTO {
  policiesExpiresAt?: Date;
  termsExpiresAt?: Date;
  aboutUsExpiresAt?: Date;
  expirationIntervalDays?: number;
}

export interface UpdateBackupConfigDTO {
  autoBackupEnabled: boolean;
  backupIntervalDays?: number;
  retentionDays?: number;
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
   * Obtener términos y condiciones con la respuesta completa (headers + body)
   * Útil para leer encabezados como `Last-Modified` o metadatos.
   */
  getTermsWithResponse(force: boolean = false): Observable<HttpResponse<{ terms: string }>> {
    const url = force ? `${this.apiUrl}/terms?_=${Date.now()}` : `${this.apiUrl}/terms`;
    return this.http.get<{ terms: string }>(url, { observe: 'response' });
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
   * Obtener políticas con la respuesta completa (headers + body)
   */
  getPoliciesWithResponse(force: boolean = false): Observable<HttpResponse<{ policies: string }>> {
    const url = force ? `${this.apiUrl}/policies?_=${Date.now()}` : `${this.apiUrl}/policies`;
    return this.http.get<{ policies: string }>(url, { observe: 'response' });
  }

  /**
   * Actualizar información "Acerca de Nosotros"
   */
  updateAboutUs(data: UpdateSystemContentDTO): Observable<{ aboutUs: string }> {
    return this.http.put<{ aboutUs: string }>(`${this.apiUrl}/about-us`, data);
  }

  /**
   * Obtener configuración de expiración
   */
  getExpirationConfig(): Observable<ExpirationConfig> {
    return this.http.get<ExpirationConfig>(`${this.apiUrl}/expiration`);
  }

  /**
   * Actualizar configuración de expiración
   */
  updateExpirationConfig(data: UpdateExpirationDTO): Observable<ExpirationConfig> {
    return this.http.put<ExpirationConfig>(`${this.apiUrl}/expiration`, data);
  }

  /**
   * Obtener configuración de backups
   */
  getBackupConfig(): Observable<BackupConfig> {
    return this.http.get<BackupConfig>(`${this.apiUrl}/backup/config`);
  }

  /**
   * Actualizar configuración de backups
   */
  updateBackupConfig(data: UpdateBackupConfigDTO): Observable<BackupConfig> {
    return this.http.put<BackupConfig>(`${this.apiUrl}/backup/config`, data);
  }

  /**
   * Disparar backup manual
   */
  triggerBackup(): Observable<BackupStatus> {
    return this.http.post<BackupStatus>(`${this.apiUrl}/backup/trigger`, {});
  }

  /**
   * Obtener estado de un backup
   */
  getBackupStatus(backupId: string): Observable<BackupStatus> {
    return this.http.get<BackupStatus>(`${this.apiUrl}/backup/${backupId}/status`);
  }

  /**
   * Obtener historial de backups
   */
  getBackupHistory(limit: number = 10): Observable<BackupStatus[]> {
    return this.http.get<BackupStatus[]>(`${this.apiUrl}/backup/history?limit=${limit}`);
  }

  /**
   * Descargar backup
   */
  downloadBackup(backupId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/backup/${backupId}/download`, { responseType: 'blob' });
  }

  /**
   * Eliminar backup
   */
  deleteBackup(backupId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/backup/${backupId}`);
  }
}

