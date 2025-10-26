import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const pw = control.get('password')?.value;
  const pw2 = control.get('passwordConfirm')?.value;
  return pw && pw2 && pw !== pw2 ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div class="bg-white p-8 rounded shadow max-w-md w-full">
        <a routerLink="/auth/login" class="text-sm text-gray-500 hover:underline">← Volver</a>
        <h2 class="text-2xl font-bold mb-2 mt-4">Restablecer contraseña</h2>

        <div *ngIf="tokenInvalid" class="bg-red-50 border border-red-100 p-3 rounded text-sm text-red-700 mb-3">
          El enlace de restablecimiento no es válido o expiró. Solicita uno nuevo en la página de recuperación.
        </div>

        <form *ngIf="!tokenInvalid" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <label class="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
          <input formControlName="password" type="password" class="w-full border rounded px-3 py-2 mb-2" />
          <div *ngIf="form.get('password')?.touched && form.get('password')?.invalid" class="text-xs text-red-600 mb-2">
            <div *ngIf="form.get('password')?.errors?.['required']">La contraseña es requerida.</div>
            <div *ngIf="form.get('password')?.errors?.['minlength']">Mínimo 8 caracteres.</div>
          </div>

          <label class="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
          <input formControlName="passwordConfirm" type="password" class="w-full border rounded px-3 py-2 mb-2" />
          <div *ngIf="form.errors?.['passwordMismatch'] && (form.get('passwordConfirm')?.touched || form.get('password')?.touched)" class="text-xs text-red-600 mb-2">
            Las contraseñas no coinciden.
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
export class ResetPasswordComponent {
  form: any;
  loading = false;
  token: string | null = null;
  tokenInvalid = false;
  infoMessage: string | null = null;
  errorMessage: string | null = null;

  constructor(private fb: FormBuilder, private route: ActivatedRoute, private auth: AuthService, private router: Router) {
    this.form = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      passwordConfirm: ['', [Validators.required]]
    }, { validators: passwordMatchValidator });

    this.route.paramMap.subscribe(pm => {
      this.token = pm.get('token');
      if (!this.token) {
        this.tokenInvalid = true;
      }
    });
  }

  submit() {
    if (this.form.invalid || !this.token) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    const password = String(this.form.get('password')?.value || '');
    this.auth.resetPassword(this.token, password).subscribe({
      next: (res) => {
        this.loading = false;
        this.infoMessage = res?.message || 'Contraseña restablecida correctamente. Ahora puedes iniciar sesión.';
        // opcional: redirigir al login después de un pequeño delay
        setTimeout(() => this.router.navigate(['/auth/login']), 1500);
      },
      error: (err) => {
        this.loading = false;
        // si backend responde que token es inválido/expirado
        const msg = err?.error?.message || 'No se pudo restablecer la contraseña.';
        this.errorMessage = msg;
        if (err?.status === 400 || err?.status === 410 || /expir/i.test(msg)) {
          this.tokenInvalid = true;
        }
      }
    });
  }
}
