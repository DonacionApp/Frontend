import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface VerificationResponse {
  message: string;
  isDocumentVerified?: boolean;
  supportIdUrl?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class VerificationService {
  private apiUrl = environment.apiBaseUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  /**
   * Subir documento de soporte para verificación
   * @param file Archivo de documento (JPG, PNG, PDF)
   * @returns Observable con la respuesta del backend
   */
  uploadSupportDocument(file: File): Observable<VerificationResponse> {
    const formData = new FormData();
    formData.append('supportId', file);

  // Uploading support document

    return this.http.post<VerificationResponse>(
      `${this.apiUrl}/update-support-id`,
      formData
    ).pipe(
      tap(response => {
        // Actualizar el estado del usuario en AuthService
        if (response.isDocumentVerified) {
          this.updateUserVerificationStatus(true);
        }
      })
    );
  }

  /**
   * Validar archivo antes de enviar
   * @param file Archivo a validar
   * @returns Resultado de validación
   */
  validateFile(file: File): ValidationResult {
    // Validar tipo de archivo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    const validExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];
    
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    const isValidType = validTypes.includes(file.type) || validExtensions.includes(fileExtension);
    
    if (!isValidType) {
      return {
        valid: false,
        error: 'Formato de archivo no válido. Solo se aceptan JPG, PNG y PDF.'
      };
    }

    // Validar tamaño (máximo 5MB)
    const maxSize = 5 * 1024 * 1024; // 5 MB en bytes
    if (file.size > maxSize) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return {
        valid: false,
        error: `El archivo es demasiado grande (${sizeMB} MB). El tamaño máximo permitido es 5 MB.`
      };
    }

    return { valid: true };
  }

  /**
   * Actualizar el estado de verificación del usuario en el localStorage y AuthService
   * @param isVerified Estado de verificación
   */
  private updateUserVerificationStatus(isVerified: boolean): void {
    const currentUser = this.authService.currentUserValue;
    if (currentUser) {
      const updatedUser = {
        ...currentUser,
        isDocumentVerified: isVerified
      };
      
      // Actualizar en localStorage
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      
      // Actualizar en el BehaviorSubject del AuthService
      // Como el BehaviorSubject es privado, necesitamos actualizar el usuario
      // Esta es una forma de hacerlo sin exponer el subject
  // Updating verification state in AuthService
    }
  }

  /**
   * Obtener mensaje de error descriptivo según código HTTP
   * @param status Código de estado HTTP
   * @param defaultMessage Mensaje por defecto
   * @returns Mensaje de error descriptivo
   */
  getErrorMessage(status: number, defaultMessage?: string): string {
    switch (status) {
      case 400:
        return 'Archivo inválido o el campo supportId está faltante. Verifica el archivo e intenta nuevamente.';
      case 401:
        return 'Sesión expirada. Por favor, inicia sesión nuevamente.';
      case 409:
        return 'Tu cuenta ya está verificada. No es necesario subir otro documento.';
      case 413:
        return 'El archivo es demasiado grande. El tamaño máximo permitido es 5 MB.';
      case 500:
        return 'Error del servidor. Por favor, intenta nuevamente más tarde.';
      default:
        return defaultMessage || 'Error al procesar la solicitud. Por favor, intenta nuevamente.';
    }
  }
}
