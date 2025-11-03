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

export interface CreateDonationDTO {
  lugarRecogida: string;
  lugarDonacion: string;
  articles: Article[];
  comments: Comment[];
  comunity: string;
  fechaMaximaEntrega: string; // ISO 8601 format
  statusDonation?: number; // Estado de la donación (opcional, por defecto 1)
}

export interface StatusDonation {
  id: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Donation {
  id: string;
  userId: string;
  user?: DonationUser; // Información del usuario que creó la donación
  lugarRecogida: string;
  lugarDonacion: string;
  articles: Article[];
  comments: Comment[];
  comunity: string;
  fechaMaximaEntrega: string;
  statusDonation?: string | number | StatusDonation; // Puede ser string, number o objeto
  createdAt: string;
  updatedAt: string;
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
  public donations$ = this.donationsSubject.asObservable();

  // Estado de carga
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) {}

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
    return this.http.get<Donation[]>(`${this.apiUrl}/me/all`).pipe(
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
  getDonationById(id: string): Observable<Donation> {
    return this.http.get<Donation>(`${this.apiUrl}/${id}`).pipe(
      catchError(error => {
        console.error('Error al obtener donación:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Actualizar una donación
   */
  updateDonation(id: string, updates: Partial<CreateDonationDTO>): Observable<Donation> {
    this.loadingSubject.next(true);
    const url = `${this.apiUrl}/update/${id}`;
    return this.http.post<Donation>(url, updates).pipe(
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
  deleteDonation(id: string): Observable<void> {
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
        const activeDonations = donations.filter(d => {
          if (!d.statusDonation) return true;
          
          // Si es un objeto con propiedad status
          if (typeof d.statusDonation === 'object' && 'status' in d.statusDonation) {
            const status = d.statusDonation.status.toLowerCase();
            return status === 'pendiente' || status === 'aceptada';
          }
          
          // Si es string
          if (typeof d.statusDonation === 'string') {
            return d.statusDonation.toLowerCase() === 'disponible' || d.statusDonation.toLowerCase() === 'pendiente';
          }
          
          // Si es number
          return d.statusDonation === 1 || d.statusDonation === 2;
        }).length;

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
}
