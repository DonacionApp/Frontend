import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../../shared/components/button/button.component';

type AccountType = 'user' | 'organization' | null;

@Component({
  selector: 'app-donor-register',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  template: `
    <div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div class="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 class="mt-6 text-center text-3xl font-bold text-gray-900">Registro</h2>
        <p class="mt-2 text-center text-sm text-gray-600">Elige tu tipo de cuenta para continuar</p>
      </div>

      <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <!-- Botones de selección -->
          <div class="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <button
              type="button"
              (click)="selectAccountType('user')"
              [class]="getButtonClasses('user')"
              class="flex-1 sm:flex-none sm:w-36 py-3 px-6 rounded-lg font-medium text-base transition-all duration-300 hover:shadow-md">
              Usuario
            </button>

            <button
              type="button"
              (click)="selectAccountType('organization')"
              [class]="getButtonClasses('organization')"
              class="flex-1 sm:flex-none sm:w-36 py-3 px-6 rounded-lg font-medium text-base transition-all duration-300 hover:shadow-md">
              Organización
            </button>
          </div>

          <!-- Texto de ayuda dinámico -->
          <div class="text-sm text-gray-600 mb-6 text-center min-h-[3rem]">
            <p *ngIf="selectedAccountType === 'user'">
              Si eliges "Usuario" serás redirigido al formulario de registro de usuarios.
            </p>
            <p *ngIf="selectedAccountType === 'organization'">
              Si eliges "Organización" irás al registro para organizaciones.
            </p>
            <p *ngIf="!selectedAccountType">
              Selecciona un tipo de cuenta para continuar con el registro.
            </p>
          </div>

          <!-- Botones de acción -->
          <div class="space-y-4">
            <app-button variant="ghost" size="md" (btnClick)="goHome()" class="w-full">Volver al Inicio</app-button>
            <app-button variant="secondary" size="md" (btnClick)="goToLogin()" class="w-full">Iniciar Sesión</app-button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class DonorRegisterComponent {
  selectedAccountType: AccountType = null;

  constructor(private router: Router) {}

  selectAccountType(type: 'user' | 'organization'): void {
    this.selectedAccountType = type;
    
    // Navegar automáticamente después de seleccionar
    if (type === 'user') {
      this.goToUserRegister();
    } else if (type === 'organization') {
      this.goToOrganizationRegister();
    }
  }

  getButtonClasses(type: 'user' | 'organization'): string {
    const isActive = this.selectedAccountType === type;
    
    if (type === 'user') {
      return isActive
        ? 'bg-green-600 text-white border-2 border-green-600'
        : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-green-500';
    } else {
      return isActive
        ? 'bg-green-600 text-white border-2 border-green-600'
        : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-green-500';
    }
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  goToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  goToUserRegister(): void {
    this.router.navigate(['/register/donor']);
  }

  goToOrganizationRegister(): void {
    this.router.navigate(['/register/organization']);
  }
}
