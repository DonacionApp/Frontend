import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface OrganizationProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  taxId?: string;
  website?: string;
  description?: string;
  missionStatement?: string;
  logo?: string;
  coverImage?: string;
  registrationNumber?: string;
  registrationDate?: string;
  legalRepresentative?: string;
  bankAccount?: string;
  isVerified?: boolean;
  verificationDate?: string;
  socialMedia?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
  };
  createdAt?: string;
  lastLogin?: string;
  category?: string;
  totalDonationsReceived?: number;
  activeCampaigns?: number;
}

export interface UpdateOrganizationProfileDTO {
  name?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  website?: string;
  description?: string;
  missionStatement?: string;
  legalRepresentative?: string;
  socialMedia?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
  };
}

export interface OrganizationActivityLog {
  id: string;
  action: string;
  description: string;
  timestamp: string;
  metadata?: any;
}

@Injectable({
  providedIn: 'root'
})
export class OrganizationProfileService {
  private apiUrl = `${environment.apiBackendUrl}/api/orgs`;
  private authProfileUrl = `${environment.apiBaseUrl}/profile`; // Nuevo endpoint unificado

  // Estado del perfil con actualizaciones optimistas
  private profileSubject = new BehaviorSubject<OrganizationProfile | null>(null);
  public profile$ = this.profileSubject.asObservable();

  // Estado de carga
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  // Estado de la última actualización
  private lastUpdateSubject = new BehaviorSubject<Date | null>(null);
  public lastUpdate$ = this.lastUpdateSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Obtener el perfil de una organización por ID
   */
  getOrganizationProfile(id: string): Observable<OrganizationProfile> {
    this.loadingSubject.next(true);
    return this.http.get<OrganizationProfile>(`${this.apiUrl}/${id}`).pipe(
      tap(profile => {
        this.profileSubject.next(profile);
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        console.error('Error al cargar perfil de organización:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtener el perfil de la organización autenticada (usuario actual)
   */
  getMyOrganizationProfile(): Observable<OrganizationProfile> {
    this.loadingSubject.next(true);
    return this.http.get<any>(`${this.authProfileUrl}`).pipe(
      map(response => {
        // Transformar respuesta del backend al formato del frontend
        const profile = this.transformBackendResponse(response);
        this.profileSubject.next(profile);
        this.loadingSubject.next(false);
        return profile; // ← Retornar el perfil transformado
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        console.error('Error al cargar perfil de organización:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Transformar la respuesta del backend al formato OrganizationProfile
   */
  private transformBackendResponse(response: any): OrganizationProfile {
    return {
      id: response.id?.toString() || '',
      name: response.people?.name || response.username || '',
      email: response.email || '',
      phone: response.people?.telefono || '',
      address: response.people?.residencia || '',
      city: response.people?.municipio?.city?.name || '',
      state: response.people?.municipio?.state?.name || '',
      country: response.people?.municipio?.country?.name || '',
      postalCode: '',
      taxId: response.people?.dni || '',
      website: '',
      description: '',
      missionStatement: '',
      logo: response.profilePhoto || '',
      coverImage: '',
      registrationNumber: response.people?.dni || '',
      registrationDate: response.createdAt || '',
      legalRepresentative: '',
      bankAccount: '',
      isVerified: response.verified || false,
      verificationDate: response.emailVerified ? response.lastLogin : undefined,
      socialMedia: {
        facebook: '',
        twitter: '',
        instagram: '',
        linkedin: ''
      }
    };
  }

  /**
   * Actualizar perfil de organización con actualización optimista y rollback
   */
  updateOrganizationProfile(id: string, updates: UpdateOrganizationProfileDTO): Observable<OrganizationProfile> {
    // Guardar estado actual para rollback
    const currentProfile = this.profileSubject.value;

    if (!currentProfile) {
      return throwError(() => new Error('No hay perfil de organización cargado'));
    }

    // Actualización optimista: actualizar UI inmediatamente
    const optimisticProfile = { 
      ...currentProfile, 
      ...updates,
      socialMedia: updates.socialMedia 
        ? { ...currentProfile.socialMedia, ...updates.socialMedia }
        : currentProfile.socialMedia
    };
    this.profileSubject.next(optimisticProfile);
    this.loadingSubject.next(true);

    return this.http.post<any>(`${environment.apiBaseUrl}/update-me`, updates).pipe(
      map(response => this.transformBackendResponse(response)),
      tap(updatedProfile => {
        // Confirmar con datos del servidor
        this.profileSubject.next(updatedProfile);
        this.lastUpdateSubject.next(new Date());
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        // Rollback: restaurar estado anterior
        console.error('Error al actualizar perfil de organización, realizando rollback:', error);
        this.profileSubject.next(currentProfile);
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Cambiar contraseña de la organización usando /auth/update-me
   */
  changePassword(id: string, data: { currentPassword: string; newPassword: string; confirmPassword: string }): Observable<any> {
    // Usar /auth/update-me con el campo password
    const updateData = {
      password: data.newPassword
    };
    
    return this.http.post<any>(`${environment.apiBaseUrl}/update-me`, updateData).pipe(
      map(response => {
        const profile = this.transformBackendResponse(response);
        this.profileSubject.next(profile);
        return profile;
      }),
      tap(() => {
        this.lastUpdateSubject.next(new Date());
      }),
      catchError(error => {
        console.error('Error al cambiar contraseña:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtener historial de actividad de la organización
   */
  getActivityLog(id: string): Observable<OrganizationActivityLog[]> {
    return this.http.get<OrganizationActivityLog[]>(`${this.apiUrl}/${id}/activity`).pipe(
      catchError(error => {
        console.error('Error al cargar actividad:', error);
        // Si el endpoint no existe, retornar array vacío
        if (error.status === 404) {
          return new Observable<OrganizationActivityLog[]>(observer => {
            observer.next([]);
            observer.complete();
          });
        }
        return throwError(() => error);
      })
    );
  }

  /**
   * Subir logo de la organización
   */
  uploadLogo(id: string, file: File): Observable<{ logoUrl: string }> {
    const formData = new FormData();
    formData.append('logo', file);

    return this.http.post<{ logoUrl: string }>(`${this.apiUrl}/${id}/upload-logo`, formData).pipe(
      tap(response => {
        const currentProfile = this.profileSubject.value;
        if (currentProfile) {
          this.profileSubject.next({
            ...currentProfile,
            logo: response.logoUrl
          });
          this.lastUpdateSubject.next(new Date());
        }
      }),
      catchError(error => {
        console.error('Error al subir logo:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Subir imagen de portada de la organización
   */
  uploadCoverImage(id: string, file: File): Observable<{ coverImageUrl: string }> {
    const formData = new FormData();
    formData.append('coverImage', file);

    return this.http.post<{ coverImageUrl: string }>(`${this.apiUrl}/${id}/upload-cover`, formData).pipe(
      tap(response => {
        const currentProfile = this.profileSubject.value;
        if (currentProfile) {
          this.profileSubject.next({
            ...currentProfile,
            coverImage: response.coverImageUrl
          });
          this.lastUpdateSubject.next(new Date());
        }
      }),
      catchError(error => {
        console.error('Error al subir imagen de portada:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtener el valor actual del perfil
   */
  get currentProfile(): OrganizationProfile | null {
    return this.profileSubject.value;
  }

  /**
   * Limpiar el estado del perfil
   */
  clearProfile(): void {
    this.profileSubject.next(null);
    this.lastUpdateSubject.next(null);
  }
}
