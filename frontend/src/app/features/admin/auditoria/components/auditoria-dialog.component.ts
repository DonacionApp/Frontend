import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AdminService, AuditAction } from '../../../../core/services/admin/admin.service';

export interface AuditoriaDialogData {
  userId: number;
  username?: string;
}

@Component({
  selector: 'app-auditoria-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  template: `
    <div class="p-4 max-w-3xl w-full">
      <div class="flex items-start justify-between mb-4">
        <div>
          <h3 class="text-lg font-semibold">Auditoría — {{ data.username || ('ID: ' + data.userId) }}</h3>
          <div class="text-sm text-gray-500">Usuario ID: {{ data.userId }}</div>
        </div>
        <div>
          <button (click)="close()" class="px-3 py-1 text-sm text-gray-700 hover:underline">Cerrar</button>
        </div>
      </div>

      <div *ngIf="loading" class="text-sm text-gray-500">Cargando acciones...</div>
      <div *ngIf="!loading && actions.length === 0" class="text-sm text-gray-500">No se encontraron acciones.</div>

      <div *ngFor="let a of actions" class="border rounded p-3 mb-3 bg-white">
        <div class="flex justify-between items-start">
          <div class="text-sm text-gray-700">Acción: <strong>{{ a.action }}</strong></div>
          <div class="text-xs text-gray-400">{{ a.createdAt | date:'short' }}</div>
        </div>
        <div class="text-sm text-gray-600 mt-2">Estado: {{ a.status }}</div>
        <div *ngIf="a.comment" class="mt-2 text-sm text-gray-700">
          <div><strong>Mensaje:</strong> {{ a.comment.message }}</div>
          <div *ngIf="a.comment.payload" class="mt-2"><strong>Payload:</strong>
            <pre class="text-xs bg-gray-50 p-2 rounded">{{ a.comment.payload | json }}</pre>
          </div>
          <div *ngIf="a.comment.response" class="mt-2"><strong>Respuesta:</strong>
            <pre class="text-xs bg-gray-50 p-2 rounded">{{ a.comment.response | json }}</pre>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AuditoriaDialogComponent implements OnInit {
  actions: AuditAction[] = [];
  loading = false;

  constructor(
    public dialogRef: MatDialogRef<AuditoriaDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AuditoriaDialogData,
    private admin: AdminService
  ) {}

  ngOnInit(): void {
    this.loadActions(this.data.userId);
  }

  loadActions(userId: number) {
    this.loading = true;
    const filters: import('../../../../core/services/admin/admin.service').AuditFilters = { order: 'DESC', limit: 50, page: 1 };
    this.admin.getUserActions(userId, filters).subscribe({
      next: res => { this.actions = res.data || []; this.loading = false; },
      error: () => { this.actions = []; this.loading = false; }
    });
  }

  close() {
    this.dialogRef.close();
  }
}
