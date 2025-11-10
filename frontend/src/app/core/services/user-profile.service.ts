import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// Tipos para el endpoint /user/minimal/{id}
export interface UserMinimalMunicipioCountry {
  id: number;
  name: string;
  iso2?: string;
  iso3?: string;
  phonecode?: string;
  capital?: string;
  currency?: string;
  native?: string;
  emoji?: string;
}

export interface UserMinimalMunicipioState {
  id: number;
  name: string;
  country_id?: number;
  country_code?: string;
  iso2?: string;
  iso3166_2?: string;
  type?: string | null;
  level?: number | null;
  parent_id?: number | null;
  native?: string;
  latitude?: string | null;
  longitude?: string | null;
  timezone?: string;
  translations?: string | null;
  population?: number | null;
}

export interface UserMinimalMunicipioCity {
  id: number;
  name: string;
}

export interface UserMinimalMunicipio {
  country?: UserMinimalMunicipioCountry;
  state?: UserMinimalMunicipioState;
  city?: UserMinimalMunicipioCity;
}

export interface UserMinimal {
  id: number;
  username: string;
  email: string;
  profilePhoto: string;
  emailVerified: boolean;
  verified: boolean;
  createdAt: string;
  rol: string;
  residencia?: string;
  municipio?: UserMinimalMunicipio;
  countPosts?: number;
  countDonations?: number;
}

