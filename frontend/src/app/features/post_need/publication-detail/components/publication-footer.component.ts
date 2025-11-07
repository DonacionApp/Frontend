import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LikesModalComponent } from '../../../../shared/components/likes-modal/likes-modal.component';
import { DonationService } from '../../../../core/services/post.service';

@Component({
  selector: 'app-publication-footer',
  standalone: true,
  imports: [CommonModule, LikesModalComponent],
  template: `
    <div class="border-t border-gray-200 px-6 py-4 bg-gray-50 relative">
      <!-- Mensaje toast para like duplicado -->
      <div *ngIf="duplicateLikeMessage" 
           class="absolute bottom-full left-6 mb-2 bg-amber-500 text-white text-xs font-medium px-3 py-2 rounded-lg shadow-lg z-50 animate-fade-in"
           style="animation: fadeIn 0.3s ease-in;">
        <div class="flex items-center space-x-2">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
          </svg>
          <span>{{ duplicateLikeMessage }}</span>
        </div>
      </div>
      
      <div class="flex items-center justify-between">
        <!-- Botón de like: Todo ROJO cuando liked (1), normal cuando no liked (0) -->
        <button 
          (click)="onLikeClick()"
          [disabled]="isLikeInProgress"
          class="flex items-center space-x-2 transition-all duration-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 relative"
          [class.text-red-600]="isLiked"
          [class.text-red-700]="isLiked"
          [class.text-gray-600]="!isLiked"
          [class.bg-red-50]="isLiked"
          [class.bg-red-100]="isLiked"
          [class.bg-transparent]="!isLiked"
          [class.hover:bg-red-200]="isLiked && !isLikeInProgress"
          [class.hover:bg-red-50]="!isLiked && !isLikeInProgress"
          [class.border-2]="isLiked"
          [class.border-red-500]="isLiked"
          [class.border-red-400]="isLiked"
          [class.opacity-50]="isLikeInProgress"
          [class.cursor-not-allowed]="isLikeInProgress"
          [class.cursor-pointer]="!isLikeInProgress"
          [attr.aria-label]="isLiked ? 'Quitar me gusta' : 'Me gusta'"
          [attr.aria-busy]="isLikeInProgress"
        >
          <!-- Spinner durante carga -->
          <svg *ngIf="isLikeInProgress" class="animate-spin h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          
          <!-- Icono de corazón: ROJO relleno cuando liked (1), BLANCO/GRIS cuando no liked (0) -->
          <svg 
            *ngIf="!isLikeInProgress"
            class="w-7 h-7 transition-all duration-200" 
            [class.text-red-600]="isLiked"
            [class.text-gray-400]="!isLiked"
            [class.scale-110]="isLiked"
            [class.drop-shadow-sm]="isLiked"
            [attr.fill]="isLiked ? '#dc2626' : 'none'"
            [attr.stroke]="isLiked ? '#dc2626' : '#9ca3af'"
            [attr.stroke-width]="isLiked ? '0' : '2'"
            viewBox="0 0 24 24"
          >
            <path 
              *ngIf="isLiked"
              stroke-linecap="round" 
              stroke-linejoin="round" 
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              fill="#dc2626"
            />
            <path 
              *ngIf="!isLiked"
              stroke-linecap="round" 
              stroke-linejoin="round" 
              stroke="#9ca3af"
              stroke-width="2"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              fill="none"
            />
          </svg>
          <span 
            class="text-lg font-medium transition-colors duration-200"
            [class.cursor-pointer]="!isLikeInProgress && likesCount > 0"
            [class.hover:underline]="!isLikeInProgress && likesCount > 0"
            [class.text-red-600]="isLiked"
            [class.text-red-700]="isLiked"
            (click)="onLikesCountClick($event)"
            [title]="likesCount > 0 ? 'Ver quién dio like' : ''"
          >
            {{ likesCount }} {{ likesCount === 1 ? 'Me gusta' : 'Me gusta' }}
          </span>
        </button>
      </div>

      <!-- Modal de usuarios que dieron like -->
      <app-likes-modal
        [isOpen]="showLikesModal"
        [donationId]="donationId"
        [likesCount]="likesCount"
        (onClose)="showLikesModal = false"
      ></app-likes-modal>
    </div>
  `,
  styles: [`
    button:active svg {
      transform: scale(0.95);
    }
    button svg {
      transition: all 0.2s ease-in-out;
    }
  `]
})
export class PublicationFooterComponent {
  @Input() likesCount: number = 0;
  @Input() isLiked: boolean = false;
  @Input() donationId: string = '';
  @Output() onLikeToggle = new EventEmitter<void>();

  showLikesModal = false;
  duplicateLikeMessage: string | null = null;

  constructor(private donationService: DonationService) {}

  get isLikeInProgress(): boolean {
    return this.donationService.isLikeInProgress(this.donationId);
  }

  onLikeClick(): void {
    // Prevenir like duplicado: si ya le dio like, mostrar mensaje y no hacer nada
    if (this.isLiked) {
      this.showDuplicateLikeMessage();
      return;
    }
    
    this.duplicateLikeMessage = null; // Limpiar mensaje anterior
    this.onLikeToggle.emit();
  }

  showDuplicateLikeMessage(): void {
    this.duplicateLikeMessage = 'Ya has dado like a esta publicación';
    // Auto-ocultar después de 3 segundos
    setTimeout(() => {
      this.duplicateLikeMessage = null;
    }, 3000);
  }

  onLikesCountClick(event: Event): void {
    event.stopPropagation();
    if (this.likesCount > 0) {
      this.showLikesModal = true;
    }
  }
}


