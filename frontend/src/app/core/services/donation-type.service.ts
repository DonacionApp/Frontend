import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { DonationType } from '../../shared/model/donation-type.model';

@Injectable({
  providedIn: 'root'
})
export class DonationTypeService {
  // 🔄 ADAPTADO: Usa /tag del backend (necesitas crear el módulo Tag)
  private apiUrl = `${environment.apiBackendUrl}/tag`;

  // Estado de los tipos de donación
  private donationTypesSubject = new BehaviorSubject<DonationType[]>([]);
  public donationTypes$ = this.donationTypesSubject.asObservable();

  // Estado de carga
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Obtener todos los tipos de donación
   * 🔄 USA: GET /tag (endpoint de tu backend)
   */
  getAllDonationTypes(): Observable<DonationType[]> {
    this.loadingSubject.next(true);
    return this.http.get<any[]>(`${this.apiUrl}`).pipe(
      map(tags => tags.map(tag => ({
        id: tag.id?.toString(),
        name: tag.tag || tag.name,  // Tu backend usa "tag" en lugar de "name"
        description: tag.description || tag.tag
      }))),
      tap(types => {
        this.donationTypesSubject.next(types);
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        console.error('Error al obtener tipos de donación:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtener un tipo de donación por ID
   */
  getDonationTypeById(id: string): Observable<DonationType> {
    return this.http.get<DonationType>(`${this.apiUrl}/${id}`).pipe(
      catchError(error => {
        console.error('Error al obtener tipo de donación:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtener los tipos de donación actuales del estado
   */
  get currentDonationTypes(): DonationType[] {
    return this.donationTypesSubject.value;
  }
}

