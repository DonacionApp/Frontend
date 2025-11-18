import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AdminService, AuditAction, AuditFilters } from '../../../../core/services/admin/admin.service';
import { AuditoriaActionDetailComponent } from './auditoria-action-detail.component';

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
  <div class="p-6 auditoria-content bg-white rounded-lg shadow-sm" style="display:inline-block; vertical-align: top; width: min(880px, 96vw);">
  <!-- Header -->
  <div class="flex items-start justify-between mb-6 pb-4 border-b border-gray-200">
    <div>
      <h3 class="text-xl font-bold text-gray-900">Auditoría — {{ data.username || ('ID: ' + data.userId) }}</h3>
      <div class="text-sm text-gray-500 mt-1">Usuario ID: <span class="font-medium text-gray-700">{{ data.userId }}</span></div>
    </div>
    <div class="flex items-center gap-2">
      <button (click)="toggleFilters()" [attr.aria-expanded]="showFilters" title="Abrir/Cerrar filtros" class="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition">
        <svg *ngIf="!showFilters" class="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01.293.707l-7 7V21l-4-2v-7L2.707 6.707A1 1 0 013 6V4z"/></svg>
        <svg *ngIf="showFilters" class="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        <span class="text-sm">{{ showFilters ? 'Cerrar filtros' : 'Abrir filtros' }}</span>
      </button>

      <button 
        (click)="close()" 
        class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-200">
        Cerrar
      </button>
    </div>
  </div>

  <!-- Filters Form (collapsible) -->
  <div *ngIf="showFilters" class="w-full">
    <form class="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end" (ngSubmit)="applyFilters()">
    <div class="col-span-1 sm:col-span-2 lg:col-span-2">
      <label class="block text-xs font-medium text-gray-700 mb-1">Acción</label>
      <input 
        [(ngModel)]="filters.action" 
        name="action" 
        placeholder="Ej: login" 
        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
    </div>
    
    <div>
      <label class="block text-xs font-medium text-gray-700 mb-1">Orden</label>
      <select 
        [(ngModel)]="filters.order" 
        name="order" 
        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white">
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
        placeholder="20"
        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
    </div>

    <div>
      <label class="block text-xs font-medium text-gray-700 mb-1">Página</label>
      <input 
        type="number" 
        [(ngModel)]="filters.page" 
        name="page" 
        min="1" 
        placeholder="1"
        class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
    </div>

    <!-- Date range filters -->
    <div class="col-span-1 sm:col-span-2 lg:col-span-2 grid grid-cols-2 gap-2">
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">Desde</label>
        <input type="date" [(ngModel)]="filters.startDate" name="startDate" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">Hasta</label>
        <input type="date" [(ngModel)]="filters.endDate" name="endDate" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
      </div>
    </div>

    <!-- Buttons: primary apply and secondary clear -->
    <div class="col-span-1 sm:col-span-2 lg:col-span-6 flex gap-2 justify-end mt-2">
      <button type="button" (click)="resetFilters()" class="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50 transition-shadow">
        <!-- Clear icon -->
        <svg class="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        Limpiar
      </button>

      <button 
        class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-all" 
        type="submit">
        <!-- Apply icon -->
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
        Aplicar
      </button>
    </div>
    </form>
  </div>

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


  <!-- Actions Timeline -->
  <ul class="space-y-3">
    <li *ngFor="let a of actions">
      <button (click)="openAction(a)" class="w-full text-left auditoria-item bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow flex items-start gap-3">
        <div class="w-2.5 h-2.5 rounded-full mt-2 bg-indigo-500"></div>
        <div class="flex-1">
          <div class="flex justify-between items-start">
            <div>
              <div class="text-sm font-semibold text-gray-800">{{ a.action }}</div>
              <div class="text-xs text-gray-600 mt-1">{{ a.comment?.message || '-' }}</div>
            </div>
            <div class="text-xs text-gray-400">{{ a.createdAt | date:'short' }}</div>
          </div>
        </div>
      </button>
    </li>
  </ul>
</div>
  `
})
export class AuditoriaDialogComponent implements OnInit {
  actions: AuditAction[] = [];
  loading = false;
  filters: AuditFilters = { order: 'DESC', limit: 50, page: 1 };
  showFilters = false;
  constructor(
    public dialogRef: MatDialogRef<AuditoriaDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AuditoriaDialogData,
    private admin: AdminService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    if (this.data.filters) {
      this.filters = { ...this.filters, ...this.data.filters };
    }
    this.loadActions(this.data.userId, this.filters);
  }

  toggleFilters() {
    this.showFilters = !this.showFilters;
  }

  openAction(a: AuditAction) {
    this.dialog.open(AuditoriaActionDetailComponent, {
      data: a,
      width: 'auto',
      maxWidth: '90vw',
      panelClass: 'auditoria-dialog-panel'
    });
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
      action: this.filters.action,
      startDate: this.filters.startDate,
      endDate: this.filters.endDate
    };
    this.loadActions(this.data.userId, this.filters);
  }

  resetFilters() {
    this.filters = { order: 'DESC', limit: 50, page: 1 };
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
