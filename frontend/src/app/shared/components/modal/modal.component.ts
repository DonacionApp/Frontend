import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';
export type ModalPosition = 'center' | 'top' | 'bottom';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Modal Backdrop -->
    <div 
      *ngIf="isOpen" 
      [class]="backdropClasses"
      [class.bg-black]="showBackdrop"
      [class.bg-opacity-50]="showBackdrop"
      (click)="onBackdropClick($event)"
      class="fixed inset-0 z-40 flex items-center justify-center p-4">
      
      <!-- Modal Container -->
      <div 
        [class]="modalClasses"
        (click)="onModalClick($event)"
        class="bg-white rounded-xl shadow-2xl w-full max-h-[90vh] overflow-hidden animate-fade-in-up">
        
        <!-- Modal Header -->
        <div *ngIf="title || showCloseButton" class="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 *ngIf="title" class="text-xl font-semibold text-gray-900">
            {{ title }}
          </h3>
          
          <button 
            *ngIf="showCloseButton"
            (click)="closeModal()"
            class="close-button text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1 rounded-full hover:bg-gray-100">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <!-- Modal Body -->
        <div class="modal-body p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <ng-content></ng-content>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Modal animations */
    @keyframes modalFadeIn {
      from {
        opacity: 0;
        transform: scale(0.95) translateY(-20px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    @keyframes modalFadeOut {
      from {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
      to {
        opacity: 0;
        transform: scale(0.95) translateY(-20px);
      }
    }

    @keyframes backdropFadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes backdropFadeOut {
      from {
        opacity: 1;
      }
      to {
        opacity: 0;
      }
    }

    /* Modal content animations */
    .modal-content {
      animation: modalFadeIn 0.3s ease-out;
    }

    .modal-content.closing {
      animation: modalFadeOut 0.2s ease-in;
    }

    /* Backdrop animations */
    .modal-backdrop {
      animation: backdropFadeIn 0.3s ease-out;
    }

    .modal-backdrop.closing {
      animation: backdropFadeOut 0.2s ease-in;
    }

    /* Custom scrollbar for modal body */
    .modal-body::-webkit-scrollbar {
      width: 6px;
    }

    .modal-body::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 3px;
    }

    .modal-body::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 3px;
    }

    .modal-body::-webkit-scrollbar-thumb:hover {
      background: #a8a8a8;
    }

    /* Responsive adjustments */
    @media (max-width: 640px) {
      .modal-content {
        margin: 1rem;
        max-height: calc(100vh - 2rem);
      }
    }

    /* Focus styles for accessibility */
    .modal-content:focus {
      outline: none;
    }

    /* Close button hover effects */
    .close-button {
      transition: all 0.2s ease;
    }

    .close-button:hover {
      transform: scale(1.1);
    }

    .close-button:active {
      transform: scale(0.95);
    }
  `]
})
export class ModalComponent implements OnInit, OnDestroy {
  @Input() isOpen: boolean = false;
  @Input() title: string = '';
  @Input() size: ModalSize = 'md';
  @Input() position: ModalPosition = 'center';
  @Input() showCloseButton: boolean = true;
  @Input() closeOnBackdropClick: boolean = true;
  @Input() closeOnEscape: boolean = true;
  @Input() showBackdrop: boolean = true;
  @Input() backdropBlur: boolean = true;

  @Output() onClose = new EventEmitter<void>();
  @Output() onOpen = new EventEmitter<void>();

  get modalClasses(): string {
    const baseClasses = 'modal-content transform transition-all duration-300 ease-out';
    
    const sizeClasses: Record<ModalSize, string> = {
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-lg',
      xl: 'max-w-xl'
    };

    const positionClasses: Record<ModalPosition, string> = {
      center: 'mx-auto my-auto',
      top: 'mx-auto mt-8',
      bottom: 'mx-auto mb-8'
    };

    return `${baseClasses} ${sizeClasses[this.size]} ${positionClasses[this.position]}`.trim();
  }

  get backdropClasses(): string {
    const baseClasses = 'fixed inset-0 z-40 transition-opacity duration-300';
    const blurClass = this.backdropBlur ? 'backdrop-blur-sm' : '';
    return `${baseClasses} ${blurClass}`.trim();
  }

  ngOnInit(): void {
    if (this.isOpen) {
      this.onOpen.emit();
    }
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    if (this.isOpen && this.closeOnEscape) {
      this.closeModal();
    }
  }

  closeModal(): void {
    this.isOpen = false;
    this.onClose.emit();
  }

  onBackdropClick(event: Event): void {
    if (this.closeOnBackdropClick && event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  onModalClick(event: Event): void {
    // Prevent modal content clicks from closing the modal
    event.stopPropagation();
  }
}
