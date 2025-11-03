import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface DonationConnectionStatus {
  connected: boolean;
  responseTime?: number;
  message: string;
  error?: any;
}

@Injectable({
  providedIn: 'root'
})
export class DonationConnectionService {
  private readonly TIMEOUT_MS = 5000; // 5 segundos
  private readonly apiUrl = `${environment.apiBackendUrl}/post`;

  constructor(private http: HttpClient) {}

  /**
   * Verifica la conexión con el endpoint de donaciones
   */
  checkConnection(): Observable<DonationConnectionStatus> {
    const startTime = Date.now();

    // Intentar una petición GET al endpoint de posts
    // Un 401/403 significa que el endpoint existe pero requiere autenticación (conexión OK)
    // Un 404 significa que el endpoint no existe
    // Un error de conexión significa que el servidor no está disponible
    return this.http.get<any>(this.apiUrl, { observe: 'response' }).pipe(
      timeout(this.TIMEOUT_MS),
      map(response => {
        const responseTime = Date.now() - startTime;
        return {
          connected: true,
          responseTime,
          message: '✅ Backend de donaciones conectado correctamente'
        };
      }),
      catchError(error => {
        const responseTime = Date.now() - startTime;
        
        // Si es 401 o 403, el endpoint existe pero requiere auth (conexión OK)
        if (error.status === 401 || error.status === 403) {
          return of({
            connected: true,
            responseTime,
            message: '✅ Backend conectado (requiere autenticación)',
            error: { status: error.status }
          });
        }
        
        // Timeout o error de conexión
        if (error.name === 'TimeoutError' || error.status === 0) {
          return of({
            connected: false,
            responseTime,
            message: '❌ No se puede conectar al backend. Verifica que esté ejecutándose en el puerto 5000',
            error: error
          });
        }
        
        // Otros errores
        return of({
          connected: false,
          responseTime,
          message: `❌ Error al conectar: ${error.message || 'Error desconocido'}`,
          error: error
        });
      })
    );
  }

  /**
   * Verificación rápida (retorna solo boolean)
   */
  isConnected(): Observable<boolean> {
    return this.checkConnection().pipe(
      map(status => status.connected)
    );
  }

  /**
   * Obtiene la URL del endpoint de donaciones
   */
  getEndpointUrl(): string {
    return this.apiUrl;
  }
}

