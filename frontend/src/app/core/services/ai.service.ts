import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, tap, timeout, retry, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AiService {
  // Construir URL base correctamente
  private readonly baseUrl: string;
  private readonly endpointUrl: string;
  private readonly tagsCreateUrl: string;

  constructor(private http: HttpClient) {
    // Construir URL base: http://localhost:5000/ia
    const apiBase = (environment.apiBackendUrl || environment.apiUrl || 'http://localhost:5000').replace(/\/$/, '');
    this.baseUrl = `${apiBase}/ia`;
    this.endpointUrl = `${this.baseUrl}/tags-from-images`;
    this.tagsCreateUrl = `${apiBase}/tags/create`;
    
    console.log('🤖 AI Service inicializado');
    console.log('📍 API Base URL:', apiBase);
    console.log('📍 AI Service Base URL:', this.baseUrl);
    console.log('📍 Endpoint completo:', this.endpointUrl);
  }

  /**
   * Genera tags desde imágenes usando IA y guarda las imágenes en la BD
   * Endpoint: POST http://localhost:5000/ia/tags-from-images
   * Si se proporciona publicationId, las imágenes se guardan en la BD asociadas a esa publicación
   */
  getTagsFromImages(files: File[], publicationId?: string): Observable<string[]> {
    if (!files || files.length === 0) {
      console.warn('⚠️ No se proporcionaron archivos para generar tags');
      return of([]);
    }

    // Validar que los archivos sean imágenes
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      console.warn('⚠️ No se encontraron archivos de imagen válidos');
      return of([]);
    }

    const formData = new FormData();
    imageFiles.forEach((f) => {
      formData.append('files', f, f.name);
      console.log('📎 Agregando archivo a FormData:', {
        name: f.name,
        type: f.type,
        size: f.size,
        sizeMB: (f.size / 1024 / 1024).toFixed(2)
      });
    });

    // Si se proporciona publicationId, agregarlo al FormData para que el backend guarde las imágenes
    if (publicationId) {
      formData.append('publicationId', publicationId);
      console.log('📝 Agregando publicationId al FormData:', publicationId);
      console.log('💾 El backend guardará las imágenes en la BD asociadas a esta publicación');
    }

    const finalUrl = publicationId 
      ? `${this.endpointUrl}?publicationId=${publicationId}` 
      : this.endpointUrl;

    console.log('🌐 Enviando petición a:', finalUrl);
    console.log('📦 FormData tiene', imageFiles.length, 'archivo(s) de imagen');
    console.log('🔍 Verificando endpoint:', {
      baseUrl: this.baseUrl,
      endpoint: '/tags-from-images',
      fullUrl: finalUrl,
      publicationId: publicationId || 'no proporcionado',
      apiBackendUrl: environment.apiBackendUrl
    });

    return this.http.post<string[]>(finalUrl, formData, {
      // No establecer Content-Type, dejar que el navegador lo haga automáticamente para FormData
    }).pipe(
      timeout(60000), // 60 segundos de timeout para procesamiento de IA
      retry(1), // Reintentar una vez en caso de error
      tap(response => {
        console.log('✅ Respuesta de IA recibida exitosamente');
        console.log('📋 Tags generados:', response);
        console.log('📊 Cantidad de tags:', Array.isArray(response) ? response.length : 0);
        if (publicationId) {
          console.log('💾 Las imágenes deberían estar guardadas en la BD para la publicación:', publicationId);
        }
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Error en petición a IA');
        console.error('📋 Detalles del error:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error,
          url: this.endpointUrl,
          endpoint: '/ia/tags-from-images',
          apiBackendUrl: environment.apiBackendUrl
        });

        // Si es error de conexión, dar mensaje más claro
        if (error.status === 0 || error.message?.includes('Failed to fetch')) {
          console.error('🔴 ERROR: No se pudo conectar al backend');
          console.error('💡 Verifica que el backend esté corriendo en:', environment.apiBackendUrl);
          console.error('💡 Verifica que el endpoint exista:', finalUrl);
        } else if (error.status === 404) {
          console.error('🔴 ERROR 404: Endpoint no encontrado');
          console.error('💡 Verifica que el endpoint esté disponible:', finalUrl);
        } else if (error.status === 500) {
          console.error('🔴 ERROR 500: Error interno del servidor');
          console.error('💡 Revisa los logs del backend para más detalles');
        }

        // Retornar array vacío en lugar de lanzar error para no romper el flujo
        return of([]);
      })
    );
  }

  createTag(tag: string, publicationId?: string): Observable<{ id: number; tag: string; createdAt?: string; updatedAt?: string }> {
    const payload: { tag: string; postId?: string } = { tag };
    if (publicationId) {
      payload.postId = publicationId;
    }

    return this.http.post<{ id: number; tag: string; createdAt?: string; updatedAt?: string }>(this.tagsCreateUrl, payload).pipe(
      timeout(10000),
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Error creando tag en backend:', {
          tag,
          publicationId,
          status: error.status,
          message: error.message,
          error: error.error
        });
        return throwError(() => error);
      })
    );
  }

  /**
   * Verifica si el endpoint de IA está disponible
   */
  testEndpoint(): Observable<boolean> {
    console.log('🔍 Probando conexión con endpoint de IA:', this.endpointUrl);
    // Hacer una petición de prueba (el backend debería tener un endpoint de health check)
    // Por ahora, solo retornamos un observable que siempre resuelve
    return new Observable(observer => {
      observer.next(true);
      observer.complete();
    });
  }

  /**
   * Obtiene tags generados previamente para una publicación existente
   * Endpoint: GET http://localhost:5000/ia/tags-from-images?publicationId={id}
   */
  getTagsForPublication(publicationId: string): Observable<string[]> {
    const trimmedId = (publicationId || '').toString().trim();
    if (!trimmedId) {
      console.warn('⚠️ getTagsForPublication: publicationId vacío');
      return of([]);
    }

    const url = `${this.endpointUrl}?publicationId=${encodeURIComponent(trimmedId)}`;

    console.log('🤖 Solicitando tags IA para publicación existente:', {
      publicationId: trimmedId,
      url
    });

    return this.http.get<any>(url).pipe(
      timeout(30000),
      map((response: unknown): string[] => {
        if (Array.isArray(response)) {
          return response as string[];
        }

        if (response && typeof response === 'object') {
          const responseObj = response as Record<string, unknown>;
          const tagsValue = responseObj['tags'];
          if (Array.isArray(tagsValue)) {
            return tagsValue as string[];
          }
        }

        if (response && typeof response === 'object') {
          // Buscar propiedad que contenga array de strings
          const candidate = Object.values(response as Record<string, unknown>).find(value => Array.isArray(value));
          if (Array.isArray(candidate)) {
            return candidate as string[];
          }
        }

        console.warn('⚠️ getTagsForPublication: respuesta inesperada', response);
        return [];
      }),
      tap((tags: string[]) => {
        console.log('🤖 Tags IA obtenidos:', {
          publicationId: trimmedId,
          count: tags.length,
          tags
        });
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Error obteniendo tags IA existentes:', {
          publicationId: trimmedId,
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error
        });
        return of([]);
      })
    );
  }
}


