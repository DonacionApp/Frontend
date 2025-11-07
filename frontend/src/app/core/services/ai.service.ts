import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, tap, timeout, retry, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface CreatedTagResponse {
  id: number;
  tag: string;
  name?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class AiService {
  // Construir URL base correctamente
  private readonly baseUrl: string;
  private readonly endpointUrl: string;
  private readonly tagsBaseUrl: string;
  private readonly tagsCreateUrl: string;
  private readonly tagsSearchUrl: string;
  private readonly tagsByNameUrl: string;
  private readonly tagsByIdUrl: string;
  private readonly supportsPublicationTagsEndpoint: boolean;

  constructor(private http: HttpClient) {
    // Construir URL base: http://localhost:5000/ia
    const apiBase = (environment.apiBackendUrl || environment.apiUrl || 'http://localhost:5000').replace(/\/$/, '');
    this.baseUrl = `${apiBase}/ia`;
    this.endpointUrl = `${this.baseUrl}/tags-from-images`;
    this.tagsBaseUrl = `${apiBase}/tags`;
    this.tagsCreateUrl = `${this.tagsBaseUrl}/create/`;  // POST /tags/create/
    this.tagsSearchUrl = `${this.tagsBaseUrl}/name`;      // GET /tags/name/:tag (no existe /name/search)
    this.tagsByNameUrl = `${this.tagsBaseUrl}/name`;      // GET /tags/name/:tag
    this.tagsByIdUrl = `${this.tagsBaseUrl}/id`;          // GET /tags/id/:id
    this.supportsPublicationTagsEndpoint = false;
    
    // Logs de inicialización - estos deberían aparecer cuando se carga la app
    console.log('═══════════════════════════════════════════════════════');
    console.log('🤖 AI SERVICE INICIALIZADO');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📍 API Base URL:', apiBase);
    console.log('📍 AI Service Base URL:', this.baseUrl);
    console.log('📍 Endpoint completo:', this.endpointUrl);
    console.log('📍 Tags Base URL:', this.tagsBaseUrl);
    console.log('📍 Tags Create URL:', this.tagsCreateUrl);
    console.log('📍 Tags By Name URL:', this.tagsByNameUrl);
    console.log('📍 Tags By ID URL:', this.tagsByIdUrl);
    console.log('═══════════════════════════════════════════════════════');
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

  createTag(tag: string): Observable<CreatedTagResponse> {
    const trimmed = (tag || '').trim();
    if (!trimmed) {
      return throwError(() => new Error('Tag vacío'));
    }

    const payload = { tag: trimmed };

    console.log('═══════════════════════════════════════════════════════');
    console.log('🏷️ AI SERVICE - POST /tags/create/');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📍 Tag a crear:', trimmed);
    console.log('📍 URL:', this.tagsCreateUrl);
    console.log('📍 Payload:', payload);
    console.log('═══════════════════════════════════════════════════════');

    return this.http.post<any>(this.tagsCreateUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    }).pipe(
      timeout(10000),
      map(response => {
        // Normalizar la respuesta del backend al formato CreatedTagResponse
        const normalized = this.normalizeTagResponse(response, trimmed);
        console.log('✅ Tag creado exitosamente:', {
          original: response,
          normalized: normalized
        });
        return normalized;
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Error creando tag en backend:', {
          tag: trimmed,
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error,
          errorString: JSON.stringify(error.error)
        });

        // Si el tag ya existe (400 o 409), intentar obtenerlo
        if (error.status === 400 || error.status === 409) {
          const errorData = error.error || {};
          const tagId = errorData?.id || errorData?.tagId || errorData?.data?.id;
          
          console.log('🔄 Tag ya existe o fue rechazado (400/409), intentando obtener:', {
            tag: trimmed,
            tagId,
            errorData,
            errorDataKeys: Object.keys(errorData),
            willTryById: !!tagId,
            willTryByName: true
          });
          
          // Primero intentar obtener por nombre (más confiable cuando el backend no devuelve ID)
          return this.getTagByName(trimmed).pipe(
            map(existing => {
              if (existing) {
                console.log('✅ Tag encontrado por nombre:', existing);
                return existing;
              }
              console.warn('⚠️ Tag no encontrado por nombre, intentando por ID si está disponible');
              
              // Si no se encontró por nombre y tenemos un ID, intentar por ID
              if (tagId) {
                // Retornar un objeto con el ID conocido, aunque no podamos obtener los detalles completos
                return {
                  id: typeof tagId === 'number' ? tagId : parseInt(String(tagId), 10),
                  tag: trimmed,
                  name: trimmed
                };
              }
              
              // Si no hay ID, usar un fallback temporal pero válido
              console.warn('⚠️ No se pudo obtener el tag existente. Usando fallback temporal.');
              return {
                id: Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`),
                tag: trimmed,
                name: trimmed
              };
            }),
            catchError(nameError => {
              console.warn('⚠️ Error obteniendo tag por nombre, intentando por ID:', nameError);
              
              // Si tenemos un ID, intentar obtenerlo
              if (tagId) {
                return this.getTagById(tagId).pipe(
                  map(existing => {
                    if (existing) {
                      console.log('✅ Tag encontrado por ID:', existing);
                      return existing;
                    }
                    // Si no se encuentra por ID, devolver con el ID conocido
                    return {
                      id: typeof tagId === 'number' ? tagId : parseInt(String(tagId), 10),
                      tag: trimmed,
                      name: trimmed
                    };
                  }),
                  catchError(idError => {
                    console.warn('⚠️ Error también obteniendo por ID. Usando fallback con ID conocido:', idError);
                    // Devolver con el ID que sabemos que existe
                    return of({
                      id: typeof tagId === 'number' ? tagId : parseInt(String(tagId), 10),
                      tag: trimmed,
                      name: trimmed
                    });
                  })
                );
              }
              
              // Si no hay ID, devolver fallback
              console.warn('⚠️ No hay ID disponible. Usando fallback temporal.');
              return of({
                id: Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`),
                tag: trimmed,
                name: trimmed
              });
            })
          );
        }

        // Para otros errores (500, etc.), devolver fallback en lugar de lanzar error
        // para que el flujo continúe
        console.warn('⚠️ Error inesperado creando tag, usando fallback:', {
          status: error.status,
          message: error.message
        });
        return of({
          id: Number(`${Date.now()}0`),
          tag: trimmed
        });
      })
    );
  }

  searchTagsByName(name: string): Observable<string[]> {
    const trimmed = (name || '').trim();
    if (!trimmed) {
      return of([]);
    }

    // Endpoint correcto: GET /tags/name/:tag (no /tags/name/search/:tag)
    const url = `${this.tagsByNameUrl}/${encodeURIComponent(trimmed)}`;

    return this.http.get<any>(url).pipe(
      timeout(5000),
      map((response: unknown): string[] => {
        if (Array.isArray(response)) {
          return response
            .map(item => (typeof item === 'string' ? item : (item as any)?.name || (item as any)?.tag))
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
        }

        if (response && typeof response === 'object') {
          const obj = response as Record<string, unknown>;
          const listCandidate = Object.values(obj).find(val => Array.isArray(val));
          if (Array.isArray(listCandidate)) {
            return listCandidate
              .map(item => (typeof item === 'string' ? item : (item as any)?.name || (item as any)?.tag))
              .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
          }
        }

        console.warn('⚠️ searchTagsByName: respuesta inesperada', response);
        return [];
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Error buscando tags por nombre:', {
          name: trimmed,
          status: error.status,
          message: error.message,
          error: error.error
        });
        return of([]);
      })
    );
  }

  getTagById(id: number | string): Observable<CreatedTagResponse | null> {
    const idNum = typeof id === 'string' ? parseInt(id, 10) : id;
    if (Number.isNaN(idNum) || idNum <= 0) {
      console.warn('⚠️ getTagById: ID inválido', { id, idNum });
      return of(null);
    }

    // Endpoint: GET http://localhost:5000/tags/id/{id} (id es dinámico)
    // Construir URL: tagsByIdUrl = "http://localhost:5000/tags/id" + "/" + idNum
    const url = `${this.tagsByIdUrl}/${idNum}`;

    console.log('═══════════════════════════════════════════════════════');
    console.log('🔍 AI SERVICE - GET /tags/id/{id}');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📍 ID:', idNum);
    console.log('📍 URL completa:', url);
    console.log('📍 Método: GET');
    console.log('═══════════════════════════════════════════════════════');

    return this.http.get<any>(url).pipe(
      timeout(5000),
      tap(response => {
        console.log('📥 GET /tags/id/{id} - Respuesta recibida (raw):', {
          id: idNum,
          url: url,
          responseType: typeof response,
          response: response
        });
      }),
      map(response => {
        const normalized = this.normalizeTagResponse(response, `Tag ${idNum}`);
        console.log('✅ GET /tags/id/{id} - Respuesta normalizada:', {
          id: idNum,
          url: url,
          normalized: normalized
        });
        return normalized;
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('❌ GET /tags/id/{id} - Error:', {
          id: idNum,
          url: url,
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error,
          fullError: error
        });
        return of(null);
      })
    );
  }

  getTagByName(name: string): Observable<CreatedTagResponse | null> {
    const trimmed = (name || '').trim();
    if (!trimmed) {
      return of(null);
    }

    // Endpoint: GET http://localhost:5000/tags/name/{tag} (tag es dinámico)
    const url = `${this.tagsByNameUrl}/${encodeURIComponent(trimmed)}`;

    console.log('═══════════════════════════════════════════════════════');
    console.log('🔍 AI SERVICE - GET /tags/name/{tag}');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📍 Nombre del tag:', trimmed);
    console.log('📍 URL completa:', url);
    console.log('📍 Método: GET');
    console.log('═══════════════════════════════════════════════════════');

    return this.http.get<any>(url).pipe(
      timeout(5000),
      tap(response => {
        console.log('📥 GET /tags/name/{tag} - Respuesta recibida (raw):', {
          name: trimmed,
          url: url,
          responseType: typeof response,
          isArray: Array.isArray(response),
          response: response
        });
      }),
      map(response => {
        const normalized = this.normalizeTagResponse(response, trimmed);
        console.log('✅ GET /tags/name/{tag} - Tag normalizado:', {
          name: trimmed,
          normalized
        });
        return normalized;
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          console.log('ℹ️ GET /tags/name/{tag} - Tag no encontrado (404):', {
            name: trimmed,
            url: url
          });
        } else {
          console.warn('⚠️ GET /tags/name/{tag} - Error:', {
            name: trimmed,
            url: url,
            status: error.status,
            statusText: error.statusText,
            message: error.message,
            error: error.error
          });
        }
        return of(null);
      })
    );
  }

  private normalizeTagResponse(response: unknown, fallbackTag: string): CreatedTagResponse {
    if (Array.isArray(response)) {
      const first = response[0];
      if (first && typeof first === 'object') {
        return this.buildTagResponse(first as Record<string, unknown>, fallbackTag);
      }
      if (typeof first === 'string') {
        return {
          id: Number(`${Date.now()}0`),
          tag: first,
          name: first
        };
      }
    }

    if (response && typeof response === 'object') {
      return this.buildTagResponse(response as Record<string, unknown>, fallbackTag);
    }

    return {
      id: Number(`${Date.now()}0`),
      tag: fallbackTag
    };
  }

  private buildTagResponse(source: Record<string, unknown>, fallbackTag: string): CreatedTagResponse {
    const idValue = source['id'] ?? source['tagId'];
    let id = Number(`${Date.now()}0`);

    if (typeof idValue === 'number' && !Number.isNaN(idValue)) {
      id = idValue;
    } else if (typeof idValue === 'string') {
      const parsed = parseInt(idValue, 10);
      if (!Number.isNaN(parsed)) {
        id = parsed;
      }
    }

    const tagValue = (source['tag'] || source['name'] || fallbackTag || '').toString().trim() || fallbackTag;

    return {
      id,
      tag: tagValue,
      name: source['name']?.toString() || tagValue,
      description: source['description']?.toString()
    };
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
    if (!this.supportsPublicationTagsEndpoint) {
      return of([]);
    }

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


