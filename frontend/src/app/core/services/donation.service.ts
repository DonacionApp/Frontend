import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, forkJoin, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ChatService } from './chat.service';

// Interfaces para donaciones

// Interface para artículo en el formulario de creación
export interface ArticleInput {
  articlePostId: number;
  quantity: number;
}

// Interface para artículo en la respuesta del backend
export interface ArticleDetail {
  id: number;
  name: string;
  descripcion: string;
}

export interface DonationArticle {
  id: number;
  quantity: string;
  postArticleId?: number; // Opcional, puede venir en algunas respuestas
  article: ArticleDetail;
}

// Interface para comentarios
export interface Comment {
  message: string;
}

// Interface para el post asociado a la donación
export interface DonationPost {
  id: number;
  title: string;
  message: string;
  createdAt?: string;
  updatedAt?: string;
}

// Interface para review (valoración / comentario) asociado a una donación
export interface Review {
  id: number;
  review: string;
  raiting: number;
  // backend may return a minimal user object (only id) so allow partial
  user?: Partial<DonationUser>;
  createdAt?: string;
}

// Interface para usuario (creador, beneficiario o donador)
export interface DonationUser {
  id: number;
  username: string;
  email: string;
  profilePhoto?: string;
  emailVerified?: boolean;
  verified: boolean;
  createdAt: string;
}

// Interface para el estado de la donación
export interface StatusDonation {
  id: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

// Interface para actualizar el estado de una donación
export interface UpdateDonationStatusDTO {
  status: number;
}

// Interfaces extendidas para la respuesta de donaciones por usuario
export interface PostArticle {
  id: number;
  quantity: string;
  postArticleId: number;
  article: ArticleDetail;
}

export interface PostInfo {
  id: number;
  title: string;
  message: string;
}

export interface UserBasicInfo {
  id: number;
  username: string;
  email: string;
  profilePhoto: string;
  emailVerified: boolean;
  verified: boolean;
  createdAt: string;
}

export interface DonationByUser {
  id: number;
  lugarRecogida: string;
  lugarDonacion: string;
  comments: any; // Puede ser objeto o array
  fechaMaximaEntrega: string;
  post: PostInfo;
  statusDonation: StatusDonation;
  createdAt: string;
  updatedAt: string;
  beneficiary: UserBasicInfo;
  donator: UserBasicInfo;
  owner: boolean;
  articles: PostArticle[];
}

// DTO para crear una donación (lo que se envía al backend)
export interface CreateDonationDTO {
  postId: number;
  lugarRecogida: string;
  lugarDonacion: string;
  articles: ArticleInput[];
  comments: Comment[];
  fechaMaximaEntrega: string; // ISO 8601 format (ej: "2026-11-10T18:00:00.000Z")
  statusDonation?: number; // Estado de la donación (opcional, por defecto 1)
}

// DTO para actualizar una donación (campos opcionales)
export interface UpdateDonationDTO {
  lugarRecogida?: string;
  lugarDonacion?: string;
  fechaMaximaEntrega?: string;
  // No se pueden actualizar articles ni comments según el endpoint
}

// Interface completa para una donación (respuesta del backend)
export interface Donation {
  id: number;
  lugarRecogida: string;
  lugarDonacion: string;
  comments: Comment[] | Record<string, any>; // Puede ser array o objeto
  fechaMaximaEntrega: string;
  post: DonationPost;
  statusDonation: StatusDonation;
  createdAt: string;
  updatedAt: string;
  user?: DonationUser; // Usuario creador (en detalle)
  beneficiary?: DonationUser; // Beneficiario (organización)
  donator?: DonationUser; // Donador
  owner?: boolean; // Indica si el usuario actual es el dueño
  articles: DonationArticle[];
  // Reviews/valoraciones asociadas a la donación (opcional)
  reviews?: Review[];
  // Nuevo campo: chat asociado a la donación (puede venir vacío/null)
  chat?: {
    id: number;
    name?: string;
    donationId?: number;
    createdAt?: string;
    updatedAt?: string;
    participants?: Array<{ id: number; donator?: boolean; user?: Partial<DonationUser> }>;
  } | null;
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
  // El endpoint es /donation/create sin el prefijo /api
  private apiUrl = `${environment.apiBackendUrl}/donation`;

  // Estado de las donaciones
  private donationsSubject = new BehaviorSubject<Donation[]>([]);

  constructor(private http: HttpClient, private chatService: ChatService) {}
  public donations$ = this.donationsSubject.asObservable();

  // Estado de carga
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  /**
   * Normalizar respuestas que pueden venir como array, wrapper o objeto numerado
   */
  private normalizeGenericArray<T = any>(payload: any): T[] {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload as T[];
    if (payload.data && Array.isArray(payload.data)) return payload.data as T[];
    if (payload.items && Array.isArray(payload.items)) return payload.items as T[];
    if (payload.results && Array.isArray(payload.results)) return payload.results as T[];

    if (typeof payload === 'object' && payload !== null) {
      const numericKeys = Object.keys(payload).filter(k => /^\d+$/.test(k));
      if (numericKeys.length > 0) {
        const ordered = numericKeys
          .map(k => parseInt(k, 10))
          .sort((a, b) => a - b)
          .map(idx => (payload as any)[String(idx)]);
        return ordered.filter(Boolean) as T[];
      }

      // Single object -> wrap
      return [payload] as T[];
    }

    return [];
  }

