import { Component, OnInit } from '@angular/core';
import { AdminService, AdminUser, AuditAction } from '../../../core/services/admin/admin.service';
import { TableColumn } from '../../../shared/components/data-table/data-table.component';

@Component({
  selector: 'app-auditoria',
  standalone: false,
  templateUrl: './auditoria.component.html',
  styleUrl: './auditoria.component.scss'
})
export class AuditoriaComponent implements OnInit {
  users: AdminUser[] = [];
  loading = false;
  columns: TableColumn[] = [
    { key: 'id', label: 'ID', sortable: true, width: '80px' },
    { key: 'username', label: 'Username', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'rol.rol', label: 'Rol', sortable: true },
    { key: 'people.residencia', label: 'Residencia' }
  ];

  // Auditoría seleccionada
  selectedUser: AdminUser | null = null;
  auditActions: AuditAction[] = [];
  auditLoading = false;

  constructor(private admin: AdminService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.admin.getUsers().subscribe({
      next: users => {
        this.users = users;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  onRowClick(row: AdminUser): void {
    // Open audit detail in a new tab
    const origin = window.location.origin;
    const path = `/admin/auditoria/user/${row.id}`;
    window.open(origin + path, '_blank');
  }

  loadAuditForUser(userId: number): void {
    this.auditLoading = true;
    const filters: import('../../../core/services/admin/admin.service').AuditFilters = { action: '', order: 'DESC', limit: 20, page: 1 };
    this.admin.getUserActions(userId, filters).subscribe({
      next: res => {
        this.auditActions = res.data || [];
        this.auditLoading = false;
      },
      error: () => {
        this.auditActions = [];
        this.auditLoading = false;
      }
    });
  }
}
