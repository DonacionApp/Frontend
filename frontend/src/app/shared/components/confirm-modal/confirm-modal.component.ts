import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../modal/modal.component';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule, ModalComponent],
  template: `
    <app-modal
      [isOpen]="isOpen"
      [title]="title"
      [size]="'md'"
      [showCloseButton]="true"
      [closeOnBackdropClick]="false"
      (onClose)="cancel()"
    >
      <div class="space-y-4">
        <div class="flex items-start gap-4">
          <div class="flex-shrink-0">
            <div class="w-10 h-10 rounded-full flex items-center justify-center" [class.bg-yellow-100]="type === 'warning'" [class.bg-red-100]="type === 'danger'" [class.bg-blue-100]="type === 'info'">
              <svg *ngIf="type === 'warning'" class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <svg *ngIf="type === 'danger'" class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <svg *ngIf="type === 'info'" class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
          </div>
          <div class="flex-1">
            <p class="text-sm text-gray-600 whitespace-pre-line">{{ message }}</p>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            (click)="cancel()"
            [disabled]="loading"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ cancelText }}
          </button>
          <button
            type="button"
            (click)="confirm()"
            [disabled]="loading"
            [class]="'px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ' + (type === 'danger' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : type === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500')"
          >
            <span *ngIf="!loading">{{ confirmText }}</span>
            <span *ngIf="loading">{{ loadingText }}</span>
          </button>
        </div>
      </div>
    </app-modal>
  `
})
export class ConfirmModalComponent {
  @Input() isOpen: boolean = false;
  @Input() title: string = 'Confirmar Acción';
  @Input() message: string = '¿Estás seguro de realizar esta acción?';
  @Input() confirmText: string = 'Confirmar';
  @Input() cancelText: string = 'Cancelar';
  @Input() loadingText: string = 'Procesando...';
  @Input() loading: boolean = false;
  @Input() type: 'warning' | 'danger' | 'info' = 'warning';

  @Output() onConfirm = new EventEmitter<void>();
  @Output() onCancel = new EventEmitter<void>();

  cancel(): void {
    this.onCancel.emit();
  }

  confirm(): void {
    this.onConfirm.emit();
  }
}

