import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-publication-footer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="border-t border-gray-200 px-6 py-4 bg-gray-50">
      <div class="flex items-center justify-between">
        <button 
          (click)="onLikeToggle.emit()"
          class="flex items-center space-x-2 text-gray-600 hover:text-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded-lg px-2 py-1"
          [class.text-red-600]="isLiked"
          [attr.aria-label]="isLiked ? 'Quitar me gusta' : 'Me gusta'"
        >
          <svg 
            class="w-7 h-7 transition-transform" 
            [class.fill-current]="isLiked"
            [class.scale-110]="isLiked"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              stroke-linecap="round" 
              stroke-linejoin="round" 
              stroke-width="2" 
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
          <span class="text-lg font-medium">
            {{ likesCount }} {{ likesCount === 1 ? 'Me gusta' : 'Me gusta' }}
          </span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    button:active svg {
      transform: scale(0.95);
    }
  `]
})
export class PublicationFooterComponent {
  @Input() likesCount: number = 0;
  @Input() isLiked: boolean = false;
  @Output() onLikeToggle = new EventEmitter<void>();
}

