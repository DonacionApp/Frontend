import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-account-verified',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full space-y-8">
        <div class="text-center">
          <!-- Icono de éxito -->
          <div class="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mb-6">
            <svg class="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          
          <!-- Título principal -->
          <h2 class="text-3xl font-bold text-gray-900 mb-2">
            ¡Cuenta Verificada!
          </h2>
          
          <!-- Subtítulo -->
          <p class="text-lg text-gray-600 mb-8">
            Tu cuenta ha sido verificada exitosamente
          </p>
        </div>

        <!-- Información del usuario -->
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
          <div class="text-center">
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
              <p class="text-lg font-semibold text-green-900">{{ userEmail }}</p>
            </div>

            <div class="text-sm text-gray-600 space-y-2">
              <p>✅ Tu cuenta está activa</p>
              <p>✅ Puedes acceder a la plataforma</p>
              <p>✅ Tu registro está completo</p>
            </div>
          </div>
        </div>

        <!-- Botón de acción -->
        <div class="text-center">
          <button 
            (click)="autoLogin()"
            class="w-full flex justify-center py-4 px-6 border border-transparent rounded-lg shadow-sm text-lg font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200">
            <svg class="h-6 w-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            Iniciar Sesión
          </button>
        </div>

        <!-- Información adicional -->
        <div class="text-center">
          <div class="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p class="text-sm text-green-800">
              <strong>Nota:</strong> Haz clic en "Iniciar Sesión" para acceder a la plataforma.
            </p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class AccountVerifiedComponent implements OnInit {
  userEmail: string = '';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Obtener email de los query params
    this.route.queryParams.subscribe(params => {
      this.userEmail = params['email'] || 'usuario@ejemplo.com';
    });
  }

  autoLogin(): void {
    // Simular login automático después de verificación
    // En un sistema real, aquí se haría una llamada al backend para obtener el token
  // auto login for verified account (simulated)
    
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
    
    // Usuario logueado exitosamente - mantener en la página actual
  // Usuario logueado exitosamente (simulado)
    
    // Prevenir cualquier navegación automática
    // no-op timeout for UI stability
    setTimeout(() => {}, 1000);
  }
}
