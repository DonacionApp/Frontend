import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const pw = control.get('newPassword')?.value;
  const pw2 = control.get('confirmPassword')?.value;
  return pw && pw2 && pw !== pw2 ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-verify-reset-token',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div class="bg-white p-8 rounded shadow max-w-md w-full">
        <a routerLink="/auth/login" class="text-sm text-gray-500 hover:underline">← Volver</a>
        <h2 class="text-2xl font-bold mb-2 mt-4">Restablecer contraseña</h2>

        <div *ngIf="verifying" class="text-sm text-gray-600 mb-4">Verificando enlace...</div>

        <div *ngIf="tokenInvalid" class="bg-red-50 border border-red-100 p-3 rounded text-sm text-red-700 mb-3">
          {{ tokenErrorMessage || 'El enlace de restablecimiento no es válido o expiró.' }}
        </div>

        <form *ngIf="!tokenInvalid && verified" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <label class="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
          <input formControlName="newPassword" type="password" class="w-full border rounded px-3 py-2 mb-2" placeholder="Nueva contraseña" />
          <div *ngIf="form.get('newPassword')?.touched && form.get('newPassword')?.invalid" class="text-xs text-red-600 mb-2">
            <div *ngIf="form.get('newPassword')?.errors?.['required']">La contraseña es requerida.</div>
            <div *ngIf="form.get('newPassword')?.errors?.['minlength']">Mínimo 6 caracteres.</div>
          </div>

          <label class="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
          <input formControlName="confirmPassword" type="password" class="w-full border rounded px-3 py-2 mb-2" placeholder="Confirma la contraseña" />
          <div *ngIf="form.errors?.['passwordMismatch'] && (form.get('confirmPassword')?.touched || form.get('newPassword')?.touched)" class="text-xs text-red-600 mb-2">
            Las contraseñas no coinciden.
          </div>

          <div *ngIf="infoMessage" class="bg-blue-50 border border-blue-100 p-3 rounded text-sm text-blue-700 mb-3">{{ infoMessage }}</div>
          <div *ngIf="errorMessage" class="bg-red-50 border border-red-100 p-3 rounded text-sm text-red-700 mb-3">{{ errorMessage }}</div>

          <button type="submit" [disabled]="form.invalid || loading" class="w-full bg-green-500 text-white py-2 rounded hover:opacity-90 disabled:opacity-60">
            <span *ngIf="!loading">Restablecer contraseña</span>
            <span *ngIf="loading">Procesando...</span>
          </button>
        </form>

        <div *ngIf="!verified && !verifying && !tokenInvalid" class="text-sm text-gray-600 mt-2">Si no ves el formulario, revisa el enlace que recibiste por correo.</div>
      </div>
    </div>
  `
})
export class VerifyResetTokenComponent {
  form: any;
  loading = false;
  verifying = true;
  verified = false;
  token: string | null = null;
  tokenInvalid = false;
  tokenErrorMessage: string | null = null;
  infoMessage: string | null = null;
  errorMessage: string | null = null;

  constructor(private fb: FormBuilder, private auth: AuthService, private route: ActivatedRoute, private router: Router) {
    this.form = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: passwordMatchValidator });

    // Leer token desde query param si viene en la URL
    this.route.queryParamMap.subscribe(qm => {
      const t = qm.get('token');
      this.token = t;
      if (this.token) {
        // No verificamos automáticamente en carga para evitar llamar a un endpoint que puede no existir.
        // En su lugar mostramos el formulario y delegamos la verificación/consumo del token al envío (resetWithToken),
        // que ya intenta el endpoint que has mostrado en Postman.
        this.verifying = false;
        this.verified = true;
      } else {
        this.verifying = false;
        this.verified = false;
        this.tokenInvalid = true;
        this.tokenErrorMessage = 'No se encontró token en la URL.';
      }
    });
  }

  private verifyToken(token: string) {
    this.verifying = true;
    this.auth.verifyResetToken(token).subscribe({
      next: (res) => {
        // Si el backend responde OK, consideramos el token válido
        this.verifying = false;
        this.verified = true;
      },
      error: (err) => {
        this.verifying = false;
        this.verified = false;
        this.tokenInvalid = true;
        const msg = err?.error?.message || (err?.status === 410 ? 'El token ha expirado.' : 'Token inválido.');
        this.tokenErrorMessage = msg;
      }
    });
  }

  submit() {
    if (this.form.invalid || !this.token) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.infoMessage = null;
    this.errorMessage = null;

    const newPassword = String(this.form.get('newPassword')?.value || '');

    // Intentar reset usando el endpoint que acepta token + newPassword
    this.auth.resetWithToken(this.token, newPassword).subscribe({
      next: (res) => {
        this.loading = false;
        this.infoMessage = res?.message || 'Contraseña restablecida correctamente.';
        // redirigir al login tras breve delay
        setTimeout(() => this.router.navigate(['/auth/login']), 1400);
      },
      error: (err) => {
        this.loading = false;
        // el backend a veces devuelve HTML o texto; manejar ambos casos
        const body = err?.error;
        let msg = 'No se pudo restablecer la contraseña.';
        if (body) {
          if (typeof body === 'string') {
            // eliminar tags HTML para mostrar un texto legible
            msg = body.replace(/<[^>]*>/g, '').trim().slice(0, 400) || msg;
          } else if (body?.message) {
            msg = body.message;
          }
        }
        this.errorMessage = msg;
        if (err?.status === 410 || /expir/i.test(msg)) {
          this.tokenInvalid = true;
        }
      }
    });
  }
}
