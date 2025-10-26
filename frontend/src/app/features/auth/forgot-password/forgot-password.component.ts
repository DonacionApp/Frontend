import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div class="bg-white p-8 rounded shadow max-w-md w-full text-center">
        <h2 class="text-2xl font-bold mb-2">Recuperar contraseña</h2>
        <p class="text-sm text-gray-600 mb-6">Funcionalidad en desarrollo. Si quieres, contacta con soporte para restablecer tu contraseña.</p>
        <a routerLink="/auth/login" class="text-green-600 hover:underline">Volver al inicio de sesión</a>
      </div>
    </div>
  `
})
export class ForgotPasswordComponent {}
