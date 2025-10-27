import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EmailVerificationService {
  private baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  verifyEmailCode(email: string, code: string): Observable<any> {
    const url = `${this.baseUrl}/verify-email-code`;
    return this.http.post<any>(url, { email, code });
  }

  verifyEmailToken(token: string): Observable<any> {
    const url = `${this.baseUrl}/verify-email-token`;
    return this.http.post<any>(url, { token });
  }

  /** Endpoint alternativo: recibir código manual desde frontend en /verify/email */
  verifyEmail(email: string, code: string): Observable<any> {
    const url = `${this.baseUrl}/verify/email`;
    return this.http.post<any>(url, { email, code });
  }
}
