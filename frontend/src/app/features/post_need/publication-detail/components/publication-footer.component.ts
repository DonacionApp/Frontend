import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LikesModalComponent } from '../../../../shared/components/likes-modal/likes-modal.component';

@Component({
  selector: 'app-publication-footer',
  standalone: true,
  imports: [CommonModule, LikesModalComponent],
  template: `
    <div class="border-t border-gray-200 px-6 py-4 bg-gray-50 relative">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3 text-gray-700">
          <svg class="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
          </svg>
          <span class="text-lg font-semibold">
            {{ likesCount }} {{ likesCount === 1 ? 'Me gusta' : 'Me gusta' }}
          </span>
        </div>

        <button
          *ngIf="likesCount > 0"
          type="button"
          class="text-sm text-emerald-600 hover:text-emerald-700 underline"
          (click)="onLikesCountClick($event)"
        >
          Ver quiénes dieron like
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
  @Input() donationId: string = '';

  showLikesModal = false;
  duplicateLikeMessage: string | null = null;

  onLikesCountClick(event: Event): void {
    event.stopPropagation();
    if (this.likesCount > 0) {
      this.showLikesModal = true;
    }
  }
}


