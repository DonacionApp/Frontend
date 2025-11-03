import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of, forkJoin } from 'rxjs';
import { tap, catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// Interfaces para donaciones
export interface Article {
  name: string;
  quantity: number;
}

export interface Comment {
  text: string;
}

export interface DonationUser {
  id: string;
  username: string;
  email: string;
  profilePhoto?: string;
  verified: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DonationFile {
  id?: string;
  name: string;
  url: string;
  type: 'image' | 'pdf' | 'video';
  size: number;
  uploadedAt?: string;
}

export interface DonationLike {
  id?: string;
  userId: string;
  donationId: string;
  createdAt?: string;
}

export interface CreateDonationDTO {
  // 🔄 Campos que acepta el backend
  title?: string; // Título de la publicación
  message: string; // Mensaje/descripción principal (campo principal del backend)
  typePostId?: number; // ID del tag (obtenido desde /tags - corresponde al ID del Tag en el backend)
  
  // Campos opcionales que podemos enviar como JSON en message o ignorar
  lugarRecogida?: string;
  lugarDonacion?: string;
  articles?: Article[];
  comments?: Comment[];
  comunity?: string;
  fechaMaximaEntrega?: string; // ISO 8601 format
  donationTypeId?: string; // Alias para typePostId
  description?: string; // Alias para message
}

export interface Donation {
  id: string;
  userId: string;
  user?: DonationUser;
  
  // Campos principales del backend
  title?: string;
  message: string; // Campo obligatorio del backend
  typePostId?: number;
  
  // Campos adicionales opcionales
  lugarRecogida?: string;
  lugarDonacion?: string;
  articles: Article[]; // Obligatorio para compatibilidad con código existente (siempre array, puede estar vacío)
  comments?: Comment[];
  comunity?: string;
  fechaMaximaEntrega?: string;
  donationTypeId?: string;
  description?: string;
  
  // Metadata
  statusDonation?: string;
  createdAt: string;
  updatedAt: string;
  files?: DonationFile[];
  likes?: DonationLike[];
  likesCount?: number;
  isLikedByCurrentUser?: boolean;
  donationType?: {
    id: string;
    name: string;
    description?: string;
  };
  tags?: Array<{
    id: number;
    tag: string;
    description?: string;
  }>;
}

export interface OrganizationStats {
  activeDonations: number;      // Donaciones con estado disponible
  totalDonations: number;        // Total de donaciones creadas
  requestsReceived: number;      // Solicitudes de donantes (futuro)
  unreadMessages: number;        // Mensajes sin leer (futuro)
}

@Injectable({
  providedIn: 'root'
})
export class DonationService {
  // 🔄 ADAPTADO: Ahora usa el endpoint /post del backend existente
  private apiUrl = `${environment.apiBackendUrl}/post`;

  // Estado de las donaciones
  private donationsSubject = new BehaviorSubject<Donation[]>([]);
  public donations$ = this.donationsSubject.asObservable();

  // Estado de carga
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  // Estado de likes en proceso (para prevenir múltiples clics)
  private likesInProgress = new Set<string>();

  constructor(private http: HttpClient) {}

  /**
   * Crear una nueva donación (sin archivos)
   * 🔄 ADAPTADO: Usa el formato del backend
   */
  createDonation(donationData: CreateDonationDTO): Observable<Donation> {
    this.loadingSubject.next(true);
    
    // Preparar datos en formato que el backend espera
    const backendData: any = {
      message: this.buildFullMessage(donationData),
      typePost: 1
    };
    
    if (donationData.title) {
      backendData.title = donationData.title;
    }
    
    // Agregar campos de ubicación al objeto JSON
    if (donationData.lugarRecogida) {
      backendData.lugarRecogida = donationData.lugarRecogida;
    }
    if (donationData.lugarDonacion) {
      backendData.lugarDonacion = donationData.lugarDonacion;
    }
    if (donationData.comunity) {
      backendData.comunity = donationData.comunity;
    }
    if (donationData.fechaMaximaEntrega) {
      backendData.fechaMaximaEntrega = donationData.fechaMaximaEntrega;
    }
    if (donationData.articles && donationData.articles.length > 0) {
      backendData.articles = donationData.articles;
    }
    if (donationData.comments && donationData.comments.length > 0) {
      backendData.comments = donationData.comments;
    }
    
    // 🔄 Obtener typePostId de forma segura
    let typePostIdValue: number | undefined = undefined;
    
    if (donationData.typePostId) {
      // Si viene como número directamente
      typePostIdValue = typeof donationData.typePostId === 'number' 
        ? donationData.typePostId 
        : parseInt(String(donationData.typePostId));
    } else if (donationData.donationTypeId) {
      // Si viene como string o número desde el formulario
      const parsed = typeof donationData.donationTypeId === 'string' 
        ? parseInt(donationData.donationTypeId)
        : donationData.donationTypeId;
      
      if (!isNaN(parsed) && parsed > 0 && typeof parsed === 'number') {
        typePostIdValue = parsed;
      }
    }
    
    // ⚠️ IMPORTANTE: Solo agregar typePostId si es un número válido
    // typePostId = ID del Tag obtenido desde /tags (TagsController)
    // NO enviar undefined, null, 0, NaN, o strings vacíos
    if (typePostIdValue !== undefined && !isNaN(typePostIdValue) && typePostIdValue > 0) {
      backendData.typePostId = typePostIdValue;
      console.log('✅ [DonationService] typePostId (Tag ID) válido agregado:', typePostIdValue);
    } else {
      console.warn('⚠️ [DonationService] typePostId no válido o no seleccionado. NO se enviará al backend.');
      console.warn('  donationData.typePostId:', donationData.typePostId);
      console.warn('  donationData.donationTypeId:', donationData.donationTypeId);
      console.warn('  typePostIdValue calculado:', typePostIdValue);
      // NO agregar typePostId al backendData si no es válido
    }
    
    // 📤 LOG: Datos que se enviarán al backend
    console.log('📤 [DonationService] Enviando datos al backend:', {
      url: `${this.apiUrl}/create`,
      data: backendData,
      dataStringified: JSON.stringify(backendData, null, 2),
      typePostIdIncluido: 'typePostId' in backendData,
      typePostIdValor: backendData.typePostId,
      lugarRecogida: backendData.lugarRecogida,
      lugarDonacion: backendData.lugarDonacion,
      comunity: backendData.comunity,
      fechaMaximaEntrega: backendData.fechaMaximaEntrega
    });
    
    return this.http.post<any>(`${this.apiUrl}/create`, backendData).pipe(
      tap(response => {
        console.log('✅ [DonationService] Respuesta exitosa del backend:', response);
        console.log('📍 [DonationService] Campos de ubicación en la respuesta:', {
          lugarRecogida: response.lugarRecogida,
          lugarDonacion: response.lugarDonacion,
          comunity: response.comunity,
          fechaMaximaEntrega: response.fechaMaximaEntrega,
          responseCompleto: response
        });
      }),
      map(response => this.mapBackendPostsToFrontend([response])[0]),
      tap(newDonation => {
        // Agregar la nueva donación al estado local
        const currentDonations = this.donationsSubject.value;
        this.donationsSubject.next([newDonation, ...currentDonations]);
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        
        // 📥 LOG DETALLADO DEL ERROR
        console.error('❌ [DonationService] Error al crear donación:');
        console.error('  Status:', error.status);
        console.error('  Status Text:', error.statusText);
        console.error('  URL:', error.url);
        console.error('  Error completo:', error);
        
        // Mostrar el cuerpo del error si está disponible
        if (error.error) {
          console.error('  📋 Cuerpo del error (error.error):');
          console.error('    ', JSON.stringify(error.error, null, 2));
          
          // Si tiene un mensaje específico
          if (error.error.message) {
            console.error('  💬 Mensaje del backend:', error.error.message);
          }
          
          // Si tiene errores de validación
          if (error.error.errors) {
            console.error('  🔍 Errores de validación:');
            Object.keys(error.error.errors).forEach(field => {
              console.error(`    • ${field}:`, error.error.errors[field]);
            });
          }
        }
        
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtener todas las donaciones del usuario autenticado
   * 🔄 USA: GET /post/me/posts
   */
  getMyDonations(): Observable<Donation[]> {
    this.loadingSubject.next(true);
    return this.http.get<any[]>(`${this.apiUrl}/me/posts`).pipe(
      map(posts => {
        const mappedDonations = this.mapBackendPostsToFrontend(Array.isArray(posts) ? posts : []);
        return mappedDonations;
      }),
      // Cargar tags para cada donación
      switchMap(donations => {
        if (!donations || donations.length === 0) {
          this.loadingSubject.next(false);
          return of(donations);
        }
        
        const tagObservables = donations.map(donation => 
          this.getTagsByPostId(donation.id).pipe(
            map(tags => ({ donation, tags })),
            catchError(error => {
              console.warn(`⚠️ No se pudieron cargar tags para la donación ${donation.id}:`, error);
              return of({ donation, tags: [] });
            })
          )
        );
        
        return forkJoin(tagObservables).pipe(
          map(results => {
            return results.map(({ donation, tags }) => ({
              ...donation,
              tags: Array.isArray(tags) ? tags.map((tag: any) => ({
                id: tag.id || tag.tagId,
                tag: tag.tag || tag.name || '',
                description: tag.description || ''
              })) : []
            }));
          })
        );
      }),
      tap(donations => {
        this.donationsSubject.next(donations);
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        console.error('Error al obtener donaciones:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtener publicaciones de un usuario específico
   * 🔄 USA: POST /post/user/posts (con userId en body para ocultar parámetro)
   */
  getUserDonations(userId: string): Observable<Donation[]> {
    this.loadingSubject.next(true);
    // Enviar userId en el body para ocultar el parámetro de la URL
    return this.http.post<any[]>(`${this.apiUrl}/user/posts`, { userId }).pipe(
      map(posts => {
        const mappedDonations = this.mapBackendPostsToFrontend(Array.isArray(posts) ? posts : []);
        return mappedDonations;
      }),
      // Cargar tags para cada donación
      switchMap(donations => {
        if (!donations || donations.length === 0) {
          this.loadingSubject.next(false);
          return of(donations);
        }
        
        const tagObservables = donations.map(donation => 
          this.getTagsByPostId(donation.id).pipe(
            map(tags => ({ donation, tags })),
            catchError(error => {
              console.warn(`⚠️ No se pudieron cargar tags para la donación ${donation.id}:`, error);
              return of({ donation, tags: [] });
            })
          )
        );
        
        return forkJoin(tagObservables).pipe(
          map(results => {
            return results.map(({ donation, tags }) => ({
              ...donation,
              tags: Array.isArray(tags) ? tags.map((tag: any) => ({
                id: tag.id || tag.tagId,
                tag: tag.tag || tag.name || '',
                description: tag.description || ''
              })) : []
            }));
          })
        );
      }),
      tap(donations => {
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        console.error('Error al obtener donaciones del usuario:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtener una donación por ID
   * 🔄 USA: GET /post/:id
   */
  getDonationById(id: string): Observable<Donation> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(post => this.mapBackendPostsToFrontend([post])[0]),
      // Cargar tags para la donación
      switchMap(donation => {
        return this.getTagsByPostId(donation.id).pipe(
          map(tags => ({
            ...donation,
            tags: Array.isArray(tags) ? tags.map((tag: any) => ({
              id: tag.id || tag.tagId,
              tag: tag.tag || tag.name || '',
              description: tag.description || ''
            })) : []
          })),
          catchError(error => {
            console.warn(`⚠️ No se pudieron cargar tags para la donación ${donation.id}:`, error);
            return of({ ...donation, tags: [] });
          })
        );
      }),
      catchError(error => {
        console.error('Error al obtener donación:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Actualizar una donación
   * 🔄 USA: POST /post/update/:id
   */
  updateDonation(id: string, updates: Partial<CreateDonationDTO>): Observable<Donation> {
    this.loadingSubject.next(true);
    return this.http.post<Donation>(`${this.apiUrl}/update/${id}`, updates).pipe(
      tap(updatedDonation => {
        // Actualizar en el estado local
        const currentDonations = this.donationsSubject.value;
        const index = currentDonations.findIndex(d => d.id === id);
        if (index !== -1) {
          currentDonations[index] = updatedDonation;
          this.donationsSubject.next([...currentDonations]);
        }
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        console.error('Error al actualizar donación:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Eliminar una donación
   * 🔄 USA: DELETE /post/delete/:id
   */
  deleteDonation(id: string): Observable<void> {
    this.loadingSubject.next(true);
    return this.http.delete<void>(`${this.apiUrl}/delete/${id}`).pipe(
      tap(() => {
        // Eliminar del estado local
        const currentDonations = this.donationsSubject.value;
        this.donationsSubject.next(currentDonations.filter(d => d.id !== id));
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        console.error('Error al eliminar donación:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Extender fecha máxima de entrega en 10 días
   */
  extendDeliveryDate(id: string): Observable<Donation> {
    return this.http.post<Donation>(`${this.apiUrl}/${id}/extend-date`, {}).pipe(
      tap(updatedDonation => {
        // Actualizar en el estado local
        const currentDonations = this.donationsSubject.value;
        const index = currentDonations.findIndex(d => d.id === id);
        if (index !== -1) {
          currentDonations[index] = updatedDonation;
          this.donationsSubject.next([...currentDonations]);
        }
      }),
      catchError(error => {
        console.error('Error al extender fecha:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Verificar si el usuario actual es el propietario de la donación
   */
  isOwner(donation: Donation, currentUserId: string): boolean {
    return donation.userId === currentUserId;
  }

  /**
   * Verificar si el usuario puede editar una donación
   */
  canEdit(donation: Donation, currentUserId: string): boolean {
    return this.isOwner(donation, currentUserId);
  }

  /**
   * Verificar si el usuario puede eliminar una donación
   */
  canDelete(donation: Donation, currentUserId: string): boolean {
    return this.isOwner(donation, currentUserId);
  }

  /**
   * Obtener estadísticas de la organización
   */
  getOrganizationStats(): Observable<OrganizationStats> {
    return this.getMyDonations().pipe(
      map(donations => {
        // Calcular estadísticas basadas en las donaciones del usuario
        // statusDonation null o undefined se considera como "disponible"
        const activeDonations = donations.filter(d => 
          !d.statusDonation || 
          d.statusDonation.toLowerCase() === 'disponible'
        ).length;

        return {
          activeDonations,
          totalDonations: donations.length,
          requestsReceived: 0, // Implementación futura
          unreadMessages: 0    // Implementación futura
        };
      }),
      catchError(error => {
        console.error('Error al obtener estadísticas:', error);
        // Retornar estadísticas vacías en caso de error
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtener todas las publicaciones de donaciones (feed público)
   * 🔄 USA: GET /post/all (endpoint existente en tu backend)
   */
  getAllPublicDonations(): Observable<Donation[]> {
    this.loadingSubject.next(true);
    // Limpiar datos anteriores del BehaviorSubject
    this.donationsSubject.next([]);
    
    console.log('🌐 Haciendo petición HTTP a:', `${this.apiUrl}/all`);
    console.log('🗑️ Limpiando datos de prueba anteriores...');
    
    // Forzar petición sin caché agregando timestamp
    const timestamp = new Date().getTime();
    const urlWithCacheBust = `${this.apiUrl}/all?_t=${timestamp}`;
    
    return this.http.get<any[]>(urlWithCacheBust, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    }).pipe(
      tap(rawResponse => {
        console.log('📥 Respuesta RAW del backend:', rawResponse);
        console.log('📥 Tipo de respuesta:', Array.isArray(rawResponse) ? 'Array' : typeof rawResponse);
        console.log('📥 Cantidad de posts recibidos:', Array.isArray(rawResponse) ? rawResponse.length : 0);
      }),
      map(posts => {
        // Filtrar datos de prueba/demo y usuarios no deseados
        const realPosts = Array.isArray(posts) 
          ? posts.filter(post => {
              const id = post?.id?.toString() || '';
              const userId = post?.user?.id?.toString() || '';
              const username = post?.user?.username || '';
              const email = post?.user?.email || '';
              
              // Usuarios/emails a filtrar (publicaciones que no queremos mostrar)
              const filteredUsers = [
                'jcpastuzanq22@itp.edu.co'
              ];
              
              // Nombres de organizaciones de prueba conocidas
              const demoOrganizations = [
                'Fundación Ayuda Verde',
                'Comedor Solidario',
                'Biblioteca Comunitaria',
                'contacto@ayudaverde.org',
                'info@comedorsolidario.org',
                'biblioteca@comunidad.org'
              ];
              
              // Verificar si el usuario está en la lista de filtrados
              const isFilteredUser = filteredUsers.some(filteredUser => 
                email.toLowerCase().includes(filteredUser.toLowerCase()) ||
                username.toLowerCase().includes(filteredUser.toLowerCase())
              );
              
              // Eliminar cualquier post que tenga "demo" en el ID o sea claramente de prueba
              const isDemo = id.toLowerCase().includes('demo') || 
                           userId.toLowerCase().includes('demo') ||
                           id.startsWith('demo-') ||
                           userId.startsWith('demo-') ||
                           demoOrganizations.some(demoOrg => 
                             username.includes(demoOrg) || 
                             email.includes(demoOrg) ||
                             username.toLowerCase().includes('ayuda verde') ||
                             username.toLowerCase().includes('comedor solidario') ||
                             username.toLowerCase().includes('biblioteca comunitaria')
                           );
              
              const shouldFilter = isFilteredUser || isDemo;
              
              if (shouldFilter) {
                console.warn('🚫 Filtrando publicación:', { id, username, email, reason: isFilteredUser ? 'usuario filtrado' : 'demo' });
              }
              
              return !shouldFilter;
            })
          : [];
        
        console.log('📋 Posts reales (después de filtrar demos):', realPosts.length);
        
        const mappedDonations = this.mapBackendPostsToFrontend(realPosts);
        console.log('🔄 Donaciones mapeadas:', mappedDonations);
        return mappedDonations;
      }),
      // Cargar tags para cada donación usando el endpoint de posttags
      switchMap(donations => {
        if (!donations || donations.length === 0) {
          return of(donations);
        }
        
        // Crear observables para cargar tags de cada donación
        const tagObservables = donations.map(donation => 
          this.getTagsByPostId(donation.id).pipe(
            map(tags => ({ donation, tags })),
            catchError(error => {
              console.warn(`⚠️ No se pudieron cargar tags para la donación ${donation.id}:`, error);
              return of({ donation, tags: [] });
            })
          )
        );
        
        // Cargar todos los tags en paralelo
        return forkJoin(tagObservables).pipe(
          map(results => {
            // Asignar tags a cada donación
            return results.map(({ donation, tags }) => {
              const mappedTags = Array.isArray(tags) ? tags.map((tag: any) => ({
                id: tag.id || tag.tagId,
                tag: tag.tag || tag.name || '',
                description: tag.description || ''
              })) : [];
              
              if (mappedTags.length > 0) {
                console.log(`✅ Tags cargados para donación ${donation.id}:`, mappedTags);
              }
              
              return {
                ...donation,
                tags: mappedTags
              };
            });
          })
        );
      }),
      tap(donations => {
        console.log('✅ Donaciones finales con tags para el componente:', donations);
        this.donationsSubject.next(donations);
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        console.error('❌ Error al obtener donaciones públicas:', error);
        console.error('Detalles:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error
        });
        // Limpiar en caso de error
        this.donationsSubject.next([]);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtener donaciones públicas aplicando filtros en el servidor cuando sea posible.
   * Si el servidor no soporta los filtros, hace fallback a getAllPublicDonations().
   */
  getPublicDonationsFiltered(filters: { q?: string; community?: string; tagId?: string; urgency?: string }): Observable<Donation[]> {
    const params: string[] = [];
    const q = (filters.q || '').trim();
    const community = (filters.community || '').trim();
    const tagId = (filters.tagId || '').toString().trim();
    const urgency = (filters.urgency || '').trim();

    if (q) params.push(`q=${encodeURIComponent(q)}`);
    if (community) params.push(`community=${encodeURIComponent(community)}`);
    if (tagId) params.push(`tagId=${encodeURIComponent(tagId)}`);
    if (urgency) params.push(`urgency=${encodeURIComponent(urgency)}`);

    const query = params.length > 0 ? `?${params.join('&')}` : '';
    const url = `${this.apiUrl}/all${query}`;

    // Intentar filtro en servidor; si falla, usar fallback local
    return this.http.get<any[]>(url).pipe(
      map(posts => this.mapBackendPostsToFrontend(Array.isArray(posts) ? posts : [])),
      switchMap(donations => {
        if (!donations || donations.length === 0) {
          return of(donations);
        }
        const tagObservables = donations.map(donation => 
          this.getTagsByPostId(donation.id).pipe(
            map(tags => ({ donation, tags })),
            catchError(() => of({ donation, tags: [] }))
          )
        );
        return forkJoin(tagObservables).pipe(
          map(results => results.map(({ donation, tags }) => ({
            ...donation,
            tags: Array.isArray(tags) ? tags.map((tag: any) => ({
              id: tag.id || tag.tagId,
              tag: tag.tag || tag.name || '',
              description: tag.description || ''
            })) : []
          })))
        );
      }),
      catchError(() => this.getAllPublicDonations())
    );
  }

  /**
   * Extraer datos de ubicación del mensaje si no están como campos separados
   */
  private extractLocationFromMessage(message: string): {
    comunity: string;
    lugarRecogida: string;
    lugarDonacion: string;
    fechaMaximaEntrega: string | null;
  } {
    if (!message) {
      return { comunity: '', lugarRecogida: '', lugarDonacion: '', fechaMaximaEntrega: null };
    }

    // Extraer Comunidad
    const comunityMatch = message.match(/📍\s*Comunidad:\s*([^\n]+)/);
    const comunity = comunityMatch ? comunityMatch[1].trim() : '';

    // Extraer Lugar de Recogida
    const lugarRecogidaMatch = message.match(/🏠\s*Lugar de Recogida:\s*([^\n]+)/);
    const lugarRecogida = lugarRecogidaMatch ? lugarRecogidaMatch[1].trim() : '';

    // Extraer Lugar de Donación
    const lugarDonacionMatch = message.match(/🎯\s*Lugar de Donación:\s*([^\n]+)/);
    const lugarDonacion = lugarDonacionMatch ? lugarDonacionMatch[1].trim() : '';

    // Extraer Fecha Máxima (formato: DD/MM/YYYY)
    const fechaMatch = message.match(/📅\s*Fecha Máxima:\s*([^\n]+)/);
    let fechaMaximaEntrega: string | null = null;
    if (fechaMatch) {
      const fechaStr = fechaMatch[1].trim();
      // Convertir formato DD/MM/YYYY a ISO
      const fechaParts = fechaStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (fechaParts) {
        const [, day, month, year] = fechaParts;
        const fecha = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        fechaMaximaEntrega = fecha.toISOString();
      }
    }

    return {
      comunity,
      lugarRecogida,
      lugarDonacion,
      fechaMaximaEntrega
    };
  }

  /**
   * Mapear datos del backend al formato del frontend
   */
  private mapBackendPostsToFrontend(posts: any[]): Donation[] {
    console.log('🔄 [DonationService] Mapeando posts del backend:', posts);
    return posts.map(post => {
      console.log('📋 [DonationService] Mapeando post:', {
        id: post.id,
        lugarRecogida: post.lugarRecogida,
        lugarDonacion: post.lugarDonacion,
        comunity: post.comunity,
        fechaMaximaEntrega: post.fechaMaximaEntrega,
        postCompleto: post
      });

      const message = post.message || post.description || '';
      
      // Intentar obtener campos de ubicación desde los campos separados del backend
      let comunity = post.comunity || post.community || '';
      let lugarRecogida = post.lugarRecogida || '';
      let lugarDonacion = post.lugarDonacion || '';
      let fechaMaximaEntrega = post.fechaMaximaEntrega || post.createdAt;

      // Si no están disponibles como campos separados, extraerlos del mensaje
      const extracted = this.extractLocationFromMessage(message);
      comunity = comunity || extracted.comunity;
      lugarRecogida = lugarRecogida || extracted.lugarRecogida;
      lugarDonacion = lugarDonacion || extracted.lugarDonacion;
      if (!fechaMaximaEntrega || fechaMaximaEntrega === post.createdAt) {
        fechaMaximaEntrega = extracted.fechaMaximaEntrega || fechaMaximaEntrega;
      }

      return {
      id: post.id?.toString() || post.id,
      userId: post.user?.id?.toString() || post.userId?.toString(),
      user: {
        id: post.user?.id?.toString() || '',
        username: post.user?.username || 'Usuario',
        email: post.user?.email || '',
        profilePhoto: post.user?.profilePhoto ? this.normalizeUrl(post.user?.profilePhoto) : undefined,
        verified: post.user?.verified || post.user?.emailVerified || false,
        createdAt: post.user?.createdAt || new Date().toISOString(),
        updatedAt: post.user?.updatedAt || new Date().toISOString(),
      },
      // Campo obligatorio del backend
      message: message,
      title: post.title || '',
      // Mapear campos del backend al frontend (usando valores extraídos)
      comunity: comunity,
      lugarRecogida: lugarRecogida,
      lugarDonacion: lugarDonacion,
      fechaMaximaEntrega: fechaMaximaEntrega,
      description: post.message || post.description || '',
      articles: post.articles || [],
      comments: post.comments || [],
      // Mapear imágenes
      files: (post.imagePost || post.images || []).map((img: any) => {
        const rawUrl = img.url || img.path || img.ruta || img.imageUrl || img.location || img.fileUrl;
        const normalizedUrl = this.normalizeUrl(rawUrl);
        return {
          id: img.id?.toString(),
          name: img.name || (rawUrl ? String(rawUrl).split('/').pop() : 'image') || 'image',
          url: normalizedUrl,
          type: this.getFileTypeFromUrl(String(rawUrl || '')) as 'image' | 'pdf' | 'video',
          size: img.size || 0,
          uploadedAt: img.uploadedAt || img.createdAt
        };
      }),
      // Mapear likes
      likes: post.likes || [],
      likesCount: post.likesCount || 0,
      // 🔄 IMPORTANTE: isLikedByCurrentUser debe venir del backend
      // Si el backend no lo envía, verificar desde el array de likes si el usuario actual dio like
      isLikedByCurrentUser: (() => {
        if (post.isLikedByCurrentUser !== undefined) {
          return post.isLikedByCurrentUser;
        }
        // Si no viene del backend, verificar en el array de likes
        // Nota: Esto requiere que el backend incluya información del usuario actual en los likes
        if (post.likes && Array.isArray(post.likes) && post.likes.length > 0) {
          // El backend debería devolver isLikedByCurrentUser, pero como fallback:
          // si hay likes, asumimos que podría estar liked (aunque no es preciso)
          return false; // Mejor ser conservador y no asumir que está liked
        }
        return false;
      })(),
      // Mapear tipo de donación
      donationType: post.donationType || post.typePost ? {
        id: (post.donationType?.id || post.typePost?.id)?.toString(),
        name: post.donationType?.name || post.typePost?.type || 'Otros',
        description: post.donationType?.description || post.typePost?.type
      } : undefined,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      donationTypeId: post.donationTypeId || post.typePostId?.toString()
    };
    });
  }

  /**
   * Detectar tipo de archivo por URL
   */
  private getFileTypeFromUrl(url: string): string {
    if (!url) return 'image';
    const ext = url.split('.').pop()?.toLowerCase() || '';
    if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) return 'video';
    if (['pdf'].includes(ext)) return 'pdf';
    return 'image';
  }

  /**
   * Normaliza URLs relativas del backend a absolutas usando environment.apiBackendUrl
   */
  private normalizeUrl(url: string | undefined): string {
    if (!url) return '' as any;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const base = environment.apiBackendUrl.replace(/\/$/, '');
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${base}${path}`;
  }

  /**
   * Crear donación con archivos
   * 🔄 ADAPTADO: Usa el formato del backend (/post/create con FormData)
   */
  createDonationWithFiles(donationData: CreateDonationDTO, files: File[]): Observable<Donation> {
    this.loadingSubject.next(true);
    
    const formData = new FormData();
    
    // 🔄 Preparar mensaje que incluya toda la información
    const fullMessage = this.buildFullMessage(donationData);
    
    // Agregar campos individuales que el backend espera
    if (donationData.title) {
      formData.append('title', donationData.title);
    }
    formData.append('message', fullMessage);
    formData.append('typePost', '1'); // Tipo de post: 1 = Donación, 2 = Solicitud
    
    // Agregar campos de ubicación al FormData
    if (donationData.lugarRecogida) {
      formData.append('lugarRecogida', donationData.lugarRecogida);
    }
    if (donationData.lugarDonacion) {
      formData.append('lugarDonacion', donationData.lugarDonacion);
    }
    if (donationData.comunity) {
      formData.append('comunity', donationData.comunity);
    }
    if (donationData.fechaMaximaEntrega) {
      formData.append('fechaMaximaEntrega', donationData.fechaMaximaEntrega);
    }
    if (donationData.articles && donationData.articles.length > 0) {
      formData.append('articles', JSON.stringify(donationData.articles));
    }
    if (donationData.comments && donationData.comments.length > 0) {
      formData.append('comments', JSON.stringify(donationData.comments));
    }
    
    // 🔄 Obtener typePostId de forma segura
    let typePostIdValue: number | undefined = undefined;
    
    if (donationData.typePostId) {
      typePostIdValue = typeof donationData.typePostId === 'number' 
        ? donationData.typePostId 
        : parseInt(String(donationData.typePostId));
    } else if (donationData.donationTypeId) {
      const parsed = typeof donationData.donationTypeId === 'string' 
        ? parseInt(donationData.donationTypeId)
        : (typeof donationData.donationTypeId === 'number' ? donationData.donationTypeId : undefined);
      
      if (parsed !== undefined && !isNaN(parsed) && parsed > 0 && typeof parsed === 'number') {
        typePostIdValue = parsed;
      }
    }
    
    // ⚠️ IMPORTANTE: Solo agregar typePostId al FormData si es un número válido
    // typePostId = ID del Tag obtenido desde /tags (TagsController)
    // NO enviar undefined, null, 0, NaN, o strings vacíos
    if (typePostIdValue !== undefined && !isNaN(typePostIdValue) && typePostIdValue > 0) {
      formData.append('typePostId', String(typePostIdValue));
      console.log('✅ [DonationService] typePostId (Tag ID) agregado a FormData:', typePostIdValue);
      console.log('  Verificación:', formData.get('typePostId')); // Debe mostrar el valor
    } else {
      console.warn('⚠️ [DonationService] typePostId no válido o no seleccionado. NO se agregará al FormData.');
      console.warn('  donationData.typePostId:', donationData.typePostId);
      console.warn('  donationData.donationTypeId:', donationData.donationTypeId);
      console.warn('  typePostIdValue calculado:', typePostIdValue);
      // NO agregar typePostId al FormData si no es válido
    }
    
    // Agregar archivos
    files.forEach((file) => {
      formData.append('files', file, file.name);
    });

    return this.http.post<any>(`${this.apiUrl}/create`, formData).pipe(
      tap(response => {
        console.log('✅ [DonationService] Respuesta del backend (con archivos):', response);
        console.log('📍 [DonationService] Campos de ubicación en la respuesta:', {
          lugarRecogida: response.lugarRecogida,
          lugarDonacion: response.lugarDonacion,
          comunity: response.comunity,
          fechaMaximaEntrega: response.fechaMaximaEntrega,
          responseCompleto: response
        });
      }),
      map(response => this.mapBackendPostsToFrontend([response])[0]),
      tap(newDonation => {
        console.log('🔄 [DonationService] Donación mapeada:', {
          lugarRecogida: newDonation.lugarRecogida,
          lugarDonacion: newDonation.lugarDonacion,
          comunity: newDonation.comunity
        });
        const currentDonations = this.donationsSubject.value;
        this.donationsSubject.next([newDonation, ...currentDonations]);
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        console.error('Error al crear donación con archivos:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Construir mensaje completo con toda la información estructurada
   */
  private buildFullMessage(data: CreateDonationDTO): string {
    let message = data.message || data.description || '';
    
    // Agregar información estructurada al mensaje
    const details: string[] = [];
    
    if (data.comunity) {
      details.push(`📍 Comunidad: ${data.comunity}`);
    }
    if (data.lugarRecogida) {
      details.push(`🏠 Lugar de Recogida: ${data.lugarRecogida}`);
    }
    if (data.lugarDonacion) {
      details.push(`🎯 Lugar de Donación: ${data.lugarDonacion}`);
    }
    if (data.fechaMaximaEntrega) {
      const fecha = new Date(data.fechaMaximaEntrega).toLocaleDateString('es-ES');
      details.push(`📅 Fecha Máxima: ${fecha}`);
    }
    
    // Agregar artículos
    if (data.articles && data.articles.length > 0) {
      details.push(`\n📦 Artículos necesarios:`);
      data.articles.forEach(article => {
        details.push(`  • ${article.name}: ${article.quantity}`);
      });
    }
    
    // Agregar comentarios
    if (data.comments && data.comments.length > 0) {
      details.push(`\n💬 Información adicional:`);
      data.comments.forEach(comment => {
        details.push(`  • ${comment.text}`);
      });
    }
    
    if (details.length > 0) {
      message += '\n\n' + details.join('\n');
    }
    
    return message;
  }

  /**
   * Verificar si un like está en proceso
   */
  isLikeInProgress(donationId: string): boolean {
    return this.likesInProgress.has(donationId);
  }

  /**
   * Hacer merge de una donación actualizada preservando los datos existentes
   * Solo actualiza los campos relacionados con likes para evitar perder información
   */
  private mergeDonationUpdate(existingDonation: Donation, updatedDonation: Donation): Donation {
    // Preservar todos los datos existentes y solo actualizar campos de likes
    // Si el backend devuelve valores explícitos para likes, usarlos (son la fuente de verdad)
    return {
      ...existingDonation,
      // Actualizar campos relacionados con likes: usar valores del backend si existen
      likes: updatedDonation.likes !== undefined ? updatedDonation.likes : existingDonation.likes,
      likesCount: updatedDonation.likesCount !== undefined ? updatedDonation.likesCount : existingDonation.likesCount ?? 0,
      // Para isLikedByCurrentUser, el backend siempre debe devolver el valor correcto
      isLikedByCurrentUser: updatedDonation.isLikedByCurrentUser !== undefined 
        ? updatedDonation.isLikedByCurrentUser 
        : existingDonation.isLikedByCurrentUser ?? false,
      // Actualizar también updatedAt para reflejar cambios
      updatedAt: updatedDonation.updatedAt || existingDonation.updatedAt
    };
  }

  /**
   * Dar like a una donación
   * 🔄 USA: POST /postliked/addlike/:postId
   */
  likeDonation(donationId: string): Observable<any> {
    const postId = parseInt(donationId);
    if (isNaN(postId)) {
      return throwError(() => new Error('ID de donación inválido'));
    }

    // Prevenir múltiples clics simultáneos
    if (this.likesInProgress.has(donationId)) {
      console.warn('⚠️ Like ya en proceso para donación:', donationId);
      return of({ success: false, message: 'Like ya en proceso' });
    }

    // Buscar la donación en el estado actual (solo para obtener el índice)
    const currentDonations = this.donationsSubject.value;
    const donationIndex = currentDonations.findIndex(d => d.id === donationId);
    
    // NOTA: No validamos aquí si ya le dio like porque el backend es la fuente de verdad
    // Si ya le dio like, el backend lo rechazará con un error 400 que manejamos después

    // Marcar como en proceso
    this.likesInProgress.add(donationId);

    // Actualización optimista: actualizar el estado local inmediatamente
    let previousState: { isLiked: boolean; likesCount: number } | null = null;
    
    if (donationIndex !== -1) {
      previousState = {
        isLiked: currentDonations[donationIndex].isLikedByCurrentUser || false,
        likesCount: currentDonations[donationIndex].likesCount || 0
      };
      const updatedDonation = { ...currentDonations[donationIndex] };
      // Marcar como liked (estado 1) y aumentar contador
      updatedDonation.isLikedByCurrentUser = true;
      updatedDonation.likesCount = (updatedDonation.likesCount || 0) + 1;
      currentDonations[donationIndex] = updatedDonation;
      this.donationsSubject.next([...currentDonations]);
    }

    console.log('🔄 [DonationService] Enviando like al post:', {
      postId,
      donationId,
      url: `${environment.apiBackendUrl}/postliked/addlike/${postId}`
    });

    return this.http.post<any>(`${environment.apiBackendUrl}/postliked/addlike/${postId}`, {}).pipe(
      tap((response) => {
        console.log('✅ Like agregado exitosamente:', response);
        // Limpiar estado de proceso
        this.likesInProgress.delete(donationId);
        // Recargar los datos del servidor para asegurar sincronización
        this.getDonationById(donationId).subscribe(updatedDonation => {
          const currentDonations = this.donationsSubject.value;
          const index = currentDonations.findIndex(d => d.id === donationId);
          if (index !== -1) {
            // Hacer merge preservando los datos existentes
            const existingDonation = currentDonations[index];
            currentDonations[index] = this.mergeDonationUpdate(existingDonation, updatedDonation);
            this.donationsSubject.next([...currentDonations]);
            console.log('✅ Donación actualizada preservando todos los datos');
          } else {
            // Si no existe en el estado local, agregarla directamente
            this.donationsSubject.next([...currentDonations, updatedDonation]);
          }
        });
      }),
      catchError(error => {
        // Limpiar estado de proceso incluso en caso de error
        this.likesInProgress.delete(donationId);
        
        console.error('❌ Error al dar like:', error);
        console.error('📋 Detalles del error:', {
          status: error.status,
          statusText: error.statusText,
          url: error.url,
          errorBody: error.error,
          message: error.error?.message || error.message
        });

        // Si el error es 400, podría ser que el usuario ya le dio like
        if (error.status === 400) {
          const errorMessage = (error.error?.message || '').toLowerCase();
          console.warn('⚠️ El backend rechazó la petición (400). Posibles causas:');
          console.warn('  - El usuario ya le dio like a este post');
          console.warn('  - El post no existe');
          console.warn('  - Error en la validación del backend');
          console.warn('  - Mensaje del backend:', error.error?.message);
          
          // Si el mensaje indica que el usuario ya le dio like, sincronizar el estado
          if (errorMessage.includes('ya le ha dado like') || 
              errorMessage.includes('already') || 
              errorMessage.includes('duplicate') ||
              errorMessage.includes('existe')) {
            console.warn('✅ Detectado: El usuario ya le dio like. Sincronizando estado local...');
            
            // Actualizar el estado local para reflejar que el usuario ya le dio like
            if (donationIndex !== -1) {
              const currentDonations = this.donationsSubject.value;
              const donation = currentDonations[donationIndex];
              
              // Si el estado local decía que NO le había dado like, pero el backend dice que SÍ,
              // actualizar el estado local y obtener los datos correctos del servidor
              if (!donation.isLikedByCurrentUser) {
                console.warn('🔄 Sincronizando: El backend dice que SÍ le dio like, actualizando estado...');
                // Recargar los datos del servidor para sincronizar
                this.getDonationById(donationId).subscribe(updatedDonation => {
                  const currentDonations = this.donationsSubject.value;
                  const index = currentDonations.findIndex(d => d.id === donationId);
                  if (index !== -1) {
                    // Hacer merge preservando los datos existentes
                    const existingDonation = currentDonations[index];
                    currentDonations[index] = this.mergeDonationUpdate(existingDonation, updatedDonation);
                    this.donationsSubject.next([...currentDonations]);
                    console.log('✅ Estado sincronizado correctamente preservando datos');
                  }
                });
                
                // Retornar un Observable que no lance error (para que la UI no muestre error)
                return of({ success: true, message: 'Estado sincronizado' });
              }
            }
          }
        }

        // CRÍTICO: Revertir la actualización optimista y sincronizar con el backend
        // Esto asegura que el contador siempre refleje el estado real
        if (donationIndex !== -1 && previousState) {
          const currentDonations = this.donationsSubject.value;
          const revertedDonation = { ...currentDonations[donationIndex] };
          revertedDonation.isLikedByCurrentUser = previousState.isLiked;
          revertedDonation.likesCount = previousState.likesCount;
          currentDonations[donationIndex] = revertedDonation;
          this.donationsSubject.next([...currentDonations]);
          console.log('🔄 Estado optimista revertido (like):', {
            likesCount: previousState.likesCount,
            isLiked: previousState.isLiked
          });
        }
        
        // SIEMPRE recargar desde el backend después de un error para sincronizar
        // Esto garantiza que el contador refleje el estado real del servidor
        console.log('🔄 Sincronizando con backend después de error en like...');
        this.getDonationById(donationId).subscribe({
          next: (serverDonation) => {
            const currentDonations = this.donationsSubject.value;
            const index = currentDonations.findIndex(d => d.id === donationId);
            if (index !== -1) {
              const existingDonation = currentDonations[index];
              // Usar el estado del servidor como fuente de verdad
              currentDonations[index] = this.mergeDonationUpdate(existingDonation, serverDonation);
              this.donationsSubject.next([...currentDonations]);
              console.log('✅ Estado sincronizado desde servidor (like):', {
                likesCount: serverDonation.likesCount,
                isLikedByCurrentUser: serverDonation.isLikedByCurrentUser
              });
            }
          },
          error: (syncError) => {
            console.error('❌ Error al sincronizar con servidor:', syncError);
          }
        });
        
        return throwError(() => error);
      })
    );
  }

  /**
   * Quitar like de una donación
   * 🔄 USA: DELETE /postliked/removelike/:postId
   */
  unlikeDonation(donationId: string): Observable<any> {
    const postId = parseInt(donationId);
    if (isNaN(postId)) {
      return throwError(() => new Error('ID de donación inválido'));
    }

    // Prevenir múltiples clics simultáneos
    if (this.likesInProgress.has(donationId)) {
      console.warn('⚠️ Unlike ya en proceso para donación:', donationId);
      return of({ success: false, message: 'Unlike ya en proceso' });
    }

    // Marcar como en proceso
    this.likesInProgress.add(donationId);

    // Actualización optimista: actualizar el estado local inmediatamente
    const currentDonations = this.donationsSubject.value;
    const donationIndex = currentDonations.findIndex(d => d.id === donationId);
    let previousState: { isLiked: boolean; likesCount: number } | null = null;
    
    if (donationIndex !== -1) {
      previousState = {
        isLiked: currentDonations[donationIndex].isLikedByCurrentUser || false,
        likesCount: currentDonations[donationIndex].likesCount || 0
      };
      const updatedDonation = { ...currentDonations[donationIndex] };
      updatedDonation.isLikedByCurrentUser = false;
      updatedDonation.likesCount = Math.max((updatedDonation.likesCount || 0) - 1, 0);
      currentDonations[donationIndex] = updatedDonation;
      this.donationsSubject.next([...currentDonations]);
    }

    console.log('🔄 [DonationService] Quitando like del post:', {
      postId,
      donationId,
      url: `${environment.apiBackendUrl}/postliked/removelike/${postId}`
    });

    return this.http.delete<any>(`${environment.apiBackendUrl}/postliked/removelike/${postId}`).pipe(
      tap((response) => {
        console.log('✅ Like eliminado exitosamente:', response);
        // Limpiar estado de proceso
        this.likesInProgress.delete(donationId);
        // Recargar los datos del servidor para asegurar sincronización
        this.getDonationById(donationId).subscribe(updatedDonation => {
          const currentDonations = this.donationsSubject.value;
          const index = currentDonations.findIndex(d => d.id === donationId);
          if (index !== -1) {
            // Hacer merge preservando los datos existentes
            const existingDonation = currentDonations[index];
            currentDonations[index] = this.mergeDonationUpdate(existingDonation, updatedDonation);
            this.donationsSubject.next([...currentDonations]);
            console.log('✅ Donación actualizada preservando todos los datos');
          } else {
            // Si no existe en el estado local, agregarla directamente
            this.donationsSubject.next([...currentDonations, updatedDonation]);
          }
        });
      }),
      catchError(error => {
        // Limpiar estado de proceso incluso en caso de error
        this.likesInProgress.delete(donationId);
        
        console.error('❌ Error al quitar like:', error);
        console.error('📋 Detalles del error:', {
          status: error.status,
          statusText: error.statusText,
          url: error.url,
          errorBody: error.error,
          message: error.error?.message || error.message
        });

        // CRÍTICO: Revertir la actualización optimista y sincronizar con el backend
        // Esto asegura que el contador siempre refleje el estado real
        if (donationIndex !== -1 && previousState) {
          const currentDonations = this.donationsSubject.value;
          const revertedDonation = { ...currentDonations[donationIndex] };
          revertedDonation.isLikedByCurrentUser = previousState.isLiked;
          revertedDonation.likesCount = previousState.likesCount;
          currentDonations[donationIndex] = revertedDonation;
          this.donationsSubject.next([...currentDonations]);
          console.log('🔄 Estado optimista revertido (unlike):', {
            likesCount: previousState.likesCount,
            isLiked: previousState.isLiked
          });
        }
        
        // SIEMPRE recargar desde el backend después de un error para sincronizar
        // Esto garantiza que el contador refleje el estado real del servidor
        console.log('🔄 Sincronizando con backend después de error en unlike...');
        this.getDonationById(donationId).subscribe({
          next: (serverDonation) => {
            const currentDonations = this.donationsSubject.value;
            const index = currentDonations.findIndex(d => d.id === donationId);
            if (index !== -1) {
              const existingDonation = currentDonations[index];
              // Usar el estado del servidor como fuente de verdad
              currentDonations[index] = this.mergeDonationUpdate(existingDonation, serverDonation);
              this.donationsSubject.next([...currentDonations]);
              console.log('✅ Estado sincronizado desde servidor (unlike):', {
                likesCount: serverDonation.likesCount,
                isLikedByCurrentUser: serverDonation.isLikedByCurrentUser
              });
            }
          },
          error: (syncError) => {
            console.error('❌ Error al sincronizar con servidor:', syncError);
          }
        });
        
        return throwError(() => error);
      })
    );
  }

  /**
   * Toggle like en una donación
   * @param donationId ID de la donación
   * @param isCurrentlyLiked true si el usuario YA le dio like (quitar), false si NO le ha dado like (agregar)
   */
  toggleLike(donationId: string, isCurrentlyLiked: boolean): Observable<any> {
    // Prevenir múltiples clics simultáneos
    if (this.likesInProgress.has(donationId)) {
      console.warn('⚠️ Like toggle ya en proceso para donación:', donationId);
      return of({ success: false, message: 'Like ya en proceso' });
    }

    console.log('🔄 [DonationService] Toggle like:', {
      donationId,
      isCurrentlyLiked,
      action: isCurrentlyLiked ? 'QUITAR like' : 'AGREGAR like'
    });
    
    // Lógica simple: si isCurrentlyLiked es true, quitar like; si es false, agregar like
    // El backend será la fuente de verdad y manejará cualquier conflicto
    return isCurrentlyLiked ? this.unlikeDonation(donationId) : this.likeDonation(donationId);
  }

  /**
   * Obtener usuarios que dieron like a un post
   * 🔄 USA: GET /postliked/userslike/:postId
   */
  getUsersWhoLikedPost(donationId: string): Observable<any[]> {
    const postId = parseInt(donationId);
    if (isNaN(postId)) {
      return throwError(() => new Error('ID de donación inválido'));
    }

    return this.http.get<any[]>(`${environment.apiBackendUrl}/postliked/userslike/${postId}`).pipe(
      catchError(error => {
        console.error('Error al obtener usuarios que dieron like:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtener posts (donaciones) por tagId
   * 🔄 USA: GET /posttags/:tagId/posts
   */
  getDonationsByTagId(tagId: string | number): Observable<Donation[]> {
    const tagIdNum = typeof tagId === 'string' ? parseInt(tagId) : tagId;
    if (isNaN(tagIdNum)) {
      return throwError(() => new Error('ID de tag inválido'));
    }

    return this.http.get<any[]>(`${environment.apiBackendUrl}/posttags/${tagIdNum}/posts`).pipe(
      map(posts => this.mapBackendPostsToFrontend(posts)),
      catchError(error => {
        console.error('Error al obtener donaciones por tag:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtener tags asociados a un post
   * 🔄 USA: GET /posttags/post/:postId/tags
   */
  getTagsByPostId(donationId: string): Observable<any[]> {
    const postId = parseInt(donationId);
    if (isNaN(postId)) {
      return throwError(() => new Error('ID de donación inválido'));
    }

    return this.http.get<any[]>(`${environment.apiBackendUrl}/posttags/post/${postId}/tags`).pipe(
      tap(tags => {
        console.log('✅ Tags obtenidos para el post:', tags);
      }),
      catchError(error => {
        console.error('Error al obtener tags del post:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Subir archivos a una donación existente
   */
  uploadFiles(donationId: string, files: File[]): Observable<DonationFile[]> {
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append('files', file, file.name);
    });

    return this.http.post<DonationFile[]>(`${this.apiUrl}/${donationId}/files`, formData).pipe(
      catchError(error => {
        console.error('Error al subir archivos:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Eliminar un archivo de una donación
   */
  deleteFile(donationId: string, fileId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${donationId}/files/${fileId}`).pipe(
      catchError(error => {
        console.error('Error al eliminar archivo:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Validar archivo antes de subirlo
   */
  validateFile(file: File): { valid: boolean; error?: string } {
    const maxImageSize = 1 * 1024 * 1024; // 1MB
    const maxVideoSize = 10 * 1024 * 1024; // 10MB
    const maxPdfSize = 1 * 1024 * 1024; // 1MB

    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const videoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    const pdfTypes = ['application/pdf'];

    if (imageTypes.includes(file.type)) {
      if (file.size > maxImageSize) {
        return { valid: false, error: `La imagen ${file.name} excede el tamaño máximo de 1MB` };
      }
    } else if (videoTypes.includes(file.type)) {
      if (file.size > maxVideoSize) {
        return { valid: false, error: `El video ${file.name} excede el tamaño máximo de 10MB` };
      }
    } else if (pdfTypes.includes(file.type)) {
      if (file.size > maxPdfSize) {
        return { valid: false, error: `El PDF ${file.name} excede el tamaño máximo de 1MB` };
      }
    } else {
      return { valid: false, error: `El archivo ${file.name} tiene un formato no permitido. Solo se permiten imágenes, videos y PDFs.` };
    }

    return { valid: true };
  }

  /**
   * Validar múltiples archivos
   */
  validateFiles(files: File[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (files.length > 5) {
      errors.push('Solo se permiten un máximo de 5 archivos');
    }

    files.forEach(file => {
      const validation = this.validateFile(file);
      if (!validation.valid && validation.error) {
        errors.push(validation.error);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
