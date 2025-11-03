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
            <!-- Tags de la donación -->
            <div *ngIf="tags && tags.length > 0" class="flex flex-wrap gap-2 mt-2">
              <span 
                *ngFor="let tag of tags" 
                class="inline-block px-3 py-1 bg-gradient-to-r from-orange-100 to-pink-100 text-orange-700 rounded-full text-xs font-medium shadow-sm"
              >
                {{ tag.tag }}
              </span>
            </div>
            <!-- Fallback: mostrar donationType si no hay tags -->
            <span 
              *ngIf="(!tags || tags.length === 0) && donationType" 
              class="inline-block mt-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
            >
              {{ donationType.name }}
            </span>
          </div>
        </div>

        <button 
          *ngIf="isOwner"
          (click)="onEdit.emit()"
          class="px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all duration-200 hover:shadow-md"
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
  @Input() tags: Array<{ id: number; tag: string; description?: string }> | null = null;
  @Input() isOwner: boolean = false;
  @Output() onEdit = new EventEmitter<void>();

  onImageError(event: any): void {
    event.target.src = this.getDefaultAvatar();
  }

  private getDefaultAvatar(): string {
    // SVG inline como data URI para evitar problemas de carga
    return 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <circle cx="50" cy="50" r="50" fill="#e5e7eb"/>
        <g fill="#9ca3af">
          <circle cx="50" cy="35" r="15"/>
          <path d="M 25 70 Q 25 55 35 52 L 65 52 Q 75 55 75 70 L 75 85 Q 75 90 70 90 L 30 90 Q 25 90 25 85 Z"/>
        </g>
      </svg>
    `);
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

