import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type CardVariant = 'default' | 'elevated' | 'outlined' | 'filled';
export type CardSize = 'sm' | 'md' | 'lg';

export interface CardData {
  id: string;
  title: string;
  description: string;
  image?: string;
  icon?: string;
  category?: string;
  tags?: string[];
  stats?: {
    label: string;
    value: string | number;
  }[];
  actionText?: string;
  isActive?: boolean;
}

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      [class]="cardClasses"
      (click)="handleCardClick()"
      class="cursor-pointer transition-all duration-300 hover:scale-105">
      
      <!-- Card Image -->
      <div *ngIf="data.image" class="relative overflow-hidden rounded-t-lg">
        <img 
          [src]="data.image" 
          [alt]="data.title"
          class="w-full h-48 object-cover transition-transform duration-500 hover:scale-110">
        
        <!-- Category Badge -->
        <div *ngIf="data.category" class="absolute top-3 left-3">
          <span class="bg-white/90 backdrop-blur-sm text-gray-700 px-2 py-1 rounded-full text-xs font-medium">
            {{ data.category }}
          </span>
        </div>

        <!-- Active Status -->
        <div *ngIf="data.isActive !== undefined" class="absolute top-3 right-3">
          <span 
            [class]="data.isActive ? 'bg-green-500' : 'bg-gray-400'"
            class="w-3 h-3 rounded-full"></span>
        </div>
      </div>

      <!-- Card Content -->
      <div class="p-6">
        <!-- Icon (if no image) -->
        <div *ngIf="!data.image && data.icon" class="mb-4">
          <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="data.icon"></path>
            </svg>
          </div>
        </div>

        <!-- Title -->
        <h3 class="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
          {{ data.title }}
        </h3>

        <!-- Description -->
        <p class="text-gray-600 text-sm mb-4 line-clamp-3">
          {{ data.description }}
        </p>

        <!-- Tags -->
        <div *ngIf="data.tags && data.tags.length > 0" class="flex flex-wrap gap-1 mb-4">
          <span 
            *ngFor="let tag of data.tags.slice(0, 3)" 
            class="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
            {{ tag }}
          </span>
          <span *ngIf="data.tags.length > 3" class="text-gray-400 text-xs">
            +{{ data.tags.length - 3 }} más
          </span>
        </div>

        <!-- Stats -->
        <div *ngIf="data.stats && data.stats.length > 0" class="grid grid-cols-2 gap-2 mb-4">
          <div *ngFor="let stat of data.stats.slice(0, 2)" class="text-center p-2 bg-gray-50 rounded">
            <div class="text-lg font-bold text-gray-900">{{ stat.value }}</div>
            <div class="text-xs text-gray-600">{{ stat.label }}</div>
          </div>
        </div>

        <!-- Action Button -->
        <div *ngIf="data.actionText" class="mt-4">
          <button 
            class="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors duration-200">
            {{ data.actionText }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .line-clamp-3 {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .card-hover {
      transition: all 0.3s ease;
    }

    .card-hover:hover {
      transform: translateY(-4px);
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    }
  `]
})
export class CardComponent {
  @Input() data: CardData = {
    id: '',
    title: '',
    description: '',
    actionText: 'Ver más'
  };
  @Input() variant: CardVariant = 'default';
  @Input() size: CardSize = 'md';
  @Input() showHover: boolean = true;

  @Output() onCardClick = new EventEmitter<CardData>();

  get cardClasses(): string {
    const baseClasses = 'bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200';
    
    const variantClasses: Record<CardVariant, string> = {
      default: 'shadow-sm',
      elevated: 'shadow-lg',
      outlined: 'border-2 border-gray-300',
      filled: 'bg-gray-50'
    };

    const sizeClasses: Record<CardSize, string> = {
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-lg'
    };

    const hoverClass = this.showHover ? 'card-hover' : '';

    return `${baseClasses} ${variantClasses[this.variant]} ${sizeClasses[this.size]} ${hoverClass}`.trim();
  }

  handleCardClick(): void {
    this.onCardClick.emit(this.data);
  }
}
