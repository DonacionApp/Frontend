import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { AuthService } from '../../../core/services/auth.service';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ButtonComponent],
  template: `
    <div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div class="sm:mx-auto sm:w-full sm:max-w-md text-center">
  <div class="flex flex-col justify-center items-center">
          <div class="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mx-auto">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
            </svg>
          </div>
        
        <h2 class="mt-4 text-3xl font-bold text-gray-900">Iniciar Sesión</h2>
        <p class="mt-2 text-center text-sm text-gray-600">Accede a tu cuenta para continuar</p>
      </div>

      <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">

            <div>
              <label class="block text-sm font-medium text-gray-700">Correo Electrónico</label>
              <div class="mt-1">
                <input formControlName="email" type="email" placeholder="tu@email.com" class="appearance-none block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm bg-gray-50" />
              </div>
              <p *ngIf="email.invalid && (email.dirty || email.touched)" class="text-xs text-red-600 mt-1">{{ emailError }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Contraseña</label>
              <div class="mt-1 relative">
                <input formControlName="password" [type]="showPassword ? 'text' : 'password'" placeholder="Tu contraseña" class="appearance-none block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm bg-gray-50" />
                <button type="button" aria-label="Mostrar contraseña" (click)="toggleShowPassword()" class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">
                  <svg *ngIf="!showPassword" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <svg *ngIf="showPassword" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.956 9.956 0 012.223-3.592M6.12 6.12A9.956 9.956 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.964 9.964 0 01-4.133 5.21M3 3l18 18" />
                  </svg>
                </button>
              </div>
              <p *ngIf="password.invalid && (password.dirty || password.touched)" class="text-xs text-red-600 mt-1">La contraseña es requerida (mínimo 4 caracteres)</p>
            </div>

            <div *ngIf="serverMessage" class="text-sm text-red-600 text-center">{{ serverMessage }}</div>

            <div class="text-center">
              <a routerLink="/auth/forgot-password" class="text-sm text-green-600 hover:underline">Has olvidado la contraseña?</a>
            </div>

            <div>
              <app-button [disabled]="isSubmitting || isLocked" variant="primary" size="lg" class="w-full" (btnClick)="onSubmit()">
                <span *ngIf="!isSubmitting">Iniciar Sesión</span>
                <span *ngIf="isSubmitting">Iniciando...</span>
              </app-button>
            </div>

            <div class="text-center text-xs text-gray-400">
              <div>CUENTAS DE DEMOSTRACIÓN</div>
              <div class="mt-2"><a class="text-green-600 hover:underline" routerLink="/auth/register">¿No tienes cuenta? Regístrate aquí</a></div>
            </div>
          </form>
          <div *ngIf="isLocked" class="mt-4 text-center text-sm text-yellow-600">Cuenta bloqueada temporalmente. Intenta en {{ remainingLockSeconds }} s.</div>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent implements OnDestroy {
  form!: FormGroup;

  isSubmitting = false;
  serverMessage = '';
  isLocked = false;
  remainingLockSeconds = 0;
  showPassword = false;

  private timerSub?: Subscription;
  private sub = new Subscription();

  constructor(
    private router: Router,
    private fb: FormBuilder,
    private auth: AuthService
  ) {
    // Inicializar el formulario aquí para evitar usar `fb` antes de inicializar
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(4)]]
    });
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

    this.isSubmitting = true;
    const email = this.email.value || '';
    const password = this.password.value || '';

    this.sub.add(
      this.auth.login(email, password).subscribe({
        next: (res) => {
          this.isSubmitting = false;
          // Redirigir según rol (tomado desde AuthService -> currentUserValue)
          const user = this.auth.currentUserValue;
          if (user?.role === 'admin') {
            this.router.navigate(['/admin']);
          } else if (user?.role === 'organization') {
            this.router.navigate(['/organization']);
          } else {
            this.router.navigate(['/']);
          }
        },
        error: (err) => {
          this.isSubmitting = false;
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
