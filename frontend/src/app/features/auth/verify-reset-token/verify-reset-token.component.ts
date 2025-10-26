import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-verify-reset-token',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div class="bg-white p-8 rounded shadow max-w-md w-full">
        <a routerLink="/auth/login" class="text-sm text-gray-500 hover:underline">← Volver</a>
        <h2 class="text-2xl font-bold mb-2 mt-4">Ingresa el código de tu correo</h2>
        <p class="text-sm text-gray-600 mb-4">Revisa tu correo y pega el código (o token) que recibiste. Algunas implementaciones permiten enviar el código y la nueva contraseña en un solo paso.</p>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <label class="block text-sm font-medium text-gray-700 mb-1">Código / token</label>
          <input formControlName="code" type="text" class="w-full border rounded px-3 py-2 mb-2" placeholder="QISHJK o token largo" />
          <div *ngIf="form.get('code')?.touched && form.get('code')?.invalid" class="text-xs text-red-600 mb-2">
            <div *ngIf="form.get('code')?.errors?.['required']">El código es requerido.</div>
          </div>

          <label class="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
          <input formControlName="newPassword" type="password" class="w-full border rounded px-3 py-2 mb-2" placeholder="Nueva contraseña" />
          <div *ngIf="form.get('newPassword')?.touched && form.get('newPassword')?.invalid" class="text-xs text-red-600 mb-2">
            <div *ngIf="form.get('newPassword')?.errors?.['required']">La contraseña es requerida.</div>
            <div *ngIf="form.get('newPassword')?.errors?.['minlength']">Mínimo 6 caracteres.</div>
          </div>

          <div *ngIf="infoMessage" class="bg-blue-50 border border-blue-100 p-3 rounded text-sm text-blue-700 mb-3">{{ infoMessage }}</div>
          <div *ngIf="errorMessage" class="bg-red-50 border border-red-100 p-3 rounded text-sm text-red-700 mb-3">{{ errorMessage }}</div>

          <button type="submit" [disabled]="form.invalid || loading" class="w-full bg-green-500 text-white py-2 rounded hover:opacity-90 disabled:opacity-60">
            <span *ngIf="!loading">Restablecer contraseña</span>
            <span *ngIf="loading">Procesando...</span>
          </button>
        </form>
      </div>
    </div>
  `
})
export class VerifyResetTokenComponent {
  form: any;
  loading = false;
  infoMessage: string | null = null;
  errorMessage: string | null = null;

  constructor(private fb: FormBuilder, private auth: AuthService) {
    this.form = this.fb.group({
      code: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.infoMessage = null;
    this.errorMessage = null;

    const code = String(this.form.get('code')?.value || '');
    const newPassword = String(this.form.get('newPassword')?.value || '');

    // Intentamos el flujo en un solo paso (endpoint /auth/reset-password-token acepta token + newPassword)
    this.auth.resetWithToken(code, newPassword).subscribe({
      next: (res) => {
        this.loading = false;
        this.infoMessage = res?.message || 'Contraseña restablecida correctamente.';
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Error al restablecer la contraseña. Revisa el código o inténtalo nuevamente.';
      }
    });
  }
}
