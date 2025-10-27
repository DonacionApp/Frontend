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
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
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
