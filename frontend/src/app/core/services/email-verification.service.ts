import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EmailVerificationService {
  private baseUrl = `${environment.apiBackendUrl}/auth`;

  constructor(private http: HttpClient) {}

  /**
   * Verifica el código de verificación de email
   * @param email Email del usuario
   * @param code Código de verificación (6 caracteres)
   */
  verifyEmailCode(email: string, code: string): Observable<any> {
    const url = `${this.baseUrl}/verify-email-code`;
    return this.http.post<any>(url, { email, code });
  }

  /**
   * Verifica usando el token enviado por correo
   * @param token Token de verificación del correo
   */
  verifyEmailToken(token: string): Observable<any> {
    const url = `${this.baseUrl}/verify-email-token`;
    return this.http.post<any>(url, { token });
  }

  /**
   * Endpoint alternativo: verificar email con código
   * @param email Email del usuario
   * @param code Código de verificación
   */
  verifyEmail(email: string, code: string): Observable<any> {
    const url = `${this.baseUrl}/verify/email`;
    return this.http.post<any>(url, { email, code });
  }

  /**
   * Reenvía el correo de verificación
   * @param email Email del usuario
   */
  resendVerificationEmail(email: string): Observable<any> {
    const url = `${this.baseUrl}/resend-verification-email`;
    return this.http.post<any>(url, { email });
  }
}
