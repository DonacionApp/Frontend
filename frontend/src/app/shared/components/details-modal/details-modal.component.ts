import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../modal/modal.component';

export interface DetailItem {
  label: string;
  value: string | number | null | undefined;
  type?: 'text' | 'date' | 'boolean' | 'badge';
}

@Component({
  selector: 'app-details-modal',
  standalone: true,
  imports: [CommonModule, ModalComponent],
  template: `
    <app-modal
      [isOpen]="isOpen"
      [title]="title"
      [size]="'lg'"
      [showCloseButton]="true"
      [closeOnBackdropClick]="true"
      (onClose)="close()"
    >
      <div class="space-y-6">
        <div *ngIf="details && details.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div *ngFor="let detail of details" class="space-y-1">
            <p class="text-sm font-medium text-gray-500">{{ detail.label }}</p>
            <div *ngIf="detail.type === 'boolean'">
              <span *ngIf="detail.value" class="inline-flex items-center gap-1 text-green-600">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
                <span>Sí</span>
              </span>
              <span *ngIf="!detail.value" class="inline-flex items-center gap-1 text-red-600">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                </svg>
                <span>No</span>
              </span>
            </div>
            <div *ngIf="detail.type === 'badge'">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" 
                    [class.bg-green-100]="detail.value === 'Sí' || detail.value === 'Activo' || detail.value === 'Verificado'"
                    [class.text-green-800]="detail.value === 'Sí' || detail.value === 'Activo' || detail.value === 'Verificado'"
                    [class.bg-red-100]="detail.value === 'No' || detail.value === 'Bloqueado' || detail.value === 'Rechazado'"
                    [class.text-red-800]="detail.value === 'No' || detail.value === 'Bloqueado' || detail.value === 'Rechazado'"
                    [class.bg-yellow-100]="detail.value === 'Pendiente'"
                    [class.text-yellow-800]="detail.value === 'Pendiente'"
                    [class.bg-gray-100]="!detail.value || (detail.value !== 'Sí' && detail.value !== 'No' && detail.value !== 'Activo' && detail.value !== 'Bloqueado' && detail.value !== 'Verificado' && detail.value !== 'Rechazado' && detail.value !== 'Pendiente')"
                    [class.text-gray-800]="!detail.value || (detail.value !== 'Sí' && detail.value !== 'No' && detail.value !== 'Activo' && detail.value !== 'Bloqueado' && detail.value !== 'Verificado' && detail.value !== 'Rechazado' && detail.value !== 'Pendiente')">
                {{ detail.value || '-' }}
              </span>
            </div>
            <p *ngIf="!detail.type || detail.type === 'text'" class="text-sm text-gray-900 font-medium">
              {{ formatValue(detail.value, detail.type) }}
            </p>
          </div>
        </div>
        <div *ngIf="!details || details.length === 0" class="text-center py-8 text-gray-500">
          <p>No hay información disponible</p>
        </div>

        <div class="flex justify-end pt-4 border-t border-gray-200">
          <button
            type="button"
            (click)="close()"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cerrar
          </button>
        </div>
      </div>
    </app-modal>
  `
})
export class DetailsModalComponent {
  @Input() isOpen: boolean = false;
  @Input() title: string = 'Detalles';
  @Input() details: DetailItem[] = [];

  @Output() onClose = new EventEmitter<void>();

  formatValue(value: string | number | null | undefined, type?: string): string {
    if (value === null || value === undefined) return '-';
    
    if (type === 'date' && typeof value === 'string') {
      try {
        return new Date(value).toLocaleString('es-ES');
      } catch {
        return value.toString();
      }
    }
    
    return value.toString();
  }

  close(): void {
    this.onClose.emit();
  }
}

