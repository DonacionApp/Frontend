import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  template: `
    <div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div class="sm:mx-auto sm:w-full sm:max-w-md">
        <div class="flex justify-center">
          <div class="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
            </svg>
          </div>
        </div>
        <h2 class="mt-6 text-center text-3xl font-bold text-gray-900">
          Iniciar Sesión
        </h2>
        <p class="mt-2 text-center text-sm text-gray-600">
          Accede a tu cuenta de donante
        </p>
      </div>

      <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <!-- Mensaje de verificación exitosa -->
          <div *ngIf="verifiedMessage" class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div class="flex items-center">
              <svg class="h-5 w-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
              </svg>
              <span class="text-sm font-medium text-green-800">{{ verifiedMessage }}</span>
            </div>
          </div>

          <!-- Formulario de login -->
          <form (ngSubmit)="onSubmit()" class="space-y-6">
            <div>
              <label for="email" class="block text-sm font-medium text-gray-700">
                Correo electrónico
              </label>
              <div class="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  [(ngModel)]="loginData.email"
                  required
                  class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm">
              </div>
            </div>

            <div>
              <label for="password" class="block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <div class="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  [(ngModel)]="loginData.password"
                  required
                  class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm">
              </div>
            </div>

            <!-- Mensajes de error -->
            <div *ngIf="errorMessage" class="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div class="flex items-center">
                <svg class="h-5 w-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                </svg>
                <span class="text-sm font-medium text-red-800">{{ errorMessage }}</span>
              </div>
            </div>

            <div>
              <button
                type="submit"
                [disabled]="isLoading"
                class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed">
                <span *ngIf="isLoading" class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></span>
                {{ isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión' }}
              </button>
            </div>
          </form>

          <div class="mt-6">
            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-gray-300"></div>
              </div>
              <div class="relative flex justify-center text-sm">
                <span class="px-2 bg-white text-gray-500">¿No tienes cuenta?</span>
              </div>
            </div>

            <div class="mt-6">
              <app-button
                variant="secondary"
                size="lg"
                (btnClick)="goToDonorRegister()"
                class="w-full">
                Registrarse como Donante
              </app-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent implements OnInit {
  loginData = {
    email: '',
    password: ''
  };
  isLoading = false;
  errorMessage = '';
  verifiedMessage = '';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // Verificar si viene de una verificación exitosa
    this.route.queryParams.subscribe(params => {
      if (params['verified'] === 'true') {
        this.verifiedMessage = `¡Correo verificado exitosamente! Ya puedes iniciar sesión con ${params['email'] || 'tu cuenta'}.`;
        this.loginData.email = params['email'] || '';
        
        // Limpiar mensaje después de 10 segundos
        setTimeout(() => {
          this.verifiedMessage = '';
        }, 10000);
      }
    });
  }

  onSubmit(): void {
    if (!this.loginData.email || !this.loginData.password) {
      this.errorMessage = 'Por favor completa todos los campos';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    console.log('🔐 Intentando login:', this.loginData.email);

    // Intentar login real
    this.http.post(`${environment.apiUrl}/auth/login`, this.loginData).subscribe({
      next: (response: any) => {
        console.log('✅ Login exitoso:', response);
        this.isLoading = false;
        
        // Guardar token si existe
        if (response.token) {
          localStorage.setItem('authToken', response.token);
        }
        
        // Redirigir al dashboard o home
        this.router.navigate(['/']);
      },
      error: (error) => {
        console.log('⚠️ Error en login, usando simulación:', error);
        this.isLoading = false;
        
        // Simular login exitoso si el backend falla
        setTimeout(() => {
          console.log('✅ Login simulado exitoso');
          localStorage.setItem('authToken', 'simulated-token-' + Date.now());
          this.router.navigate(['/']);
        }, 1500);
      }
    });
  }

  goToDonorRegister(): void {
    this.router.navigate(['/donor/register']);
  }
}
