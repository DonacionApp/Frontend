import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../modal/modal.component';

@Component({
  selector: 'app-message-modal',
  standalone: true,
  imports: [CommonModule, ModalComponent],
  template: `
    <app-modal
      [isOpen]="isOpen"
      [title]="title"
      [size]="'md'"
      [showCloseButton]="true"
      [closeOnBackdropClick]="true"
      (onClose)="close()"
    >
      <div class="space-y-4">
        <div class="flex items-start gap-4">
          <div class="flex-shrink-0">
            <div class="w-10 h-10 rounded-full flex items-center justify-center" 
                 [class.bg-green-100]="type === 'success'"
                 [class.bg-red-100]="type === 'error'"
                 [class.bg-blue-100]="type === 'info'"
                 [class.bg-yellow-100]="type === 'warning'">
              <svg *ngIf="type === 'success'" class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <svg *ngIf="type === 'error'" class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
              <svg *ngIf="type === 'info'" class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <svg *ngIf="type === 'warning'" class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
          </div>
          <div class="flex-1">
            <p class="text-sm text-gray-600 whitespace-pre-line">{{ message }}</p>
          </div>
        </div>

        <div class="flex justify-end pt-4 border-t border-gray-200">
          <button
            type="button"
            (click)="close()"
            [class]="'px-4 py-2 text-sm font-medium text-white rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 ' + (type === 'success' ? 'bg-green-600 focus:ring-green-500' : type === 'error' ? 'bg-red-600 focus:ring-red-500' : type === 'warning' ? 'bg-yellow-600 focus:ring-yellow-500' : 'bg-blue-600 focus:ring-blue-500')"
          >
            {{ buttonText }}
          </button>
        </div>
      </div>
    </app-modal>
  `
})
export class MessageModalComponent {
  @Input() isOpen: boolean = false;
  @Input() title: string = '';
  @Input() message: string = '';
  @Input() type: 'success' | 'error' | 'info' | 'warning' = 'info';
  @Input() buttonText: string = 'Aceptar';

  @Output() onClose = new EventEmitter<void>();

  close(): void {
    this.onClose.emit();
  }
}

