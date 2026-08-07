import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { AuthService } from '../../../core/services/auth.service';
import { RecaptchaService } from '../../../core/services/recaptcha.service';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ButtonComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements AfterViewInit, OnDestroy {
  form!: FormGroup;

  isSubmitting = false;
  serverMessage = '';
  isLocked = false;
  remainingLockSeconds = 0;
  showPassword = false;

  @ViewChild('recaptchaContainer') recaptchaContainer?: ElementRef<HTMLDivElement>;
  captchaRequired = false;
  captchaToken: string | null = null;
  private captchaWidgetId: number | null = null;

  private timerSub?: Subscription;
  private sub = new Subscription();

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private recaptcha: RecaptchaService,
    private cd: ChangeDetectorRef
  ) {
    // Inicializar el formulario aquí para evitar usar `fb` antes de inicializar
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(4)]]
    });
  }

  async ngAfterViewInit(): Promise<void> {
    if (!this.recaptcha.isEnabled || !this.recaptchaContainer) return;

    this.captchaWidgetId = await this.recaptcha.render(this.recaptchaContainer.nativeElement, {
      onToken: (token) => {
        this.captchaToken = token;
        this.serverMessage = '';
        this.cd.detectChanges();
      },
      onExpired: () => {
        this.captchaToken = null;
        this.cd.detectChanges();
      },
      onError: () => {
        this.captchaToken = null;
        this.cd.detectChanges();
      }
    });

    this.captchaRequired = this.captchaWidgetId !== null;
    this.cd.detectChanges();
  }

  get email() { return this.form.get('email')!; }
  get password() { return this.form.get('password')!; }

  get emailError(): string {
    if (this.email.hasError('required')) return 'El email es requerido.';
    if (this.email.hasError('email')) return 'email must be an email';
    return '';
  }

  

  onSubmit(): void {
    this.serverMessage = '';
    if (this.isLocked) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.captchaRequired && !this.captchaToken) {
      this.serverMessage = 'Por favor confirma que no eres un robot.';
      return;
    }

    this.isSubmitting = true;
    const email = this.email.value || '';
    const password = this.password.value || '';

    this.sub.add(
      this.auth.login(email, password, this.captchaToken || undefined).subscribe({
        next: (res) => {
          this.isSubmitting = false;
          this.auth.redirectAfterLogin();
        },
        error: (err) => {
          this.isSubmitting = false;
          this.resetCaptcha();
          const status = err.status;
          const message = err.error?.message || err.message || 'Error en la autenticación.';
          if (status === 400) {
            // email inválido -> mostrar mensaje específico
            this.serverMessage = Array.isArray(message) ? message.join(', ') : message;
          } else if (status === 401) {
            // credenciales inválidas o cuenta bloqueada
            this.serverMessage = message;
            const lower = (message || '').toLowerCase();
            if (lower.includes('bloquead') || lower.includes('intenta en')) {
              // bloquear UI por 5 minutos o por tiempo indicado
              this.startLockCountdown(300);
            }
          } else if (status === 429) {
            this.serverMessage = message || 'Demasiados intentos. Intenta más tarde.';
            this.startLockCountdown(300);
          } else {
            this.serverMessage = message;
          }
        }
      })
    );
  }

  private resetCaptcha(): void {
    if (!this.captchaRequired) return;
    this.captchaToken = null;
    this.recaptcha.reset(this.captchaWidgetId);
  }

  loginWithGoogle(): void {
    this.auth.startSocialLogin('google');
  }

  loginWithMicrosoft(): void {
    this.auth.startSocialLogin('microsoft');
  }

  toggleShowPassword(): void {
    this.showPassword = !this.showPassword;
  }

  startLockCountdown(seconds: number) {
    this.isLocked = true;
    this.remainingLockSeconds = seconds;
    if (this.timerSub) { this.timerSub.unsubscribe(); }
    this.timerSub = interval(1000).subscribe(() => {
      this.remainingLockSeconds = Math.max(0, this.remainingLockSeconds - 1);
      if (this.remainingLockSeconds <= 0) {
        this.isLocked = false;
        this.timerSub?.unsubscribe();
      }
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.timerSub?.unsubscribe();
  }
}
