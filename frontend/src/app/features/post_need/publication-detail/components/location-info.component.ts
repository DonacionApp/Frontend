import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-location-info',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="border-t pt-4">
      <h3 class="text-lg font-semibold text-gray-900 mb-3">Información de ubicación</h3>
      <div class="space-y-3">
        <!-- Comunidad -->
        <div class="flex items-start">
          <svg class="w-5 h-5 mr-3 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          <div>
            <p class="text-sm font-medium text-gray-700">Comunidad</p>
            <p class="text-gray-900">{{ comunity }}</p>
          </div>
        </div>

        <!-- Lugar de recogida -->
        <div class="flex items-start">
          <svg class="w-5 h-5 mr-3 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
          </svg>
          <div>
            <p class="text-sm font-medium text-gray-700">Lugar de recogida</p>
            <p class="text-gray-900">{{ lugarRecogida || 'Por definir' }}</p>
          </div>
        </div>

        <!-- Lugar de donación -->
        <div class="flex items-start">
          <svg class="w-5 h-5 mr-3 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
          </svg>
          <div>
            <p class="text-sm font-medium text-gray-700">Lugar de donación</p>
            <p class="text-gray-900">{{ lugarDonacion || 'Por definir' }}</p>
          </div>
        </div>

        <!-- Fecha límite -->
        <div class="flex items-start">
          <svg class="w-5 h-5 mr-3 text-orange-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          <div>
            <p class="text-sm font-medium text-gray-700">Fecha límite</p>
            <p class="text-gray-900">{{ formatDate(fechaMaximaEntrega) }}</p>
            <span class="inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium" [ngClass]="urgencyClass">
              <span *ngIf="daysRemaining >= 0">{{ daysRemaining }} días restantes</span>
              <span *ngIf="daysRemaining < 0">Vencido</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  `
})
export class LocationInfoComponent {
  @Input() comunity: string = '';
  @Input() lugarRecogida: string = '';
  @Input() lugarDonacion: string = '';
  @Input() fechaMaximaEntrega: string = '';
  @Input() daysRemaining: number = 0;
  @Input() urgencyClass: string = '';

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}

