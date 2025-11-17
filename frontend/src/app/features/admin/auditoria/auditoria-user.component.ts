import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AdminService, AuditAction } from '../../../core/services/admin/admin.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-6">
      <button class="mb-4 text-sm text-blue-600 hover:underline" (click)="goBack()">← Volver</button>
      <h2 class="text-xl font-semibold mb-4">Auditoría del usuario (ID: {{ userId }})</h2>

      <div *ngIf="loading" class="text-sm text-gray-500">Cargando acciones...</div>
      <div *ngIf="!loading && actions.length === 0" class="text-sm text-gray-500">No se encontraron acciones.</div>

      <ul *ngIf="!loading && actions.length > 0" class="space-y-4">
        <li *ngFor="let a of actions" class="border rounded p-4 bg-white">
          <div class="flex justify-between items-start">
            <div>
              <div class="text-sm text-gray-600">Acción: <strong>{{ a.action }}</strong></div>
              <div class="text-sm text-gray-500">Estado: {{ a.status }}</div>
            </div>
            <div class="text-xs text-gray-400">{{ a.createdAt | date:'short' }}</div>
          </div>

          <div *ngIf="a.comment" class="mt-3 text-sm text-gray-700">
            <div><strong>Mensaje:</strong> {{ a.comment.message }}</div>
            <div *ngIf="a.comment.payload" class="mt-2"><strong>Payload:</strong>
              <pre class="text-xs bg-gray-50 p-2 rounded">{{ a.comment.payload | json }}</pre>
            </div>
            <div *ngIf="a.comment.response" class="mt-2"><strong>Respuesta:</strong>
              <pre class="text-xs bg-gray-50 p-2 rounded">{{ a.comment.response | json }}</pre>
            </div>
          </div>
        </li>
      </ul>
    </div>
  `
})
export class AuditoriaUserComponent implements OnInit {
  userId: number | null = null;
  actions: AuditAction[] = [];
  loading = false;

  constructor(private route: ActivatedRoute, private admin: AdminService) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.userId = id;
      this.loadActions(id);
    }
  }

  loadActions(userId: number) {
    this.loading = true;
    const filters: import('../../../core/services/admin/admin.service').AuditFilters = { order: 'DESC', limit: 50, page: 1 };
    this.admin.getUserActions(userId, filters).subscribe({
      next: res => { this.actions = res.data || []; this.loading = false; },
      error: () => { this.actions = []; this.loading = false; }
    });
  }

  goBack() {
    window.close();
  }
}
