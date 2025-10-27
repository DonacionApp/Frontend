import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-email-verification',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full space-y-8">
        <div class="text-center">
          <!-- Icono de verificación -->
          <div class="mx-auto flex items-center justify-center h-20 w-20 rounded-full mb-6"
               [class.bg-green-100]="!isVerified"
               [class.bg-green-100]="isVerified">
            <svg *ngIf="!isVerified" class="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
            </svg>
            <svg *ngIf="isVerified" class="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          
          <!-- Título principal -->
          <h2 class="text-3xl font-bold text-gray-900 mb-2">
            {{ isVerified ? '¡Cuenta Verificada!' : '¡Registro Exitoso!' }}
          </h2>
          
          <!-- Subtítulo -->
          <p class="text-lg text-gray-600 mb-8">
            {{ isVerified ? 'Tu cuenta ha sido verificada exitosamente' : 'Te hemos enviado un correo de verificación' }}
          </p>
        </div>

        <!-- Contenido principal - cambia según el estado de verificación -->
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
          <div class="text-center">
            
            <!-- Vista cuando NO está verificado -->
            <div *ngIf="!isVerified">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">
                Verifica tu correo electrónico
              </h3>
              
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div class="flex items-center justify-center mb-2">
                  <svg class="h-5 w-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path>
                  </svg>
                  <span class="text-sm font-medium text-blue-800">Correo enviado a:</span>
                </div>
                <p class="text-lg font-semibold text-blue-900 break-all">{{ userEmail }}</p>
              </div>

              <!-- Verificación por código -->
              <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <h4 class="text-md font-semibold text-gray-800 mb-3">Verificación por código</h4>
                <div class="space-y-3">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Código de verificación:</label>
                    <input 
                      type="text" 
                      [(ngModel)]="verificationCode"
                      (input)="onCodeInput($event)"
                      placeholder="ABC123"
                      maxlength="6"
                      inputmode="text"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg font-mono tracking-wider uppercase">
                  </div>
                  <button 
                    (click)="verifyCode()"
                    [disabled]="!isCodeValid() || isVerifying"
                    class="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200">
                    {{ isVerifying ? 'Verificando...' : 'Verificar Código' }}
                  </button>
                </div>
              </div>
              
              <div class="text-sm text-gray-600 space-y-2">
                <p>• Revisa tu bandeja de entrada</p>
                <p>• Si no encuentras el correo, revisa la carpeta de spam</p>
                <p>• Ingresa el código de 6 caracteres (letras y números) que recibiste</p>
                <p>• Una vez verificado, podrás acceder a la plataforma</p>
                <div class="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
                  <p class="text-xs text-blue-800 font-medium">💡 Tip:</p>
                  <p class="text-xs text-blue-700">Puedes usar el código de verificación o hacer clic en el enlace del email</p>
                </div>
              </div>
            </div>

            <!-- Vista cuando YA está verificado -->
            <div *ngIf="isVerified">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">
                Verificación Completada
              </h3>
              
              <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div class="flex items-center justify-center mb-2">
                  <svg class="h-5 w-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path>
                  </svg>
                  <span class="text-sm font-medium text-green-800">Email verificado:</span>
                </div>
                <p class="text-lg font-semibold text-green-900 break-all">{{ userEmail }}</p>
              </div>

              <div class="text-sm text-gray-600 space-y-2">
                <p>✅ Tu cuenta está activa</p>
                <p>✅ Puedes acceder a la plataforma</p>
                <p>✅ Tu registro está completo</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Botones de acción - cambian según el estado -->
        <div class="space-y-4">
          
          <!-- Botones cuando NO está verificado -->
          <div *ngIf="!isVerified">
            <!-- Botón para reenviar correo -->
            <button 
              (click)="resendEmail()"
              [disabled]="isResending || resendCooldown > 0"
              class="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200">
              <span *ngIf="isResending" class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></span>
              {{ getResendButtonText() }}
            </button>
            
            
            <!-- Botón para ir al inicio -->
            <button 
              (click)="goToHome()"
              class="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200">
              Ir al inicio
            </button>
          </div>

          <!-- Botones cuando YA está verificado -->
          <div *ngIf="isVerified">
            <!-- Botón principal para iniciar sesión -->
            <button 
              (click)="autoLogin()"
              class="w-full flex justify-center py-4 px-6 border border-transparent rounded-lg shadow-sm text-lg font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200">
              <svg class="h-6 w-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              Iniciar Sesión
            </button>
            
            <!-- Botón secundario para ir al inicio -->
            <button 
              (click)="goToHome()"
              class="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200">
              Ir al inicio
            </button>
          </div>
        </div>

        <!-- Mensajes de estado -->
        <div *ngIf="message" class="mt-4 p-4 rounded-lg border"
             [class.bg-green-50]="messageType === 'success'"
             [class.border-green-200]="messageType === 'success'"
             [class.text-green-800]="messageType === 'success'"
             [class.bg-red-50]="messageType === 'error'"
             [class.border-red-200]="messageType === 'error'"
             [class.text-red-800]="messageType === 'error'"
             [class.bg-yellow-50]="messageType === 'warning'"
             [class.border-yellow-200]="messageType === 'warning'"
             [class.text-yellow-800]="messageType === 'warning'">
          <div class="flex items-center">
            <svg *ngIf="messageType === 'success'" class="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
            </svg>
            <svg *ngIf="messageType === 'error'" class="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
            </svg>
            <svg *ngIf="messageType === 'warning'" class="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
            </svg>
            {{ message }}
          </div>
        </div>

        <!-- Información adicional -->
        <div class="text-center">
          <!-- Información cuando NO está verificado -->
          <div *ngIf="!isVerified">
            <p class="text-sm text-gray-500">
              ¿No recibiste el correo? 
              <button 
                (click)="resendEmail()" 
                [disabled]="resendCooldown > 0"
                class="text-blue-600 hover:text-blue-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                Reenviar
              </button>
            </p>
          </div>
          
          <!-- Información cuando YA está verificado -->
          <div *ngIf="isVerified">
            <div class="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p class="text-sm text-green-800">
                <strong>Nota:</strong> Haz clic en "Iniciar Sesión" para acceder a la plataforma.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class EmailVerificationComponent implements OnInit {
  userEmail: string = '';
  verificationCode: string = '';
  isResending: boolean = false;
  isVerifying: boolean = false;
  message: string = '';
  messageType: 'success' | 'error' | 'warning' = 'success';
  resendCooldown: number = 0;
  private cooldownInterval: any;
  isVerified: boolean = false; // Nuevo estado para controlar si ya está verificado

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // Obtener parámetros de la ruta
    this.route.queryParams.subscribe(params => {
      // Email del usuario
      this.userEmail = params['email'] || '';
      
      if (!this.userEmail) {
        this.message = 'Error: No se encontró el correo electrónico';
        this.messageType = 'error';
        setTimeout(() => this.router.navigate(['/donor/register']), 3000);
        return;
      }

      // Verificar si hay un token en la URL (verificación por enlace)
      const token = params['token'];
      
      if (token) {
        // Verificar en el backend y luego redirigir
        this.verifyTokenAndRedirect(token);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.cooldownInterval) {
      clearInterval(this.cooldownInterval);
    }
  }

  onCodeInput(event: any): void {
    // Permitir letras y números, convertir a mayúsculas
    const input = event.target as HTMLInputElement;
    input.value = input.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    this.verificationCode = input.value;
  }

  isCodeValid(): boolean {
    return this.verificationCode.length === 6 && /^[A-Z0-9]{6}$/.test(this.verificationCode);
  }

  // Verificación por token habilitada - maneja enlaces de verificación

  verifyTokenAndRedirect(token: string): void {
    this.isVerifying = true;
    this.message = 'Verificando tu cuenta...';
    this.messageType = 'warning';

    // Llamada al backend para verificar el token
    this.http.post(`${environment.apiUrl}/auth/verify-email-token`, { token }).subscribe({
      next: (response: any) => {
        this.isVerifying = false;
        this.isVerified = true;
        this.message = '¡Cuenta verificada exitosamente!';
        this.messageType = 'success';
        
        // Redirigir de vuelta a la página de registro con estado verificado
        setTimeout(() => {
          this.router.navigate(['/donor/register'], {
            queryParams: { 
              verified: 'true', 
              email: this.userEmail,
              success: 'verification_completed'
            }
          });
        }, 2000);
      },
      error: (error: HttpErrorResponse) => {
        this.isVerifying = false;
        this.message = 'Error al verificar la cuenta. Intenta con el código manual.';
        this.messageType = 'error';
        
        // Mostrar formulario de código como alternativa
        setTimeout(() => {
          this.message = '';
          this.messageType = 'warning';
        }, 3000);
      }
    });
  }


  verifyCode(): void {
    if (!this.isCodeValid()) {
      this.message = 'Por favor ingresa un código válido de 6 caracteres';
      this.messageType = 'error';
      return;
    }

    this.isVerifying = true;
    this.message = 'Verificando código...';
    this.messageType = 'warning';

    // Llamada al backend para verificar el código
    this.http.post(`${environment.apiUrl}/auth/verify-email-code`, {
      email: this.userEmail,
      code: this.verificationCode
    }).subscribe({
      next: (response: any) => {
        this.isVerifying = false;
        this.isVerified = true;
        this.message = '¡Correo verificado exitosamente! Registro completado.';
        this.messageType = 'success';
        
        // Redirigir de vuelta a la página de registro con estado verificado
        setTimeout(() => {
          this.router.navigate(['/donor/register'], {
            queryParams: { 
              verified: 'true', 
              email: this.userEmail,
              success: 'verification_completed'
            }
          });
        }, 2000);
      },
      error: (error: HttpErrorResponse) => {
        this.isVerifying = false;
        this.handleVerificationError(error);
      }
    });
  }

  resendEmail(): void {
    if (this.resendCooldown > 0) {
      return;
    }

    if (!this.userEmail) {
      this.message = 'Error: No se encontró el correo electrónico';
      this.messageType = 'error';
      return;
    }

    this.isResending = true;
    this.message = '';

    this.http.post(`${environment.apiUrl}/auth/resend-verification-email`, {
      email: this.userEmail
    }).subscribe({
      next: (response: any) => {
        this.isResending = false;
        this.message = 'Correo de verificación reenviado exitosamente. Revisa tu bandeja de entrada.';
        this.messageType = 'success';
   
        this.startResendCooldown(60);
        
        // Limpiar mensaje después de 5 segundos
        setTimeout(() => {
          if (this.messageType === 'success') {
            this.message = '';
          }
        }, 5000);
      },
      error: (error: HttpErrorResponse) => {
        this.isResending = false;
        this.handleResendError(error);
      }
    });
  }

  private startResendCooldown(seconds: number): void {
    this.resendCooldown = seconds;
    this.cooldownInterval = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        clearInterval(this.cooldownInterval);
      }
    }, 1000);
  }

  getResendButtonText(): string {
    if (this.isResending) {
      return 'Reenviando...';
    }
    if (this.resendCooldown > 0) {
      return `Espera ${this.resendCooldown}s para reenviar`;
    }
    return 'Reenviar correo de verificación';
  }


  private handleVerificationError(error: HttpErrorResponse): void {
    let errorMessage = 'Error al verificar el código. Inténtalo de nuevo.';
    
    if (error.error && error.error.message) {
      errorMessage = error.error.message;
    } else if (error.status === 400) {
      errorMessage = 'Código de verificación inválido o expirado';
    } else if (error.status === 404) {
      errorMessage = 'Usuario no encontrado';
    } else if (error.status === 410) {
      errorMessage = 'El código ha expirado. Por favor solicita uno nuevo.';
    } else if (error.status === 0) {
      errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión.';
    }
    
    this.message = errorMessage;
    this.messageType = 'error';
  }

  private handleResendError(error: HttpErrorResponse): void {
    let errorMessage = 'Error al reenviar el correo. Inténtalo de nuevo.';
    
    if (error.error && error.error.message) {
      errorMessage = error.error.message;
    } else if (error.status === 429) {
      errorMessage = 'Demasiados intentos. Por favor espera unos minutos.';
    } else if (error.status === 404) {
      errorMessage = 'Usuario no encontrado';
    } else if (error.status === 0) {
      errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión.';
    }
    
    this.message = errorMessage;
    this.messageType = 'error';
  }

  goToHome(): void {
    this.router.navigate(['/']);
  }

  autoLogin(): void {
    // Simular login automático después de verificación
    // Simular almacenamiento de datos de usuario en localStorage
    const userData = {
      id: 'temp-user-id',
      email: this.userEmail,
      role: 'donor',
      name: this.userEmail.split('@')[0],
      verified: true,
      loginTime: new Date().toISOString()
    };
    
    localStorage.setItem('currentUser', JSON.stringify(userData));
    localStorage.setItem('isLoggedIn', 'true');
    
    // Redirigir al home después del login
    setTimeout(() => {
      this.router.navigate(['/']);
    }, 1000);
  }
}