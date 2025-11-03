import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
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
  typePostId?: number; // ID del tipo de post (tags en el backend)
  
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
  articles?: Article[];
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

  constructor(private http: HttpClient) {}

  /**
   * Crear una nueva donación (sin archivos)
   * 🔄 ADAPTADO: Usa el formato del backend
   */
  createDonation(donationData: CreateDonationDTO): Observable<Donation> {
    this.loadingSubject.next(true);
    
    // Preparar datos en formato que el backend espera
    const backendData: any = {
      message: this.buildFullMessage(donationData)
    };
    
    if (donationData.title) {
      backendData.title = donationData.title;
    }
    
    if (donationData.typePostId) {
      backendData.typePostId = donationData.typePostId;
    } else if (donationData.donationTypeId) {
      backendData.typePostId = parseInt(donationData.donationTypeId);
    }
    
    return this.http.post<any>(`${this.apiUrl}/create`, backendData).pipe(
      map(response => this.mapBackendPostsToFrontend([response])[0]),
      tap(newDonation => {
        // Agregar la nueva donación al estado local
        const currentDonations = this.donationsSubject.value;
        this.donationsSubject.next([newDonation, ...currentDonations]);
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        console.error('Error al crear donación:', error);
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
    return this.http.get<Donation[]>(`${this.apiUrl}/me/posts`).pipe(
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
   * Obtener una donación por ID
   * 🔄 USA: GET /post/:id
   */
  getDonationById(id: string): Observable<Donation> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(post => this.mapBackendPostsToFrontend([post])[0]),
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
        // Filtrar datos de prueba/demo
        const realPosts = Array.isArray(posts) 
          ? posts.filter(post => {
              const id = post?.id?.toString() || '';
              const userId = post?.user?.id?.toString() || '';
              const username = post?.user?.username || '';
              const email = post?.user?.email || '';
              
              // Nombres de organizaciones de prueba conocidas
              const demoOrganizations = [
                'Fundación Ayuda Verde',
                'Comedor Solidario',
                'Biblioteca Comunitaria',
                'contacto@ayudaverde.org',
                'info@comedorsolidario.org',
                'biblioteca@comunidad.org'
              ];
              
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
              
              if (isDemo) {
                console.warn('🚫 Ignorando post de prueba:', { id, username, email });
              }
              return !isDemo;
            })
          : [];
        
        console.log('📋 Posts reales (después de filtrar demos):', realPosts.length);
        
        const mappedDonations = this.mapBackendPostsToFrontend(realPosts);
        console.log('🔄 Donaciones mapeadas:', mappedDonations);
        return mappedDonations;
      }),
      tap(donations => {
        console.log('✅ Donaciones finales para el componente:', donations);
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
   * Mapear datos del backend al formato del frontend
   */
  private mapBackendPostsToFrontend(posts: any[]): Donation[] {
    return posts.map(post => ({
      id: post.id?.toString() || post.id,
      userId: post.user?.id?.toString() || post.userId?.toString(),
      user: {
        id: post.user?.id?.toString() || '',
        username: post.user?.username || 'Usuario',
        email: post.user?.email || '',
        profilePhoto: post.user?.profilePhoto || null,
        verified: post.user?.verified || post.user?.emailVerified || false,
        createdAt: post.user?.createdAt || new Date().toISOString(),
        updatedAt: post.user?.updatedAt || new Date().toISOString(),
      },
      // Campo obligatorio del backend
      message: post.message || post.description || '',
      title: post.title || '',
      // Mapear campos del backend al frontend
      comunity: post.comunity || 'Comunidad',
      lugarRecogida: post.lugarRecogida || 'Por definir',
      lugarDonacion: post.lugarDonacion || 'Por definir',
      fechaMaximaEntrega: post.fechaMaximaEntrega || post.createdAt,
      description: post.message || post.description || '',
      articles: post.articles || [],
      comments: post.comments || [],
      // Mapear imágenes
      files: (post.imagePost || post.images || []).map((img: any) => ({
        id: img.id?.toString(),
        name: img.name || img.url?.split('/').pop() || 'image',
        url: img.url,
        type: this.getFileTypeFromUrl(img.url) as 'image' | 'pdf' | 'video',
        size: img.size || 0,
        uploadedAt: img.uploadedAt || img.createdAt
      })),
      // Mapear likes
      likes: post.likes || [],
      likesCount: post.likesCount || 0,
      isLikedByCurrentUser: post.isLikedByCurrentUser || false,
      // Mapear tipo de donación
      donationType: post.donationType || post.typePost ? {
        id: (post.donationType?.id || post.typePost?.id)?.toString(),
        name: post.donationType?.name || post.typePost?.type || 'Otros',
        description: post.donationType?.description || post.typePost?.type
      } : undefined,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      donationTypeId: post.donationTypeId || post.typePostId?.toString()
    }));
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
    
    if (donationData.typePostId) {
      formData.append('typePostId', donationData.typePostId.toString());
    } else if (donationData.donationTypeId) {
      formData.append('typePostId', donationData.donationTypeId);
    }
    
    // Agregar archivos
    files.forEach((file) => {
      formData.append('files', file, file.name);
    });

    return this.http.post<any>(`${this.apiUrl}/create`, formData).pipe(
      map(response => this.mapBackendPostsToFrontend([response])[0]),
      tap(newDonation => {
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
   * Dar like a una donación
   * 🔄 NUEVO ENDPOINT: POST /post/:id/like (necesitas agregarlo al backend)
   */
  likeDonation(donationId: string): Observable<Donation> {
    return this.http.post<Donation>(`${this.apiUrl}/${donationId}/like`, {}).pipe(
      tap(updatedDonation => {
        // Actualizar en el estado local
        const currentDonations = this.donationsSubject.value;
        const index = currentDonations.findIndex(d => d.id === donationId);
        if (index !== -1) {
          currentDonations[index] = updatedDonation;
          this.donationsSubject.next([...currentDonations]);
        }
      }),
      catchError(error => {
        console.error('Error al dar like:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Quitar like de una donación
   * 🔄 NUEVO ENDPOINT: DELETE /post/:id/like (necesitas agregarlo al backend)
   */
  unlikeDonation(donationId: string): Observable<Donation> {
    return this.http.delete<Donation>(`${this.apiUrl}/${donationId}/like`).pipe(
      tap(updatedDonation => {
        // Actualizar en el estado local
        const currentDonations = this.donationsSubject.value;
        const index = currentDonations.findIndex(d => d.id === donationId);
        if (index !== -1) {
          currentDonations[index] = updatedDonation;
          this.donationsSubject.next([...currentDonations]);
        }
      }),
      catchError(error => {
        console.error('Error al quitar like:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Toggle like en una donación
   */
  toggleLike(donationId: string, isLiked: boolean): Observable<Donation> {
    return isLiked ? this.unlikeDonation(donationId) : this.likeDonation(donationId);
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
