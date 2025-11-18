import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AuditAction } from '../../../../core/services/admin/admin.service';

@Component({
  selector: 'app-auditoria-action-detail',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  template: `
    <div class="p-4 w-[min(720px,90vw)]">
      <div class="flex justify-between items-start mb-3">
        <div>
          <h3 class="text-lg font-semibold">Detalle de acción</h3>
          <div class="text-sm text-gray-500">{{ data.action }} — {{ data.user?.username || 'Sistema' }}</div>
        </div>
        <div>
          <button (click)="close()" class="text-sm text-gray-600 hover:underline">Cerrar</button>
        </div>
      </div>

      <div class="text-sm text-gray-700 mb-2">
        <strong>Mensaje:</strong>
        <div class="mt-1">{{ data.comment?.message || '-' }}</div>
      </div>

      <div class="mb-3">
        <strong class="text-sm text-gray-700">Fecha:</strong>
        <div class="text-sm text-gray-600">{{ data.createdAt | date:'medium' }}</div>
      </div>

      <div *ngIf="data.comment?.payload" class="mb-3">
        <strong class="text-sm text-gray-700">Payload</strong>
        <pre class="auditoria-pre mt-2">{{ data.comment?.payload | json }}</pre>
      </div>

      <div *ngIf="data.comment?.response">
        <strong class="text-sm text-gray-700">Respuesta</strong>
        <pre class="auditoria-pre mt-2">{{ data.comment?.response | json }}</pre>
      </div>
    </div>
  `
})
export class AuditoriaActionDetailComponent {
  constructor(
    public dialogRef: MatDialogRef<AuditoriaActionDetailComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AuditAction
  ) {}

  close() { this.dialogRef.close(); }
}