// Interfaces que coinciden con el backend
export interface BackendUserProfile {
  id: number;
  username: string;
  email: string;
  token: string | null;
  loginAttempts: number;
  lockUntil: string | null;
  profilePhoto: string;
  dateSendCodigo: string | null;
  lastLogin: string;
  emailVerified: boolean;
  verified: boolean;
  code: string | null;
  block: boolean;
  people: {
    id: number;
    name: string;
    lastName: string | null;
    birdthDate: string;
    dni: string;
    residencia: string;
    telefono: string;
    typeDni: {
      id: number;
      type: string;
    };
    municipio: {
      city: {
        id: number;
        name: string;
      };
      state: {
        id: number;
        name: string;
      };
      country: {
        id: number;
        name: string;
        iso2: string;
      };
    };
    createdAt: string;
    updatedAt: string;
  };
  rol: {
    id: number;
    rol: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Interface normalizada para el frontend
export interface UserProfile {
  id: string;
  username: string; // Username de la tabla 'user'
  email: string;
  name: string; // Nombre de la tabla 'people'
  lastName?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  dateOfBirth?: string;
  profileImage?: string;
  role: 'donor' | 'organization' | 'admin';
  createdAt?: string;
  lastLogin?: string;
  isEmailVerified?: boolean;
  dni?: string;
  typeDni?: string;
}

export interface UpdateUserProfileDTO {
  username?: string;
  email?: string;
  password?: string;
  rolId?: number;
  people?: {
    name?: string;
    lastName?: string;
    birdthDate?: string;
    dni?: string;
    residencia?: string;
    telefono?: string;
    supportId?: number | null;
    municipio?: {
      pais?: {
        iso2?: string;
      };
      state?: {
        iso2?: string;
      };
      city?: {
        name?: string;
      };
    };
  };
  profilePhoto?: string;
}

export interface ChangePasswordDTO {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  description: string;
  timestamp: string;
  metadata?: any;
}

@Injectable({
  providedIn: 'root'
})
export class UserProfileService {
  private apiUrl = `${environment.apiBaseUrl}`; // http://localhost:5000/auth
  
  // Estado del perfil con actualizaciones optimistas
  private profileSubject = new BehaviorSubject<UserProfile | null>(null);
  public profile$ = this.profileSubject.asObservable();

  // Estado de carga
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  // Estado de la última actualización
  private lastUpdateSubject = new BehaviorSubject<Date | null>(null);
  public lastUpdate$ = this.lastUpdateSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Normalizar la respuesta del backend al formato del frontend
   * 
   * Mapea datos de las tablas 'user' y 'people' del backend a la interfaz UserProfile.
   * Campos mapeados:
   * - De tabla 'user': id, email, profilePhoto, rol, createdAt, lastLogin, emailVerified
   * - De tabla 'people': name, lastName, telefono, residencia, birdthDate, dni, typeDni, municipio
   */
  private normalizeProfile(backendProfile: BackendUserProfile): UserProfile {
    // Helper para limpiar valores "[null]" que vienen del backend
    const cleanValue = (value: any): string => {
      if (!value || value === '[null]' || value === 'null') return '';
      return String(value).trim();
    };

    return {
      id: backendProfile.id.toString(),
      username: backendProfile.username || '', // Username de la tabla 'user'
      email: backendProfile.email || '',
      name: cleanValue(backendProfile.people?.name), // Nombre de la tabla 'people'
      lastName: cleanValue(backendProfile.people?.lastName),
      phone: cleanValue(backendProfile.people?.telefono),
      address: cleanValue(backendProfile.people?.residencia),
      city: cleanValue(backendProfile.people?.municipio?.city?.name),
      state: cleanValue(backendProfile.people?.municipio?.state?.name),
      country: cleanValue(backendProfile.people?.municipio?.country?.name),
      dateOfBirth: cleanValue(backendProfile.people?.birdthDate),
      profileImage: cleanValue(backendProfile.profilePhoto),
      role: this.normalizeRole(backendProfile.rol?.rol || 'donor'),
      createdAt: backendProfile.createdAt || '',
      lastLogin: backendProfile.lastLogin || '',
      isEmailVerified: backendProfile.emailVerified || false,
      dni: cleanValue(backendProfile.people?.dni),
      typeDni: cleanValue(backendProfile.people?.typeDni?.type)
    };
  }

  /**
   * Normalizar el rol del backend
   */
  private normalizeRole(roleName: string): 'donor' | 'organization' | 'admin' {
    const normalizedRol = roleName.toLowerCase();
    if (normalizedRol === 'donante' || normalizedRol === 'donor' || normalizedRol === 'user') return 'donor';
    if (normalizedRol === 'organizacion' || normalizedRol === 'organization') return 'organization';
    if (normalizedRol === 'admin' || normalizedRol === 'administrador') return 'admin';
    return 'donor'; // default
  }

  /**
   * Obtener el perfil del usuario autenticado desde /auth/profile
   */
  getMyProfile(): Observable<UserProfile> {
    this.loadingSubject.next(true);
    return this.http.get<BackendUserProfile>(`${this.apiUrl}/profile`).pipe(
      map(backendProfile => this.normalizeProfile(backendProfile)),
      tap(profile => {
        this.profileSubject.next(profile);
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        console.error('Error al cargar perfil:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtener datos mínimos de un usuario por id usando /user/minimal/{id}
   * No normaliza porque la estructura ya es "ligera" y específica.
   */
  getUserMinimal(idUser: number): Observable<UserMinimal> {
    const url = `${environment.apiBackendUrl}/user/minimal/${idUser}`;
    return this.http.get<UserMinimal>(url).pipe(
      catchError(error => {
        console.error('Error al cargar usuario minimal:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Actualizar perfil con actualización optimista y rollback en caso de error
   */
  updateProfile(updates: UpdateUserProfileDTO): Observable<UserProfile> {
    // Guardar estado actual para rollback
    const currentProfile = this.profileSubject.value;
    
    if (!currentProfile) {
      return throwError(() => new Error('No hay perfil cargado'));
    }

    // Actualización optimista: actualizar UI inmediatamente
    const optimisticProfile: UserProfile = { 
      ...currentProfile,
      name: updates.people?.name || currentProfile.name,
      phone: updates.people?.telefono || currentProfile.phone,
      address: updates.people?.residencia || currentProfile.address,
      dateOfBirth: updates.people?.birdthDate || currentProfile.dateOfBirth,
      dni: updates.people?.dni || currentProfile.dni
    };
    this.profileSubject.next(optimisticProfile);
    this.loadingSubject.next(true);

    return this.http.post<BackendUserProfile>(`${this.apiUrl}/update-me`, updates).pipe(
      map(backendProfile => this.normalizeProfile(backendProfile)),
      tap(updatedProfile => {
        // Confirmar con datos del servidor
        this.profileSubject.next(updatedProfile);
        this.lastUpdateSubject.next(new Date());
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        // Rollback: restaurar estado anterior
        console.error('Error al actualizar perfil, realizando rollback:', error);
        this.profileSubject.next(currentProfile);
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Cambiar contraseña del usuario usando /auth/update-me
   */
  changePassword(data: ChangePasswordDTO): Observable<any> {
    // Convertir ChangePasswordDTO a UpdateUserProfileDTO
    const updateData: UpdateUserProfileDTO = {
      password: data.newPassword
    };
    
    return this.http.post<BackendUserProfile>(`${this.apiUrl}/update-me`, updateData).pipe(
      map(backendProfile => this.normalizeProfile(backendProfile)),
      tap(updatedProfile => {
        this.profileSubject.next(updatedProfile);
        this.lastUpdateSubject.next(new Date());
      }),
      catchError(error => {
        console.error('Error al cambiar contraseña:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtener historial de actividad del usuario
   */
  getActivityLog(): Observable<ActivityLog[]> {
    return this.http.get<ActivityLog[]>(`${this.apiUrl}/activity`).pipe(
      catchError(error => {
        // Si el endpoint no existe (404), retornar array vacío silenciosamente
        if (error.status === 404) {
          return new Observable<ActivityLog[]>(observer => {
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
   * Subir imagen de perfil
   */
  uploadProfileImage(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('profilePhoto', file);

    return this.http.post<any>(`${this.apiUrl}/update-me/profile-photo`, formData).pipe(
      tap(response => {
        // Recargar el perfil completo después de subir la imagen
        this.getMyProfile().subscribe();
        this.lastUpdateSubject.next(new Date());
      }),
      catchError(error => {
        console.error('Error al subir imagen:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtener el valor actual del perfil
   */
  get currentProfile(): UserProfile | null {
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
