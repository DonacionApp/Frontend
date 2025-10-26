import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div class="bg-white p-8 rounded shadow max-w-md w-full">
        <a routerLink="/auth/login" class="text-sm text-gray-500 hover:underline">← Volver</a>
        <h2 class="text-2xl font-bold mb-2 mt-4">¿Olvidaste tu contraseña?</h2>
        <p class="text-sm text-gray-600 mb-6">No te preocupes. Ingresa tu correo electrónico y te enviaremos instrucciones para restablecer tu contraseña.</p>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <label class="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
          <div class="mb-3">
            <input formControlName="email" type="email" placeholder="tucorreo@ejemplo.com" class="w-full border rounded px-3 py-2 bg-gray-50" />
            <div *ngIf="email.touched && email.invalid" class="text-xs text-red-600 mt-1">
              <div *ngIf="email.errors?.['required']">El correo es requerido.</div>
              <div *ngIf="email.errors?.['email']">Ingresa un correo válido.</div>
            </div>
          </div>

          <div *ngIf="infoMessage" class="bg-blue-50 border border-blue-100 p-3 rounded text-sm text-blue-700 mb-3">
            {{ infoMessage }}
          </div>

          <div *ngIf="errorMessage" class="bg-red-50 border border-red-100 p-3 rounded text-sm text-red-700 mb-3">
            {{ errorMessage }}
          </div>

          <button type="submit" [disabled]="form.invalid || loading" class="w-full bg-green-500 text-white py-2 rounded hover:opacity-90 disabled:opacity-60">
            <span *ngIf="!loading">📧 Enviar instrucciones</span>
            <span *ngIf="loading">Enviando...</span>
          </button>
        </form>

        <div class="text-center mt-4 text-sm text-gray-600">
          ¿Recordaste tu contraseña? <a routerLink="/auth/login" class="text-green-600 hover:underline">Inicia sesión</a>
        </div>
      </div>
    </div>
  `
})
export class ForgotPasswordComponent {
  form: any;

  loading = false;
  infoMessage: string | null = null;
  errorMessage: string | null = null;

  constructor(private fb: FormBuilder, private auth: AuthService) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  get email() {
    return this.form.get('email')!;
  }

  submit() {
    this.infoMessage = null;
    this.errorMessage = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
  const email = String(this.email.value || '');
  this.auth.forgotPassword(email).subscribe({
      next: (res) => {
        this.loading = false;
        // Mensaje del backend o mensaje por defecto
        this.infoMessage = res?.message || 'Instrucciones para restablecer la contraseña enviadas al correo electrónico.';
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Ocurrió un error al enviar las instrucciones. Intenta nuevamente.';
      }
    });
  }
}
