import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface OrganizationProfile {
  id: string;
  username: string; // Username de la tabla 'user'
  name: string; // Nombre de la organización de la tabla 'people'
  lastName?: string; // raw lastName from people (may be plain surname or JSON string)
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
  // Coordenadas opcionales (mapeo del backend: { lat, lng })
  location?: { lat: number; lng: number } | null;
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
  lastName?: string; // Para organizaciones, contiene JSON con description y networks
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
        console.log('response', response);
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
    // Defensive: si la respuesta es nula/indefinida, devolver un perfil vacío para evitar errores en templates
    if (!response) {
      console.warn('transformBackendResponse recibió response vacío');
      return {
        id: '',
        username: '',
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        country: '',
        postalCode: '',
        taxId: '',
        website: '',
        description: '',
        missionStatement: '',
        logo: '',
        coverImage: '',
        registrationNumber: '',
        registrationDate: '',
        legalRepresentative: '',
        bankAccount: '',
        isVerified: false,
        verificationDate: undefined,
  location: null,
        createdAt: '',
        lastLogin: '',
        lastName: '',
        socialMedia: {}
      } as OrganizationProfile;
    }

    // Verificar si es una organización por el rol
    const isOrganization = response?.rol?.rol?.toLowerCase() === 'organizacion' || 
                           response?.rol?.rol?.toLowerCase() === 'organization' ||
                           response?.rol?.id === 3;
    
    // Parsear lastName si es JSON (para organizaciones)
    let description = '';
    let networks: string[] = [];
    let lastNameRaw = response.people?.lastName || '';
    
    if (isOrganization && lastNameRaw) {
      try {
        // Intentar parsear como JSON
        const parsed = JSON.parse(lastNameRaw);
        if (parsed && typeof parsed === 'object') {
          description = parsed.description || '';
          networks = Array.isArray(parsed.networks) ? parsed.networks : [];
          // Si hay networks, usar el primero como website
          if (networks.length > 0 && !response.website) {
            response.website = networks[0];
          }
        } else {
          // Si no es un objeto, usar como descripción simple
          description = lastNameRaw;
        }
      } catch (e) {
        // Si no es JSON válido, usar como descripción simple
        description = lastNameRaw;
      }
    } else if (!isOrganization) {
      // Para usuarios normales, mantener lastName tal cual
      description = lastNameRaw;
    }
    
    return {
      id: response.id?.toString() || '',
      username: response.username || '',
      name: response.people?.name || response.username || '',
      email: response.email || '',
      phone: response.people?.telefono || '',
      address: response.people?.residencia || '',
      city: response.people?.municipio?.city?.name || '',
      state: response.people?.municipio?.state?.name || '',
      country: response.people?.municipio?.country?.name || '',
      postalCode: '',
      taxId: response.people?.dni || '',
      website: response.website || (networks.length > 0 ? networks[0] : ''),
      description: description || response.description || '',
      missionStatement: '',
      logo: response.profilePhoto || '',
      coverImage: '',
      registrationNumber: response.people?.dni || '',
      registrationDate: response.createdAt || '',
      legalRepresentative: '',
      bankAccount: '',
      isVerified: response.verified || false,
      verificationDate: response.emailVerified ? response.lastLogin : undefined,
      createdAt: response.createdAt || '',
      lastLogin: response.lastLogin || '',
      lastName: description, // Para organizaciones, lastName contiene la descripción
      socialMedia: {
        facebook: response.socialMedia?.facebook || '',
        twitter: response.socialMedia?.twitter || '',
        instagram: response.socialMedia?.instagram || '',
        linkedin: response.socialMedia?.linkedin || ''
      }
    ,
      // Mapear location si viene desde el backend (ej. { lat, lng })
      location: response.location ? { lat: Number(response.location.lat), lng: Number(response.location.lng) } : null
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

    // Construir el requestBody en el formato que espera el backend
    // El backend espera people.lastName para organizaciones (debe ser JSON stringificado)
    const requestBody: any = {
      people: {
        name: updates.name,
        residencia: updates.address,
        telefono: updates.phone
      }
    };

    // Si hay lastName en updates, usarlo directamente (ya viene como JSON stringificado)
    if (updates.lastName) {
      requestBody.people.lastName = updates.lastName;
    } else if (updates.description) {
      // Si no hay lastName pero hay description, construir el JSON
      const networks: string[] = [];
      if (updates.website) networks.push(updates.website);
      if (updates.socialMedia?.facebook) networks.push(updates.socialMedia.facebook);
      if (updates.socialMedia?.twitter) networks.push(updates.socialMedia.twitter);
      if (updates.socialMedia?.instagram) networks.push(updates.socialMedia.instagram);
      if (updates.socialMedia?.linkedin) networks.push(updates.socialMedia.linkedin);
      requestBody.people.lastName = JSON.stringify({ description: updates.description, networks });
    }

    // Agregar otros campos si existen
    if (updates.website) {
      requestBody.website = updates.website;
    }

    return this.http.post<any>(`${environment.apiBaseUrl}/update-me`, requestBody).pipe(
      map(response => this.transformBackendResponse(response)),
      tap(updatedProfile => {
        this.profileSubject.next(updatedProfile);
        this.lastUpdateSubject.next(new Date());
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        console.error('Error al actualizar perfil de organización:', error);
        // Rollback: restaurar estado anterior
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
   * Nota: Este endpoint aún no está implementado en el backend
   */
  getActivityLog(id: string): Observable<OrganizationActivityLog[]> {
    return this.http.get<OrganizationActivityLog[]>(`${this.apiUrl}/${id}/activity`).pipe(
      catchError(error => {
        // Si el endpoint no existe (404), retornar array vacío silenciosamente
        if (error.status === 404) {
          return new Observable<OrganizationActivityLog[]>(observer => {
            observer.next([]);
            observer.complete();
          });
        }
        // Solo mostrar error si no es 404
        console.error('Error al cargar actividad:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Subir logo de la organización
   */
  uploadLogo(id: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('profilePhoto', file);

    return this.http.post<any>(`${environment.apiBaseUrl}/update-me/profile-photo`, formData).pipe(
      tap(response => {
        // Recargar el perfil completo después de subir la imagen
        this.getMyOrganizationProfile().subscribe();
        this.lastUpdateSubject.next(new Date());
      }),
      catchError(error => {
        console.error('Error al subir logo:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Subir imagen de portada de la organización
   * Nota: El backend actual solo soporta profilePhoto, esta funcionalidad será implementada en el futuro
   */
  uploadCoverImage(id: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('profilePhoto', file);

    return this.http.post<any>(`${environment.apiBaseUrl}/update-me/profile-photo`, formData).pipe(
      tap(response => {
        // Recargar el perfil completo después de subir la imagen
        this.getMyOrganizationProfile().subscribe();
        this.lastUpdateSubject.next(new Date());
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
