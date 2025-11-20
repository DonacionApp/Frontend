import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../../shared/components/button/button.component';

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
        <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
          <div class="flex gap-4 justify-center mb-6">
            <app-button
              variant="primary"
              size="lg"
              (btnClick)="goToUserRegister()"
              class="w-36">
              Usuario
            </app-button>

            <app-button
              variant="secondary"
              size="lg"
              (btnClick)="goToOrganizationRegister()"
              class="w-36">
              Organización
            </app-button>
          </div>

          <div class="text-sm text-gray-600 mb-4">
            Si eliges "Usuario" serás redirigido al formulario de registro de usuarios. Si eliges "Organización" irás al registro para organizaciones.
          </div>

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
  constructor(private router: Router) {}

  goHome(): void {
    this.router.navigate(['/']);
  }

  goToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  goToUserRegister(): void {
    // Navigate to the auth module's register route
    this.router.navigate(['/auth/register']);
  }

  goToOrganizationRegister(): void {
    // Navigate to the organization register route
    this.router.navigate(['/organization/register']);
  }
}
