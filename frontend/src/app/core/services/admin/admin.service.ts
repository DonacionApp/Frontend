import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';


export interface AdminUserMinimalMunicipioCountry {
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

export interface AdminUserMinimalMunicipioState {
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

export interface AdminUserMinimalMunicipioCity {
  id: number;
  name: string;
}

export interface AdminUserMinimalMunicipio {
  country?: AdminUserMinimalMunicipioCountry;
  state?: AdminUserMinimalMunicipioState;
  city?: AdminUserMinimalMunicipioCity;
}

export interface AdminUserMinimal {
  id: number;
  username: string;
  email: string;
  profilePhoto: string;
  emailVerified: boolean;
  verified: boolean;
  createdAt: string;
  rol: string;
  residencia?: string;
  municipio?: AdminUserMinimalMunicipio;
  location?: { lat: number; lng: number } | null;
  countPosts?: number;
  countDonations?: number;
}


export interface AuditUser {
  id: number;
  username: string;
  email: string;
}

export interface AuditComment {
  message: string;
  payload?: any;
  response?: any;
}

export interface AuditAction {
  id: number;
  user: AuditUser | null;
  action: string;
  comment: AuditComment | null;
  status?: string | number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditResponseMeta {
  total: number;
  limit: number;
  offset: number;
}

export interface AuditResponse {
  data: AuditAction[];
  meta: AuditResponseMeta;
}

export interface AuditFilters {
  action?: string;
  order?: 'ASC' | 'DESC';
  limit?: number;
  page?: number;
  [key: string]: any;
}


export interface AdminUserPeople {
  id: number;
  name: string;
  municipio?: string | null; // backend sometimes returns JSON string
  lastName?: string | null;
  birdthDate?: string | null;
  typeDni?: {
    id: number;
    type: string;
    createdAt?: string;
    updatedAt?: string;
  } | null;
  dni?: string | null;
  residencia?: string | null;
  telefono?: string | null;
  supportId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminUserRole {
  id: number;
  rol: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  token?: string | null;
  loginAttempts?: number;
  lockUntil?: string | null;
  profilePhoto?: string | null;
  dateSendCodigo?: string | null;
  lastLogin?: string | null;
  emailVerified?: boolean;
  verified?: boolean;
  code?: string | null;
  block?: boolean;
  location?: string | null; // often JSON string with lat/lng
  people?: AdminUserPeople;
  rol?: AdminUserRole;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private base = environment.apiBackendUrl;

  constructor(private http: HttpClient) {}


  getUserMinimal(idUser: number): Observable<AdminUserMinimal> {
    const url = `${this.base}/user/minimal/${idUser}`;
    return this.http.get<AdminUserMinimal>(url).pipe(
      catchError(error => {
        console.error('Error loading user minimal:', error);
        return throwError(() => error);
      })
    );
  }


  getUserActions(userId: number, filters: AuditFilters): Observable<AuditResponse> {
    const url = `${this.base}/audit/admin/user/${userId}/actions`;
    return this.http.post<AuditResponse>(url, filters).pipe(
      catchError(error => {
        console.error('Error loading audit actions:', error);
        return throwError(() => error);
      })
    );
  }


  getUsers(): Observable<AdminUser[]> {
    const url = `${this.base}/user`;
    return this.http.get<AdminUser[]>(url).pipe(
      catchError(error => {
        console.error('Error loading users:', error);
        return throwError(() => error);
      })
    );
  }
}