  /**
   * Crear una nueva donación
   */
  createDonation(donationData: CreateDonationDTO): Observable<Donation> {
    this.loadingSubject.next(true);
    // Agregar statusDonation: 1 por defecto si no está presente
    const dataToSend = {
      ...donationData,
      statusDonation: donationData.statusDonation ?? 1
    };
    return this.http.post<Donation>(`${this.apiUrl}/create`, dataToSend).pipe(
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
   */
  getMyDonations(): Observable<Donation[]> {
    this.loadingSubject.next(true);
    // Siempre forzar datos frescos para donaciones propias (no cachear)
    const headers = { 'X-No-Cache': 'true' };
    return this.http.get<any>(`${this.apiUrl}/me/all`, { headers }).pipe(
      map(raw => this.normalizeGenericArray<Donation>(raw)),
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
   */
  getDonationById(id: number, bypassCache: boolean = false): Observable<Donation> {
    // Permitir bypass de caché cuando se solicita datos frescos (ej: después de crear review)
    const options = bypassCache ? { headers: { 'X-No-Cache': 'true' } } : {};
    
    return this.http.get<Donation>(`${this.apiUrl}/${id}`, options).pipe(
      catchError(error => {
        console.error('Error al obtener donación:', error);
        return throwError(() => error);
      })
    );
  }

  getDonationsByUserId(userId: string | number): Observable<DonationByUser[]> {
    this.loadingSubject.next(true);
    return this.http.get<DonationByUser[]>(`${this.apiUrl}/users/${userId}`).pipe(
      tap(() => {
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
   * Obtener donaciones realizadas por un donante específico (para vista pública)
   */
  getDonationsByDonor(userId: string | number): Observable<Donation[]> {
    return this.http.get<any>(`${this.apiUrl}/users/${userId}`).pipe(
      map(raw => {
        const donations = this.normalizeGenericArray<DonationByUser>(raw);
        // Filtrar solo las donaciones donde el usuario es el donador
        return donations.filter(d => d.donator?.id === Number(userId));
      }),
      catchError(error => {
        console.error('Error al obtener donaciones del donante:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtener donaciones recibidas por una organización específica (para vista pública)
   */
  getDonationsByOrganization(userId: string | number): Observable<Donation[]> {
    return this.http.get<any>(`${this.apiUrl}/users/${userId}`).pipe(
      map(raw => {
        const donations = this.normalizeGenericArray<DonationByUser>(raw);
        // Filtrar solo las donaciones donde el usuario es el beneficiario
        return donations.filter(d => d.beneficiary?.id === Number(userId));
      }),
      catchError(error => {
        console.error('Error al obtener donaciones de la organización:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Actualizar una donación
   */
  updateDonation(id: number, updates: UpdateDonationDTO): Observable<Donation> {
    this.loadingSubject.next(true);
    const url = `${this.apiUrl}/update/${id}`;
    // Agregar header para invalidar caché de donaciones después de actualizar
    const headers = { 'X-Cache-Invalidate': '/donation' };
    
    return this.http.post<Donation>(url, updates, { headers }).pipe(
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
   */
  deleteDonation(id: number): Observable<void> {
    this.loadingSubject.next(true);
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
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
  extendDeliveryDate(id: number): Observable<Donation> {
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
  isOwner(donation: Donation): boolean {
    return donation.owner ?? false;
  }

  /**
   * Verificar si el usuario puede editar una donación
   */
  canEdit(donation: Donation): boolean {
    return this.isOwner(donation);
  }

  /**
   * Verificar si el usuario puede eliminar una donación
   */
  canDelete(donation: Donation): boolean {
    return this.isOwner(donation);
  }

  /**
   * Obtener estadísticas de la organización
   */
  getOrganizationStats(): Observable<OrganizationStats> {
    // Combinar donaciones y mensajes sin leer
    return forkJoin({
      donations: this.getMyDonations(),
      unreadMessages: this.chatService.getUnreadMessagesCount().pipe(
        catchError(error => {
          console.warn('Error al obtener mensajes sin leer, usando 0:', error);
          return of(0);
        })
      )
    }).pipe(
      map(({ donations, unreadMessages }) => {
        // Calcular estadísticas basadas en las donaciones del usuario
        const activeDonations = donations.filter(d => {
          const status = d.statusDonation.status.toLowerCase();
          return status === 'pendiente' || status === 'aceptada' || status === 'activa';
        }).length;

        return {
          activeDonations,
          totalDonations: donations.length,
          requestsReceived: 0, // Implementación futura
          unreadMessages: unreadMessages || 0
        };
      }),
      catchError(error => {
        console.error('Error al obtener estadísticas:', error);
        return throwError(() => error);
      })
    );
  }

  updateDonationStatus(idDonation: number, statusData: UpdateDonationStatusDTO): Observable<Donation> {
    this.loadingSubject.next(true);
    const url = `${this.apiUrl}/${idDonation}/status`;
    // Agregar header para invalidar caché de donaciones después de actualizar estado
    const headers = { 'X-Cache-Invalidate': '/donation' };
    
    return this.http.post<Donation>(url, statusData, { headers }).pipe(
      tap(updatedDonation => {
        // Actualizar en el estado local
        const currentDonations = this.donationsSubject.value;
        const index = currentDonations.findIndex(d => d.id === idDonation);
        if (index !== -1) {
          currentDonations[index] = updatedDonation;
          this.donationsSubject.next([...currentDonations]);
        }
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        console.error('Error al actualizar estado de donación:', error);
        return throwError(() => error);
      })
    );
  }

  getAllDonationStatuses(): Observable<StatusDonation[]> {
    const url = `${environment.apiBackendUrl}/statusdonation`;
    return this.http.get<any>(url).pipe(
      map(raw => this.normalizeGenericArray<StatusDonation>(raw)),
      catchError(error => {
        console.error('Error al obtener estados de donación:', error);
        return throwError(() => error);
      })
    );
  }

  // ========== MÉTODOS DE ADMIN ==========

  /**
   * Obtener todas las donaciones (admin)
   * Usa el endpoint de búsqueda con filtros vacíos para traer todas
   */
  getAllDonations(filters?: {
    orderBy?: string;
    searchParam?: string;
    typeSearch?: string;
    startDate?: string;
    endDate?: string;
  }): Observable<Donation[]> {
    const body = filters || {};
    return this.http.post<any>(`${this.apiUrl}/history/search`, body).pipe(
      map(raw => this.normalizeGenericArray<Donation>(raw)),
      catchError(error => {
        console.error('Error al obtener todas las donaciones:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Actualizar donación (admin)
   */
  updateDonationAdmin(id: number, updates: UpdateDonationDTO): Observable<Donation> {
    return this.http.post<Donation>(`${this.apiUrl}/admin/update/${id}`, updates).pipe(
      catchError(error => {
        console.error('Error al actualizar donación (admin):', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Eliminar donación (admin)
   */
  deleteDonationAdmin(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/admin/${id}`).pipe(
      catchError(error => {
        console.error('Error al eliminar donación (admin):', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Actualizar estado de donación (admin)
   */
  updateDonationStatusAdmin(idDonation: number, statusData: UpdateDonationStatusDTO): Observable<Donation> {
    return this.http.post<Donation>(`${this.apiUrl}/${idDonation}/status/admin`, statusData).pipe(
      catchError(error => {
        console.error('Error al actualizar estado de donación (admin):', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Actualizar fecha de entrega (+10 días, solo una vez) (admin)
   */
  updateDonationDateAdmin(id: number): Observable<Donation> {
    return this.http.put<Donation>(`${this.apiUrl}/admin/update-date/${id}`, {}).pipe(
      catchError(error => {
        console.error('Error al actualizar fecha de donación (admin):', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Agregar artículo a donación (admin)
   */
  addArticleToDonationAdmin(donationId: number, postArticleId: number, quantity: number): Observable<any> {
    return this.http.post<any>(`${environment.apiBackendUrl}/postdonationarticle/add/admin/article`, {
      donationId,
      postArticleId: String(postArticleId),
      quantity
    }).pipe(
      catchError(error => {
        console.error('Error al agregar artículo a donación (admin):', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Eliminar artículo de donación (admin)
   */
  removeArticleFromDonationAdmin(donationArticleId: number): Observable<any> {
    return this.http.delete<any>(`${environment.apiBackendUrl}/postdonationarticle/remove/admin/article/${donationArticleId}`).pipe(
      catchError(error => {
        console.error('Error al eliminar artículo de donación (admin):', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Actualizar cantidad de artículo en donación (admin)
   */
  updateArticleQuantityAdmin(postDonationArticleId: number, newQuantity: number): Observable<any> {
    return this.http.post<any>(`${environment.apiBackendUrl}/postdonationarticle/update/quantity/admin/article`, {
      postDonationArticleId,
      newQuantity
    }).pipe(
      catchError(error => {
        console.error('Error al actualizar cantidad de artículo (admin):', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtener todas las reviews de donaciones
   */
  getAllDonationReviews(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiBackendUrl}/donationreview/all`).pipe(
      catchError(error => {
        console.error('Error al obtener reviews de donaciones:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Eliminar review de donación (admin)
   */
  deleteDonationReviewAdmin(reviewId: number): Observable<any> {
    return this.http.delete<any>(`${environment.apiBackendUrl}/donationreview/admin/delete/${reviewId}`).pipe(
      catchError(error => {
        console.error('Error al eliminar review (admin):', error);
        return throwError(() => error);
      })
    );
  }
}
