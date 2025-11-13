import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DataTableComponent, TableColumn, TableAction, BatchAction } from '../../../shared/components/data-table/data-table.component';
import { UserManagementService, UserManagement } from '../../../core/services/user-management.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, DataTableComponent],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss']
})
export class UsersComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  users: UserManagement[] = [];
  loading = false;
  errorMessage = '';

  // Table configuration
  columns: TableColumn[] = [
    { key: 'id', label: 'ID', sortable: true, width: '80px' },
    { 
      key: 'username', 
      label: 'Usuario', 
      sortable: true 
    },
    { 
      key: 'email', 
      label: 'Email', 
      sortable: true 
    },
    { 
      key: 'rol.rol', 
      label: 'Rol', 
      sortable: true,
      render: (value) => {
        const roleMap: { [key: string]: string } = {
          'admin': 'Administrador',
          'donor': 'Donante',
          'organizacion': 'Organización',
          'organization': 'Organización'
        };
        return roleMap[value?.toLowerCase()] || value || '-';
      }
    },
    { 
      key: 'people.name', 
      label: 'Nombre', 
      sortable: false,
      render: (value, row) => {
        if (row.people) {
          return `${row.people.name} ${row.people.lastName || ''}`.trim();
        }
        return '-';
      }
    },
    { 
      key: 'verified', 
      label: 'Verificado', 
      sortable: true,
      renderAsHtml: true,
      render: (value) => {
        if (value) {
          return `<span class="inline-flex items-center gap-1 text-green-600">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
            <span>Sí</span>
          </span>`;
        } else {
          return `<span class="inline-flex items-center gap-1 text-red-600">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
            </svg>
            <span>No</span>
          </span>`;
        }
      }
    },
    { 
      key: 'block', 
      label: 'Estado', 
      sortable: true,
      renderAsHtml: true,
      render: (value) => {
        if (value) {
          return `<span class="inline-flex items-center gap-1 text-red-600">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>
            </svg>
            <span>Bloqueado</span>
          </span>`;
        } else {
          return `<span class="inline-flex items-center gap-1 text-green-600">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
            <span>Activo</span>
          </span>`;
        }
      }
    },
    { 
      key: 'lastLogin', 
      label: 'Último Acceso', 
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('es-ES') : 'Nunca'
    },
    { 
      key: 'createdAt', 
      label: 'Fecha de Creación', 
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('es-ES') : '-'
    }
  ];

  actions: TableAction[] = [
    {
      label: 'Ver',
      icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
      action: (row) => this.viewUserDetails(row),
      variant: 'primary'
    },
    {
      label: 'Bloquear/Desbloquear',
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
      action: (row) => this.toggleBlockUser(row),
      variant: 'secondary'
    },
    {
      label: 'Verificar/Desverificar',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      action: (row) => this.toggleVerifyUser(row),
      variant: 'primary'
    },
    {
      label: 'Eliminar',
      icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
      action: (row) => this.deleteUser(row),
      variant: 'danger',
      disabled: (row) => row.rol?.rol === 'admin' // No permitir eliminar admins
    }
  ];

  batchActions: BatchAction[] = [
    {
      label: 'Bloquear seleccionados',
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
      action: (rows) => this.blockBatch(rows),
      variant: 'secondary',
      confirmMessage: '¿Estás seguro de bloquear los usuarios seleccionados?'
    },
    {
      label: 'Desbloquear seleccionados',
      icon: 'M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z',
      action: (rows) => this.unblockBatch(rows),
      variant: 'secondary',
      confirmMessage: '¿Estás seguro de desbloquear los usuarios seleccionados?'
    },
    {
      label: 'Eliminar seleccionados',
      icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
      action: (rows) => this.deleteBatch(rows),
      variant: 'danger',
      confirmMessage: '¿Estás seguro de eliminar los usuarios seleccionados?',
      disabled: (rows) => rows.some(row => row.rol?.rol === 'admin') // No permitir si hay admins
    }
  ];

  constructor(
    private userService: UserManagementService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadUsers(): void {
    this.loading = true;
    this.errorMessage = '';
    
    this.userService.getAllUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          this.users = users;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading users:', error);
          this.errorMessage = 'Error al cargar los usuarios';
          this.loading = false;
          this.toastService.show({
            title: 'Error',
            message: 'No se pudieron cargar los usuarios',
            type: 'error'
          });
        }
      });
  }

  viewUserDetails(user: UserManagement): void {
    // Por ahora solo mostramos un mensaje, luego se puede implementar un modal
    const details = `
      Usuario: ${user.username}
      Email: ${user.email}
      Rol: ${user.rol?.rol}
      Verificado: ${user.verified ? 'Sí' : 'No'}
      Bloqueado: ${user.block ? 'Sí' : 'No'}
      Último acceso: ${user.lastLogin ? new Date(user.lastLogin).toLocaleString('es-ES') : 'Nunca'}
    `;
    alert(details);
  }

  toggleBlockUser(user: UserManagement): void {
    const action = user.block ? 'desbloquear' : 'bloquear';
    if (!confirm(`¿Estás seguro de ${action} al usuario "${user.username}"?`)) {
      return;
    }

    const operation = user.block 
      ? this.userService.unblockUser(user.id)
      : this.userService.blockUser(user.id);

    operation
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: `Usuario ${action}do correctamente`,
            type: 'success'
          });
          this.loadUsers();
        },
        error: (error) => {
          console.error(`Error ${action}ing user:`, error);
          this.toastService.show({
            title: 'Error',
            message: `No se pudo ${action} el usuario`,
            type: 'error'
          });
        }
      });
  }

  toggleVerifyUser(user: UserManagement): void {
    const action = user.verified ? 'desverificar' : 'verificar';
    if (!confirm(`¿Estás seguro de ${action} al usuario "${user.username}"?`)) {
      return;
    }

    const operation = user.verified 
      ? this.userService.unverifyUser(user.id)
      : this.userService.verifyUser(user.id);

    operation
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: `Usuario ${action}do correctamente`,
            type: 'success'
          });
          this.loadUsers();
        },
        error: (error) => {
          console.error(`Error ${action}ing user:`, error);
          this.toastService.show({
            title: 'Error',
            message: `No se pudo ${action} el usuario`,
            type: 'error'
          });
        }
      });
  }

  deleteUser(user: UserManagement): void {
    if (user.rol?.rol === 'admin') {
      this.toastService.show({
        title: 'Error',
        message: 'No se pueden eliminar usuarios administradores',
        type: 'error'
      });
      return;
    }

    if (!confirm(`¿Estás seguro de eliminar al usuario "${user.username}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    this.userService.deleteUser(user.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: 'Usuario eliminado correctamente',
            type: 'success'
          });
          this.loadUsers();
        },
        error: (error) => {
          console.error('Error deleting user:', error);
          this.toastService.show({
            title: 'Error',
            message: 'No se pudo eliminar el usuario',
            type: 'error'
          });
        }
      });
  }

  blockBatch(rows: UserManagement[]): void {
    const operations = rows.map(user => 
      this.userService.blockUser(user.id).pipe(
        catchError(error => {
          console.error(`Error blocking user ${user.id}:`, error);
          return of(null); // Continuar con otros usuarios aunque uno falle
        })
      )
    );

    forkJoin(operations)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: `${rows.length} usuario(s) bloqueado(s) correctamente`,
            type: 'success'
          });
          this.loadUsers();
        },
        error: (error) => {
          console.error('Error blocking users:', error);
          this.toastService.show({
            title: 'Error',
            message: 'No se pudieron bloquear algunos usuarios',
            type: 'error'
          });
        }
      });
  }

  unblockBatch(rows: UserManagement[]): void {
    const operations = rows.map(user => 
      this.userService.unblockUser(user.id).pipe(
        catchError(error => {
          console.error(`Error unblocking user ${user.id}:`, error);
          return of(null); // Continuar con otros usuarios aunque uno falle
        })
      )
    );

    forkJoin(operations)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: `${rows.length} usuario(s) desbloqueado(s) correctamente`,
            type: 'success'
          });
          this.loadUsers();
        },
        error: (error) => {
          console.error('Error unblocking users:', error);
          this.toastService.show({
            title: 'Error',
            message: 'No se pudieron desbloquear algunos usuarios',
            type: 'error'
          });
        }
      });
  }

  deleteBatch(rows: UserManagement[]): void {
    // Filtrar admins
    const nonAdminUsers = rows.filter(user => user.rol?.rol !== 'admin');
    
    if (nonAdminUsers.length !== rows.length) {
      this.toastService.show({
        title: 'Advertencia',
        message: 'No se pueden eliminar usuarios administradores. Se eliminarán solo los usuarios no administradores seleccionados.',
        type: 'warning'
      });
    }

    if (nonAdminUsers.length === 0) {
      return;
    }

    const ids = nonAdminUsers.map(user => user.id);
    
    this.userService.deleteUsers(ids)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: `${nonAdminUsers.length} usuario(s) eliminado(s) correctamente`,
            type: 'success'
          });
          this.loadUsers();
        },
        error: (error) => {
          console.error('Error deleting users:', error);
          this.toastService.show({
            title: 'Error',
            message: 'No se pudieron eliminar los usuarios',
            type: 'error'
          });
        }
      });
  }

  onBatchActionExecuted(event: { action: BatchAction; rows: any[] }): void {
    // La acción ya se ejecutó
  }
}

