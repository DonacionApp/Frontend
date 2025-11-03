import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-publication-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-6 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <img 
            [src]="profilePhotoUrl" 
            [alt]="username"
            class="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
            (error)="onImageError($event)"
          />
          <div>
            <h2 class="text-xl font-bold text-gray-900">{{ username }}</h2>
            <p class="text-sm text-gray-500">{{ formatTimeAgo(createdAt) }}</p>
            <span 
              *ngIf="donationType" 
              class="inline-block mt-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
            >
              {{ donationType.name }}
            </span>
          </div>
        </div>

        <button 
          *ngIf="isOwner"
          (click)="onEdit.emit()"
          class="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          Editar
        </button>
      </div>
    </div>
  `
})
export class PublicationHeaderComponent {
  @Input() profilePhotoUrl: string = '';
  @Input() username: string = '';
  @Input() createdAt: string = '';
  @Input() donationType: any;
  @Input() isOwner: boolean = false;
  @Output() onEdit = new EventEmitter<void>();

  onImageError(event: any): void {
    event.target.src = 'assets/default-avatar.svg';
  }

  formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }
}

