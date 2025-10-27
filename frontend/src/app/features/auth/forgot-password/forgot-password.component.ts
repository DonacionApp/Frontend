import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss']
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
