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
}

export interface Donation extends CreateDonationDTO {
  id: string;
  userId: string;
  user?: DonationUser; // Información del usuario que creó la donación
  statusDonation?: string;
  createdAt: string;
  updatedAt: string;
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
    return this.http.post<Donation>(`${this.apiUrl}/create`, donationData).pipe(
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
    return this.http.get<Donation[]>(`${this.apiUrl}/my-donations`).pipe(
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
    return this.http.put<Donation>(`${this.apiUrl}/${id}`, updates).pipe(
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
    return this.http.patch<Donation>(`${this.apiUrl}/${id}/extend-date`, {}).pipe(
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
}
