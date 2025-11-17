import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AdminService, AuditAction, AuditFilters } from '../../../../core/services/admin/admin.service';

export interface AuditoriaDialogData {
  userId: number;
  username?: string;
  filters?: AuditFilters;
}

@Component({
  selector: 'app-auditoria-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, FormsModule],
  template: `
   <div class="p-6 auditoria-content bg-white rounded-lg shadow-sm" style="display:inline-block; vertical-align: top;">
  <!-- Header -->
  <div class="flex items-start justify-between mb-6 pb-4 border-b border-gray-200">
    <div>
      <h3 class="text-xl font-bold text-gray-900">Auditoría — {{ data.username || ('ID: ' + data.userId) }}</h3>
      <div class="text-sm text-gray-500 mt-1">Usuario ID: <span class="font-medium text-gray-700">{{ data.userId }}</span></div>
    </div>
    <button 
      (click)="close()" 
      class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-200">
      Cerrar
    </button>
  </div>

  <!-- Filters Form -->
  <form class="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end" (ngSubmit)="applyFilters()">
    <div>
      <label class="block text-xs font-medium text-gray-700 mb-1">Acción</label>
      <input 
        [(ngModel)]="filters.action" 
        name="action" 
        placeholder="Ej: login" 
        class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    </div>
    
    <div>
      <label class="block text-xs font-medium text-gray-700 mb-1">Orden</label>
      <select 
        [(ngModel)]="filters.order" 
        name="order" 
        class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
        <option [value]="'DESC'">Descendente</option>
        <option [value]="'ASC'">Ascendente</option>
      </select>
    </div>
    
    <div>
      <label class="block text-xs font-medium text-gray-700 mb-1">Límite</label>
      <input 
        type="number" 
        [(ngModel)]="filters.limit" 
        name="limit" 
        min="1" 
        placeholder="10"
        class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    </div>
    
    <div>
      <label class="block text-xs font-medium text-gray-700 mb-1">Página</label>
      <input 
        type="number" 
        [(ngModel)]="filters.page" 
        name="page" 
        min="1" 
        placeholder="1"
        class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    </div>
    
    <button 
      class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors duration-200 shadow-sm hover:shadow-md" 
      type="submit">
      Aplicar Filtros
    </button>
  </form>

  <!-- Loading State -->
  <div *ngIf="loading" class="flex items-center justify-center py-12">
    <div class="text-center">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600 mb-3"></div>
      <p class="text-sm text-gray-600">Cargando acciones...</p>
    </div>
  </div>

  <!-- Empty State -->
  <div *ngIf="!loading && actions.length === 0" class="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
    <svg class="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
    <p class="text-sm text-gray-600 font-medium">No se encontraron acciones</p>
    <p class="text-xs text-gray-500 mt-1">Intenta ajustar los filtros de búsqueda</p>
  </div>

  <!-- Actions List -->
  <div class="space-y-4">
    <div *ngFor="let a of actions" class="auditoria-item bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200">
      <!-- Action Header -->
     

      <!-- Action Details -->
      <div *ngIf="a.action" class="mb-3 pb-3 border-b border-gray-100">
        <span class="inline-flex items-center gap-2 text-sm">
          <span class="font-semibold text-gray-700">Acción:</span>
          <span class="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-mono">{{ a.action }}</span>
        </span>
      </div>

      <!-- Comment Section -->
      <div *ngIf="a.comment" class="space-y-3">
        <div class="bg-gray-50 rounded-md p-3">
          <span class="auditoria-field-label text-xs font-semibold text-gray-700 uppercase tracking-wide">Mensaje:</span>
          <p class="text-sm text-gray-800 mt-1">{{ a.comment.message }}</p>
        </div>
        
        <div *ngIf="a.comment.payload" class="bg-amber-50 rounded-md p-3">
          <div class="flex items-center gap-2 mb-2">
            <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <strong class="text-xs font-semibold text-amber-800 uppercase tracking-wide">Payload</strong>
          </div>
          <pre class="auditoria-pre text-xs bg-white border border-amber-200 rounded p-2 overflow-x-auto text-gray-800">{{ a.comment.payload | json }}</pre>
        </div>
        
        <div *ngIf="a.comment.response" class="bg-green-50 rounded-md p-3">
          <div class="flex items-center gap-2 mb-2">
            <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <strong class="text-xs font-semibold text-green-800 uppercase tracking-wide">Respuesta</strong>
          </div>
          <pre class="auditoria-pre text-xs bg-white border border-green-200 rounded p-2 overflow-x-auto text-gray-800">{{ a.comment.response | json }}</pre>
        </div>
      </div>
    </div>
  </div>
</div>
  `
})
export class AuditoriaDialogComponent implements OnInit {
  actions: AuditAction[] = [];
  loading = false;
  filters: AuditFilters = { order: 'DESC', limit: 50, page: 1 };

  constructor(
    public dialogRef: MatDialogRef<AuditoriaDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AuditoriaDialogData,
    private admin: AdminService
  ) {}

  ngOnInit(): void {
    // initialize filters from incoming data if provided
    if (this.data.filters) {
      this.filters = { ...this.filters, ...this.data.filters };
    }
    this.loadActions(this.data.userId, this.filters);
  }

  loadActions(userId: number, filters: AuditFilters) {
    this.loading = true;
    this.admin.getUserActions(userId, filters).subscribe({
      next: res => { this.actions = res.data || []; this.loading = false; },
      error: () => { this.actions = []; this.loading = false; }
    });
  }

  applyFilters() {
    this.filters = {
      order: this.filters.order || 'DESC',
      limit: this.filters.limit ?? 50,
      page: this.filters.page ?? 1,
      action: this.filters.action
    };
    this.loadActions(this.data.userId, this.filters);
  }

  getStatusClass(status: any) {
    const s = String(status || '').toLowerCase();
    if (/^2/.test(s) || s === 'ok' || s === '200') return 'audit-status-200';
    if (/^4/.test(s)) return 'audit-status-4xx';
    if (/^5/.test(s)) return 'audit-status-500';
    return 'audit-status-4xx';
  }

  close() {
    this.dialogRef.close();
  }
}
