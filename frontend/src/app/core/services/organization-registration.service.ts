import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class OrganizationRegistrationService {
  private baseUrl = environment.apiBaseUrl || '';
  // Algunos endpoints (countries/states/cities) están expuestos en la raíz del host
  // mientras que los endpoints de auth (register/login) usan el prefijo /auth.
  // Calcular la raíz removiendo "/auth" si está presente.
  private apiRoot = this.baseUrl.replace(/\/auth$/, '');

  constructor(private http: HttpClient) {}

  getCountries(): Observable<any[]> {
  const url = `${this.apiRoot}/countries`;
  return this.http.get<any[]>(url);
  }

  // Endpoint: /countries/states/iso/{iso}
  getStates(iso: string): Observable<any[]> {
  const url = `${this.apiRoot}/countries/states/iso/${iso}`;
  return this.http.get<any[]>(url);
  }

  // Endpoint: /countries/countries/{iso}/states/{isoState}/cities
  getCities(countryIso: string, stateIso: string): Observable<any[]> {
  const url = `${this.apiRoot}/countries/countries/${countryIso}/states/${stateIso}/cities`;
  return this.http.get<any[]>(url);
  }

  // Register organization with files (FormData)
  registerOrganization(formData: FormData): Observable<any> {
    const url = `${this.baseUrl}/register`;
    return this.http.post(url, formData, { reportProgress: true, observe: 'events' as any });
  }

  // Cuando no hay archivos, enviar JSON directamente (Content-Type: application/json)
  registerOrganizationJson(payload: any): Observable<any> {
    const url = `${this.baseUrl}/register`;
    return this.http.post<any>(url, payload);
  }
}
