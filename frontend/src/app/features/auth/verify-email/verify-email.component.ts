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
  lastResponse: any = null; // para depuración: mostrar la respuesta cruda del servidor
  lastRequest: any = null; // para depuración: mostrar la petición enviada
  verificationAttempted = false; // evita repetir la verificación automática

  constructor(private fb: FormBuilder, private emailVerification: EmailVerificationService, private route: ActivatedRoute, private router: Router) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      code: ['', [Validators.required]]
    });

    // Leer token desde diferentes fuentes (query param, snapshot, fragment o paramMap)
    this.route.queryParamMap.subscribe(qm => {
      const t = qm.get('token') || qm.get('t') || qm.get('verifyToken');
      if (t && !this.verificationAttempted) {
        this.token = t;
        this.verificationAttempted = true;
        // intentar verificar inmediatamente si viene token en la URL
        this.verifyWithToken(t);
      }
    });

  // fallback: revisar snapshot params y fragment
    if (!this.token && !this.verificationAttempted) {
      const snapT = this.route.snapshot.queryParamMap.get('token') || this.route.snapshot.queryParamMap.get('t');
      if (snapT) {
        this.token = snapT;
        this.verificationAttempted = true;
        this.verifyWithToken(snapT);
      }
    }
    if (!this.token && !this.verificationAttempted) {
      const p = this.route.snapshot.paramMap.get('token');
      if (p) {
        this.token = p;
        this.verificationAttempted = true;
        this.verifyWithToken(p);
      }
    }
    if (!this.token && !this.verificationAttempted && this.route.snapshot.fragment) {
      // si el token viene en el fragment (#token=...)
      const frag = this.route.snapshot.fragment;
      const m = frag?.match(/token=([^&]+)/);
      if (m && m[1]) {
        this.token = decodeURIComponent(m[1]);
        this.verificationAttempted = true;
        this.verifyWithToken(this.token);
      }
    }

    // último recurso: leer directamente desde window.location (search o hash)
    if (!this.token && !this.verificationAttempted && typeof window !== 'undefined') {
      try {
        const qs = window.location.search || '';
        if (qs) {
          const params = new URLSearchParams(qs);
          const t = params.get('token') || params.get('t') || params.get('verifyToken');
          if (t) {
            this.token = t;
            this.verificationAttempted = true;
            this.verifyWithToken(t);
          }
        }
        if (!this.token) {
          const frag = window.location.hash || '';
          const m = frag.match(/token=([^&]+)/);
          if (m && m[1]) {
            const t = decodeURIComponent(m[1]);
            this.token = t;
            this.verificationAttempted = true;
            this.verifyWithToken(t);
          }
        }
      } catch (e) {
        console.debug('Error leyendo token desde window.location', e);
      }
    }
  }

  /** Permite cambiar a la entrada manual del código (limpia token y muestra el formulario) */
  switchToManualEntry() {
    this.token = null;
    this.verifying = false;
    this.verified = false;
    this.errorMessage = null;
    this.infoMessage = null;
    this.lastResponse = null;
    this.verificationAttempted = true;
    this.form.reset();
    this.router.navigate(['/auth/verify-email'], { replaceUrl: true });
  }

  verifyWithToken(token: string) {
    this.verifying = true;
    this.errorMessage = null;
    this.infoMessage = null;
    this.lastResponse = null;
    this.lastRequest = { url: `${this.emailVerification['baseUrl']}/verify-email-token`, body: { token } };
    
    this.emailVerification.verifyEmailToken(token).subscribe({
      next: (res) => {
        this.verifying = false;
        this.verified = true;
        this.lastResponse = res;
        this.infoMessage = res?.message || 'Email verificado correctamente.';
      },
      error: (err) => {
        this.verifying = false;
        this.verified = false;
        this.lastResponse = err?.error || err;
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

  goToLogin() {
    this.router.navigate(['/auth/login']);
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
    this.lastResponse = null;
    this.lastRequest = { url: `${this.emailVerification['baseUrl']}/verify/email`, body: { email, code } };
    
    this.emailVerification.verifyEmail(email, code).subscribe({
      next: (res) => {
        this.loading = false;
        this.verified = true;
        this.lastResponse = res;
        this.infoMessage = res?.message || 'Email verificado correctamente.';
      },
      error: (err) => {
        this.loading = false;
        this.lastResponse = err?.error || err;
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
