import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Report {
  id: number;
  comments: {
    report: string;
    extraCommets?: string;  // Typo del backend
    postReport?: number;
  };
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    username: string;
    profilePhoto: string;
  };
}

export interface ReportResponse {
  items: Report[];
  cursor?: string;
  hasMore?: boolean;
}

export interface ReportFilters {
  limit?: number;
  search?: string;
  cursor?: string;
  orderBy?: string;
  order?: 'ASC' | 'DESC';
}

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private apiUrl = `${environment.apiBackendUrl}/report`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener lista de reportes con scroll infinito y filtros
   */
  getReports(filters?: ReportFilters): Observable<ReportResponse> {
    let params = new HttpParams();

    if (filters?.limit && filters.limit > 0) {
      params = params.set('limit', filters.limit.toString());
    }

    if (filters?.search && filters.search.trim() !== '') {
      params = params.set('search', filters.search);
    }

    if (filters?.cursor && filters.cursor.trim() !== '') {
      params = params.set('cursor', filters.cursor);
    }

    if (filters?.orderBy && filters.orderBy.trim() !== '') {
      params = params.set('orderBy', filters.orderBy);
    }

    if (filters?.order && (filters.order === 'ASC' || filters.order === 'DESC')) {
      params = params.set('order', filters.order);
    }

    return this.http.get<any>(`${this.apiUrl}/list`, { params }).pipe(
      map(response => {
        console.log('Raw response from backend:', response);
        
        // El backend puede devolver los reportes directamente como array o dentro de un objeto
        let items: Report[] = [];
        
        if (Array.isArray(response)) {
          // Si la respuesta es directamente un array
          items = response;
        } else if (response?.items && Array.isArray(response.items)) {
          // Si la respuesta tiene un campo items
          items = response.items;
        } else if (response?.data && Array.isArray(response.data)) {
          // Si la respuesta tiene un campo data
          items = response.data;
        } else if (response?.reports && Array.isArray(response.reports)) {
          // Si la respuesta tiene un campo reports
          items = response.reports;
        }
        
        console.log('Processed items:', items);
        
        return {
          items: items,
          cursor: response?.cursor || response?.nextCursor,
          hasMore: response?.hasMore !== undefined ? response.hasMore : (response?.cursor ? true : false)
        };
      })
    );
  }

  /**
   * Crear un nuevo reporte
   * @param data.idUser - ID del usuario REPORTADO (no quien reporta)
   * @param data.report - Motivo del reporte
   * @param data.extraComments - Comentarios adicionales
   * @param data.postId - ID del post a reportar (para reportes de publicaciones)
   * @param data.acknowledgmentId - ID del agradecimiento a reportar
   */
  createReport(data: {
    report: string;
    extraComments?: string;
    postReport?: string;
    acknowledgmentId?: number;
    postId?: number;
    idUser?: number;
  }): Observable<{ message: string; success: boolean; reportId?: number }> {
    // Validar datos requeridos
    if (!data.report || !data.report.trim()) {
      console.error('Error: El motivo del reporte es requerido');
      return throwError(() => new Error('El motivo del reporte es requerido'));
    }

    if (!data.postId && !data.acknowledgmentId) {
      console.error('Error: Se requiere postId o acknowledgmentId');
      return throwError(() => new Error('Se requiere postId o acknowledgmentId para crear el reporte'));
    }

    if (!data.idUser) {
      console.error('Error: El ID del usuario reportado es requerido');
      return throwError(() => new Error('El ID del usuario reportado es requerido'));
    }

    // Construir el payload según el DTO del backend
    // idUser = usuario REPORTADO (dueño del post/agradecimiento)
    // content = objeto con { report, extraCommets (typo del backend), postReport (ID numérico) }
    const payload: any = {
      idUser: data.idUser,  // Usuario REPORTADO
      content: {
        report: data.report.trim(),
        // Backend tiene typo "extraCommets" en lugar de "extraComments"
        extraCommets: data.extraComments?.trim() || '',
        postReport: data.postId || data.acknowledgmentId || 0
      }
    };

    console.log('✅ Creating report with payload:', JSON.stringify(payload, null, 2));
    console.log('📍 Endpoint:', `${this.apiUrl}/create/new`);
    console.log('ℹ️ idUser (reportado):', data.idUser);
    console.log('ℹ️ postId/acknowledgmentId:', data.postId || data.acknowledgmentId);

    return this.http.post<{ message: string; success: boolean; reportId?: number; status?: number }>(`${this.apiUrl}/create/new`, payload).pipe(
      map(response => {
        console.log('✅ Report created successfully:', response);
        
        // El backend puede retornar status en el body si hay error
        if (response.status && response.status >= 400) {
          throw new Error(response.message || 'Error al crear el reporte');
        }
        
        return {
          message: response.message || 'Reporte creado exitosamente',
          success: true,
          reportId: response.reportId
        };
      }),
      catchError(error => {
        console.error('❌ Error creating report:', error);
        console.error('📋 Status:', error.status);
        console.error('📋 Error body:', error.error);
        console.error('📋 Full error:', error);
        
        // Extraer mensaje de error del backend
        const errorMsg = error.error?.message || error.message || 'Error desconocido al crear el reporte';
        return throwError(() => new Error(errorMsg));
      })
    );
  }
}

