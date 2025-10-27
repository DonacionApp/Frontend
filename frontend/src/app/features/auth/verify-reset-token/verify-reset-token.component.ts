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
  templateUrl: './verify-reset-token.component.html',
  styleUrls: ['./verify-reset-token.component.scss']
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
