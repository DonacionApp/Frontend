import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-publication-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-6 border-b border-gray-200">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center space-x-4 flex-1">
          <img
            [src]="profilePhotoUrl"
            [alt]="username"
            class="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
            (error)="onImageError($event)"
          />
          <div class="flex-1">
            <h2 class="text-xl font-bold text-gray-900">{{ username }}</h2>
            <p class="text-sm text-gray-500">{{ formatTimeAgo(createdAt) }}</p>
            <!-- Fallback: mostrar donationType si no hay tags -->
            <span
              *ngIf="(!tags || tags.length === 0) && donationType"
              class="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
            >
              {{ donationType.name }}
            </span>
          </div>
        </div>

        <button
          *ngIf="isOwner"
          (click)="onEdit.emit()"
          class="inline-flex items-center px-5 py-2.5 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all duration-200 shadow-md hover:shadow-lg"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5h2m-1 0v14m-7-7h14" />
          </svg>
          Editar
        </button>
      </div>

      <!-- Tags Section with Better Design -->
      <div *ngIf="tags && tags.length > 0" class="mt-4 pt-4 border-t border-gray-100">
        <div class="flex items-center gap-2 mb-3">
          <svg class="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"/>
            <path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd"/>
          </svg>
          <span class="text-sm font-semibold text-gray-700">Etiquetas IA ({{ tags.length }})</span>
        </div>
        <div class="flex flex-wrap gap-2.5">
          <span
            *ngFor="let tag of tags; let idx = index"
            [ngClass]="getTagColorClass(idx)"
            class="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 cursor-default shadow-sm hover:shadow-md"
          >
            <span class="mr-2 text-lg">{{ getTagEmoji(idx) }}</span>
            {{ tag.tag }}
          </span>
        </div>
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

  // Colores para tags (9 variaciones bonitas)
  private tagColors = [
    'bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700',
    'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700',
    'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700',
    'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700',
    'bg-gradient-to-r from-rose-100 to-red-100 text-rose-700',
    'bg-gradient-to-r from-indigo-100 to-blue-100 text-indigo-700',
    'bg-gradient-to-r from-lime-100 to-green-100 text-lime-700',
    'bg-gradient-to-r from-teal-100 to-cyan-100 text-teal-700',
    'bg-gradient-to-r from-violet-100 to-purple-100 text-violet-700'
  ];

  // Emojis representativos para tags
  private tagEmojis = ['🏷️', '📌', '⭐', '🎯', '💡', '🔥', '🎨', '✨', '🌟', '💎', '🚀', '🎁'];

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

  getTagColorClass(index: number): string {
    return this.tagColors[index % this.tagColors.length];
  }

  getTagEmoji(index: number): string {
    return this.tagEmojis[index % this.tagEmojis.length];
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

