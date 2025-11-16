import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ModalComponent } from '../modal/modal.component';

@Component({
  selector: 'app-session-problem-modal',
  standalone: true,
  imports: [CommonModule, ModalComponent],
  template: `
    <app-modal
      [isOpen]="isOpen"
      title="Problema de Sesión"
      [size]="'md'"
      [showCloseButton]="false"
      [closeOnBackdropClick]="false"
    >
      <div class="space-y-4">
        <div class="flex items-start gap-4">
          <div class="flex-shrink-0">
            <div class="w-10 h-10 rounded-full flex items-center justify-center bg-red-100">
              <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-medium text-gray-900 mb-2">Tu sesión ha expirado</h3>
            <p class="text-sm text-gray-600 mb-4">
              {{ message || 'Tu sesión ha expirado o no es válida. Por favor, inicia sesión nuevamente para continuar.' }}
            </p>
            <div *ngIf="countdown > 0" class="text-xs text-gray-500 mb-4">
              Serás redirigido automáticamente en {{ countdown }} segundo{{ countdown > 1 ? 's' : '' }}...
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            (click)="onLogoutClick()"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Cerrar Sesión
          </button>
          <button
            type="button"
            (click)="onLoginClick()"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Iniciar Sesión
          </button>
        </div>
      </div>
    </app-modal>
  `
})
export class SessionProblemModalComponent {
  @Input() isOpen: boolean = false;
  @Input() message: string = '';
  @Input() countdown: number = 0;

  @Output() onLogin = new EventEmitter<void>();
  @Output() onLogout = new EventEmitter<void>();

  constructor(private router: Router) {}

  onLoginClick(): void {
    this.onLogin.emit();
    this.router.navigate(['/auth/login']);
  }

  onLogoutClick(): void {
    this.onLogout.emit();
  }
}

