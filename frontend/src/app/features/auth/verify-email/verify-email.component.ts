import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { EmailVerificationService } from '../../../core/services/email-verification.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './verify-email.component.html',
  styleUrls: ['./verify-email.component.scss']
})
export class VerifyEmailComponent {
  form: any;
  loading = false;
  verifying = false;
  verified = false;
  token: string | null = null;
  errorMessage: string | null = null;
  infoMessage: string | null = null;

  constructor(private fb: FormBuilder, private emailVerification: EmailVerificationService, private route: ActivatedRoute, private router: Router) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      code: ['', [Validators.required]]
    });

    this.route.queryParamMap.subscribe(qm => {
      const t = qm.get('token');
      if (t) {
        this.token = t;
        // intentar verificar inmediatamente si viene token en la URL
        this.verifyWithToken(t);
      }
    });
  }

  private verifyWithToken(token: string) {
    this.verifying = true;
    this.errorMessage = null;
    this.infoMessage = null;
  this.emailVerification.verifyEmailToken(token).subscribe({
      next: (res) => {
        this.verifying = false;
        this.verified = true;
        this.infoMessage = res?.message || 'Email verificado correctamente.';
        // redirigir al login en breve
        setTimeout(() => this.router.navigate(['/auth/login']), 1400);
      },
      error: (err) => {
        this.verifying = false;
        this.verified = false;
        const body = err?.error;
        let msg = 'No se pudo verificar el email.';
        if (body) {
          if (typeof body === 'string') {
            msg = body.replace(/<[^>]*>/g, '').trim().slice(0, 400) || msg;
          } else if (body?.message) {
            msg = body.message;
          }
        }
        this.errorMessage = msg;
      }
    });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const email = String(this.form.get('email')?.value || '').trim();
    const code = String(this.form.get('code')?.value || '').trim();

    this.loading = true;
    this.errorMessage = null;
    this.infoMessage = null;

  this.emailVerification.verifyEmailCode(email, code).subscribe({
      next: (res) => {
        this.loading = false;
        this.verified = true;
        this.infoMessage = res?.message || 'Email verificado correctamente.';
        setTimeout(() => this.router.navigate(['/auth/login']), 1200);
      },
      error: (err) => {
        this.loading = false;
        const body = err?.error;
        let msg = 'Código inválido o no se pudo verificar.';
        if (body) {
          if (typeof body === 'string') {
            msg = body.replace(/<[^>]*>/g, '').trim().slice(0, 400) || msg;
          } else if (body?.message) {
            msg = body.message;
          }
        }
        this.errorMessage = msg;
      }
    });
  }
}
