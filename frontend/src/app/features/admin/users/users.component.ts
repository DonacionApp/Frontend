import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DataTableComponent, TableColumn, TableAction, BatchAction } from '../../../shared/components/data-table/data-table.component';
import { UserManagementService, UserManagement, UpdateUserDTO, CreateUserDTO } from '../../../core/services/user-management.service';
import { ToastService } from '../../../core/services/toast.service';
import { RoleService } from '../../../core/services/role.service';
import { Rol } from '../../../shared/model/rol.model';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { MessageModalComponent } from '../../../shared/components/message-modal/message-modal.component';
import { DetailsModalComponent, DetailItem } from '../../../shared/components/details-modal/details-modal.component';
import { ArticlesService, UserArticle, Article } from '../../../core/services/articles.service';
import { AuthService } from '../../../core/services/auth.service';
import { CountriesService } from '../../../core/services/countries.service';
import { ExportDataComponent } from '../../../shared/components/export-data/export-data.component';
import { ExportMetadata } from '../../../core/services/export.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DataTableComponent, ModalComponent, ConfirmModalComponent, MessageModalComponent, DetailsModalComponent, ExportDataComponent],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss']
})
export class UsersComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  users: UserManagement[] = [];
  loading = false;
  errorMessage = '';
  
  // Modal de cambio de rol
  showChangeRoleModal = false;
  selectedUser: UserManagement | null = null;
  availableRoles: Rol[] = [];
  selectedRoleId: number | null = null;
  changingRole = false;

  // Modal de edición completa
  showEditUserModal = false;
  editUserForm!: FormGroup;
  editingUser = false;

  // Modal de creación de usuario
  showCreateUserModal = false;
  createUserForm!: FormGroup;
  creatingUser = false;
  typeDniOptions: any[] = [];
  countriesOptions: any[] = [];
  statesOptions: any[] = [];
  citiesOptions: any[] = [];
  
  // Pestañas del modal
  activeTab: 'data' | 'articles' = 'data';
  
  // Gestión de artículos del usuario
  userArticles: UserArticle[] = [];
  loadingUserArticles = false;
  availableArticles: Article[] = [];
  selectedArticleId: number | null = null;
  articleQuantity = 1;
  articleNeeded = false;
  addingArticle = false;
  editingArticleQuantity: { id: number; quantity: number } | null = null;

  // Modales
  showDetailsModal = false;
  showConfirmModal = false;
  showMessageModal = false;
  confirmModalConfig: {
    title: string;
    message: string;
    type: 'warning' | 'danger' | 'info';
    onConfirm: () => void;
  } | null = null;
  messageModalConfig: {
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  } | null = null;
  userDetails: DetailItem[] = [];
  selectedUserForAction: UserManagement | null = null;

  // Exportación
  showExportModal = false;
  exportData: any[] = [];

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
      label: 'Editar',
      icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
      action: (row) => this.openEditUserModal(row),
      variant: 'primary'
    },
    {
      label: 'Bloquear',
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
      action: (row) => this.blockUser(row),
      variant: 'secondary',
      visible: (row) => !row.block // Solo mostrar si el usuario NO está bloqueado
    },
    {
      label: 'Desbloquear',
      icon: 'M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z',
      action: (row) => this.unblockUser(row),
      variant: 'secondary',
      visible: (row) => row.block === true // Solo mostrar si el usuario está bloqueado
    },
    {
      label: 'Verificar',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      action: (row) => this.verifyUser(row),
      variant: 'primary',
      visible: (row) => !row.verified // Solo mostrar si el usuario NO está verificado
    },
    {
      label: 'Desverificar',
      icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
      action: (row) => this.unverifyUser(row),
      variant: 'primary',
      visible: (row) => row.verified === true // Solo mostrar si el usuario está verificado
    },
    {
      label: 'Cambiar Rol',
      icon: 'M12 4v16m8-8H4',
      action: (row) => this.openChangeRoleModal(row),
      variant: 'secondary'
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
    private roleService: RoleService,
    private toastService: ToastService,
    private articlesService: ArticlesService,
    private authService: AuthService,
    private countriesService: CountriesService,
    private fb: FormBuilder
  ) {
    this.initializeEditForm();
    this.initializeCreateForm();
  }

  ngOnInit(): void {
    this.loadUsers();
    this.loadRoles();
    this.loadTypeDniOptions();
    this.loadCountries();
  }

  loadRoles(): void {
    this.roleService.getAllRoles()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (roles) => {
          this.availableRoles = roles;
        },
        error: (error) => {
          console.error('Error loading roles:', error);
        }
      });
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
          // Filtrar solo usuarios normales (no organizaciones, no admins)
          this.users = users.filter(user => {
            const role = user.rol?.rol?.toLowerCase();
            return role === 'user' || role === 'donor' || role === 'donante';
          });
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
    this.selectedUserForAction = user;
    this.userDetails = [
      { label: 'Usuario', value: user.username },
      { label: 'Email', value: user.email },
      { label: 'Rol', value: this.getRoleDisplayName(user.rol?.rol || '') },
      { label: 'Verificado', value: user.verified ? 'Sí' : 'No', type: 'badge' },
      { label: 'Bloqueado', value: user.block ? 'Sí' : 'No', type: 'badge' },
      { label: 'Email Verificado', value: user.emailVerified ? 'Sí' : 'No', type: 'badge' },
      { label: 'Último Acceso', value: user.lastLogin || 'Nunca', type: 'date' },
      { label: 'Fecha de Creación', value: user.createdAt, type: 'date' },
      ...(user.people ? [
        { label: 'Nombre', value: user.people.name },
        { label: 'Apellido', value: user.people.lastName || '-' },
        { label: 'Número de identificación', value: user.people.dni || '-' },
        { label: 'Teléfono', value: user.people.telefono || '-' }
      ] : [])
    ];
    this.showDetailsModal = true;
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedUserForAction = null;
    this.userDetails = [];
  }

  blockUser(user: UserManagement): void {
    this.selectedUserForAction = user;
    this.confirmModalConfig = {
      title: 'Bloquear Usuario',
      message: `¿Estás seguro de bloquear al usuario "${user.username}"?`,
      type: 'warning',
      onConfirm: () => this.executeBlockUser(user.id)
    };
    this.showConfirmModal = true;
  }

  executeBlockUser(userId: number): void {
    this.showConfirmModal = false;
    this.userService.blockUser(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Éxito',
            message: 'Usuario bloqueado correctamente',
            type: 'success'
          };
          this.loadUsers();
        },
        error: (error) => {
          console.error('Error blocking user:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo bloquear el usuario';
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Error',
            message: errorMessage,
            type: 'error'
          };
        }
      });
  }

  unblockUser(user: UserManagement): void {
    this.selectedUserForAction = user;
    this.confirmModalConfig = {
      title: 'Desbloquear Usuario',
      message: `¿Estás seguro de desbloquear al usuario "${user.username}"?`,
      type: 'warning',
      onConfirm: () => this.executeUnblockUser(user.id)
    };
    this.showConfirmModal = true;
  }

  executeUnblockUser(userId: number): void {
    this.showConfirmModal = false;
    this.userService.unblockUser(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Éxito',
            message: 'Usuario desbloqueado correctamente',
            type: 'success'
          };
          this.loadUsers();
        },
        error: (error) => {
          console.error('Error unblocking user:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo desbloquear el usuario';
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Error',
            message: errorMessage,
            type: 'error'
          };
        }
      });
  }

  verifyUser(user: UserManagement): void {
    this.selectedUserForAction = user;
    this.confirmModalConfig = {
      title: 'Verificar Usuario',
      message: `¿Estás seguro de verificar al usuario "${user.username}"?`,
      type: 'info',
      onConfirm: () => this.executeVerifyUser(user.id)
    };
    this.showConfirmModal = true;
  }

  executeVerifyUser(userId: number): void {
    this.showConfirmModal = false;
    this.userService.verifyUser(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Éxito',
            message: 'Usuario verificado correctamente',
            type: 'success'
          };
          this.loadUsers();
        },
        error: (error) => {
          console.error('Error verifying user:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo verificar el usuario';
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Error',
            message: errorMessage,
            type: 'error'
          };
        }
      });
  }

  unverifyUser(user: UserManagement): void {
    this.selectedUserForAction = user;
    this.confirmModalConfig = {
      title: 'Desverificar Usuario',
      message: `¿Estás seguro de desverificar al usuario "${user.username}"?`,
      type: 'warning',
      onConfirm: () => this.executeUnverifyUser(user.id)
    };
    this.showConfirmModal = true;
  }

  executeUnverifyUser(userId: number): void {
    this.showConfirmModal = false;
    this.userService.unverifyUser(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Éxito',
            message: 'Usuario desverificado correctamente',
            type: 'success'
          };
          this.loadUsers();
        },
        error: (error) => {
          console.error('Error unverifying user:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo desverificar el usuario';
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Error',
            message: errorMessage,
            type: 'error'
          };
        }
      });
  }

  deleteUser(user: UserManagement): void {
    if (user.rol?.rol === 'admin') {
      this.showMessageModal = true;
      this.messageModalConfig = {
        title: 'Error',
        message: 'No se pueden eliminar usuarios administradores',
        type: 'error'
      };
      return;
    }

    this.selectedUserForAction = user;
    this.confirmModalConfig = {
      title: 'Eliminar Usuario',
      message: `¿Estás seguro de eliminar al usuario "${user.username}"?\n\nEsta acción no se puede deshacer.`,
      type: 'danger',
      onConfirm: () => this.executeDeleteUser(user.id)
    };
    this.showConfirmModal = true;
  }

  executeDeleteUser(userId: number): void {
    this.showConfirmModal = false;
    this.userService.deleteUser(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Éxito',
            message: 'Usuario eliminado correctamente',
            type: 'success'
          };
          this.loadUsers();
        },
        error: (error) => {
          console.error('Error deleting user:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo eliminar el usuario';
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Error',
            message: errorMessage,
            type: 'error'
          };
        }
      });
  }

  closeConfirmModal(): void {
    this.showConfirmModal = false;
    this.confirmModalConfig = null;
    this.selectedUserForAction = null;
  }

  closeMessageModal(): void {
    this.showMessageModal = false;
    this.messageModalConfig = null;
  }

  handleConfirm(): void {
    if (this.confirmModalConfig?.onConfirm) {
      this.confirmModalConfig.onConfirm();
    }
  }

  blockBatch(rows: UserManagement[]): void {
    this.confirmModalConfig = {
      title: 'Bloquear Usuarios',
      message: `¿Estás seguro de bloquear ${rows.length} usuario(s)?`,
      type: 'warning',
      onConfirm: () => this.executeBlockBatch(rows)
    };
    this.showConfirmModal = true;
  }

  executeBlockBatch(rows: UserManagement[]): void {
    this.showConfirmModal = false;
    const operations = rows.map(user => 
      this.userService.blockUser(user.id).pipe(
        catchError(error => {
          console.error(`Error blocking user ${user.id}:`, error);
          return of(null);
        })
      )
    );

    forkJoin(operations)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Éxito',
            message: `${rows.length} usuario(s) bloqueado(s) correctamente`,
            type: 'success'
          };
          this.loadUsers();
        },
        error: (error) => {
          console.error('Error blocking users:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudieron bloquear algunos usuarios';
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Error',
            message: errorMessage,
            type: 'error'
          };
        }
      });
  }

  unblockBatch(rows: UserManagement[]): void {
    this.confirmModalConfig = {
      title: 'Desbloquear Usuarios',
      message: `¿Estás seguro de desbloquear ${rows.length} usuario(s)?`,
      type: 'warning',
      onConfirm: () => this.executeUnblockBatch(rows)
    };
    this.showConfirmModal = true;
  }

  executeUnblockBatch(rows: UserManagement[]): void {
    this.showConfirmModal = false;
    const operations = rows.map(user => 
      this.userService.unblockUser(user.id).pipe(
        catchError(error => {
          console.error(`Error unblocking user ${user.id}:`, error);
          return of(null);
        })
      )
    );

    forkJoin(operations)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Éxito',
            message: `${rows.length} usuario(s) desbloqueado(s) correctamente`,
            type: 'success'
          };
          this.loadUsers();
        },
        error: (error) => {
          console.error('Error unblocking users:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudieron desbloquear algunos usuarios';
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Error',
            message: errorMessage,
            type: 'error'
          };
        }
      });
  }

  deleteBatch(rows: UserManagement[]): void {
    // Filtrar admins
    const nonAdminUsers = rows.filter(user => user.rol?.rol !== 'admin');
    
    if (nonAdminUsers.length === 0) {
      this.showMessageModal = true;
      this.messageModalConfig = {
        title: 'Advertencia',
        message: 'No se pueden eliminar usuarios administradores.',
        type: 'warning'
      };
      return;
    }

    let message = `¿Estás seguro de eliminar ${nonAdminUsers.length} usuario(s)?`;
    if (nonAdminUsers.length !== rows.length) {
      message += '\n\nNota: No se pueden eliminar usuarios administradores. Se eliminarán solo los usuarios no administradores seleccionados.';
    }
    message += '\n\nEsta acción no se puede deshacer.';

    this.confirmModalConfig = {
      title: 'Eliminar Usuarios',
      message: message,
      type: 'danger',
      onConfirm: () => this.executeDeleteBatch(nonAdminUsers)
    };
    this.showConfirmModal = true;
  }

  executeDeleteBatch(nonAdminUsers: UserManagement[]): void {
    this.showConfirmModal = false;
    const ids = nonAdminUsers.map(user => user.id);
    
    this.userService.deleteUsers(ids)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Éxito',
            message: `${nonAdminUsers.length} usuario(s) eliminado(s) correctamente`,
            type: 'success'
          };
          this.loadUsers();
        },
        error: (error) => {
          console.error('Error deleting users:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudieron eliminar los usuarios';
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Error',
            message: errorMessage,
            type: 'error'
          };
        }
      });
  }

  onBatchActionExecuted(event: { action: BatchAction; rows: any[] }): void {
    // La acción ya se ejecutó
  }

  openChangeRoleModal(user: UserManagement): void {
    this.selectedUser = user;
    this.selectedRoleId = user.rol.id || null;
    this.showChangeRoleModal = true;
  }

  closeChangeRoleModal(): void {
    this.showChangeRoleModal = false;
    this.selectedUser = null;
    this.selectedRoleId = null;
  }

  changeUserRole(): void {
    if (!this.selectedUser || !this.selectedRoleId) {
      this.toastService.show({
        title: 'Error',
        message: 'Por favor selecciona un rol válido',
        type: 'error'
      });
      return;
    }

    // No permitir cambiar el rol si ya tiene ese rol
    if (this.selectedUser.rol.id === this.selectedRoleId) {
      this.toastService.show({
        title: 'Información',
        message: 'El usuario ya tiene este rol asignado',
        type: 'info'
      });
      this.closeChangeRoleModal();
      return;
    }

    this.changingRole = true;

    console.log('Changing role for user:', this.selectedUser.id, 'to role:', this.selectedRoleId);

    this.userService.changeUserRole(this.selectedUser.id, this.selectedRoleId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: 'Rol cambiado correctamente',
            type: 'success'
          });
          this.closeChangeRoleModal();
          this.loadUsers();
        },
        error: (error) => {
          console.error('Error changing user role:', error);
          const errorMessage = error.error?.message || error.message || 'No se pudo cambiar el rol del usuario';
          this.toastService.show({
            title: 'Error',
            message: errorMessage,
            type: 'error'
          });
        },
        complete: () => {
          this.changingRole = false;
        }
      });
  }

  getRoleDisplayName(role: string): string {
    const roleMap: { [key: string]: string } = {
      'admin': 'Administrador',
      'donor': 'Donante',
      'organizacion': 'Organización',
      'organization': 'Organización'
    };
    return roleMap[role?.toLowerCase()] || role || '-';
  }

  initializeEditForm(): void {
    this.editUserForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: [''], // Opcional, solo se envía si se cambia
      rolId: ['', Validators.required],
      profilePhoto: [''],
      block: [false],
      verified: [false],
      isVerifiedEmail: [false],
      verificationCode: [''], // Opcional
      people: this.fb.group({
        name: [''],
        lastName: [''],
        birdthDate: [''],
        dni: [''],
        residencia: [''],
        telefono: [''],
        municipio: this.fb.group({
          pais: this.fb.group({
            iso2: ['']
          }),
          state: this.fb.group({
            iso2: ['']
          }),
          city: this.fb.group({
            name: ['']
          })
        })
      })
    });

    // Suscribirse a cambios en el país para cargar estados
    this.editUserForm.get('people.municipio.pais.iso2')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(countryIso => {
        if (countryIso) {
          this.loadStates(countryIso);
        } else {
          this.statesOptions = [];
          this.citiesOptions = [];
          // Limpiar estado y ciudad cuando se limpia el país
          this.editUserForm.get('people.municipio.state.iso2')?.setValue('');
          this.editUserForm.get('people.municipio.city.name')?.setValue('');
        }
      });

    // Suscribirse a cambios en el estado para cargar ciudades
    this.editUserForm.get('people.municipio.state.iso2')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(stateIso => {
        const countryIso = this.editUserForm.get('people.municipio.pais.iso2')?.value;
        if (stateIso && countryIso) {
          this.loadCities(countryIso, stateIso);
        } else {
          this.citiesOptions = [];
          // Limpiar ciudad cuando se limpia el estado
          this.editUserForm.get('people.municipio.city.name')?.setValue('');
        }
      });
  }

  openEditUserModal(user: UserManagement): void {
    this.selectedUser = user;
    this.activeTab = 'data'; // Resetear a la pestaña de datos
    
    // Cargar datos del usuario si no están completos
    if (!user.people && user.id) {
      this.userService.getUserById(user.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (fullUser) => {
            this.populateEditForm(fullUser);
            this.showEditUserModal = true;
            this.loadAvailableArticles();
          },
          error: (error) => {
            console.error('Error loading user details:', error);
            this.toastService.show({
              title: 'Error',
              message: 'No se pudieron cargar los detalles del usuario',
              type: 'error'
            });
          }
        });
    } else {
      this.populateEditForm(user);
      this.showEditUserModal = true;
      this.loadAvailableArticles();
    }
  }

  populateEditForm(user: UserManagement): void {
    const people = user.people;
    
    // Parsear municipio si viene como string JSON o como objeto
    let municipioData: any = {
      pais: { iso2: '' },
      state: { iso2: '' },
      city: { name: '' }
    };
    
    let countryIso = '';
    let stateIso = '';
    
    if (people?.municipio) {
      try {
        let municipioObj: any;
        if (typeof people.municipio === 'string') {
          municipioObj = JSON.parse(people.municipio);
        } else {
          municipioObj = people.municipio;
        }
        
        // Extraer valores del objeto parseado
        countryIso = municipioObj?.pais?.iso2 || '';
        stateIso = municipioObj?.state?.iso2 || '';
        
        municipioData = {
          pais: {
            iso2: countryIso
          },
          state: {
            iso2: stateIso
          },
          city: {
            name: municipioObj?.city?.name || ''
          }
        };
      } catch (e) {
        console.warn('Error parsing municipio:', e);
        // Mantener valores por defecto vacíos
      }
    }
    
    this.editUserForm.patchValue({
      username: user.username || '',
      email: user.email || '',
      password: '', // No prellenar contraseña
      rolId: user.rol?.id || '',
      profilePhoto: user.profilePhoto || '',
      block: user.block || false,
      verified: user.verified || false,
      isVerifiedEmail: user.emailVerified || false,
      verificationCode: user.code || '', // Código de verificación
      people: {
        name: people?.name || '',
        lastName: people?.lastName || '',
        birdthDate: people?.birdthDate ? people.birdthDate.split('T')[0] : '', // Solo fecha sin hora
        dni: people?.dni || '',
        residencia: people?.residencia || '',
        telefono: people?.telefono || '',
        municipio: municipioData
      }
    });

    // Cargar estados y ciudades si hay datos de municipio
    if (countryIso) {
      this.countriesService.statesByCountry(countryIso)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (states) => {
            this.statesOptions = states || [];
            // Una vez cargados los estados, cargar las ciudades si hay estado
            if (stateIso) {
              this.countriesService.citiesByState(countryIso, stateIso)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                  next: (cities) => {
                    this.citiesOptions = cities || [];
                  },
                  error: (error) => {
                    console.error('Error loading cities:', error);
                    this.citiesOptions = [];
                  }
                });
            }
          },
          error: (error) => {
            console.error('Error loading states:', error);
            this.statesOptions = [];
          }
        });
    }
  }

  closeEditUserModal(): void {
    this.showEditUserModal = false;
    this.selectedUser = null;
    this.editUserForm.reset();
    this.initializeEditForm();
    this.activeTab = 'data';
    this.userArticles = [];
    this.selectedArticleId = null;
    this.articleQuantity = 1;
    this.articleNeeded = false;
    this.editingArticleQuantity = null;
  }
  
  // Métodos para gestión de artículos del usuario
  switchTab(tab: 'data' | 'articles'): void {
    this.activeTab = tab;
    if (tab === 'articles' && this.selectedUser) {
      this.loadUserArticles();
    }
  }
  
  loadAvailableArticles(): void {
    this.articlesService.getAllArticles()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (articles) => {
          this.availableArticles = articles;
        },
        error: (error) => {
          console.error('Error loading articles:', error);
        }
      });
  }
  
  loadUserArticles(): void {
    if (!this.selectedUser) return;
    
    this.loadingUserArticles = true;
    this.articlesService.getUserArticlesAdmin(this.selectedUser.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (articles) => {
          this.userArticles = articles;
          this.loadingUserArticles = false;
        },
        error: (error) => {
          console.error('Error loading user articles:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudieron cargar los artículos del usuario';
          alert(`Error: ${errorMessage}`);
          this.loadingUserArticles = false;
        }
      });
  }
  
  addArticleToUser(): void {
    if (!this.selectedUser || !this.selectedArticleId || this.articleQuantity <= 0) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }
    
    this.addingArticle = true;
    this.articlesService.addUserArticleAdmin({
      user: this.selectedUser.id,
      article: this.selectedArticleId,
      cant: this.articleQuantity,
      needed: this.articleNeeded
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: 'Artículo agregado correctamente',
            type: 'success'
          });
          this.selectedArticleId = null;
          this.articleQuantity = 1;
          this.articleNeeded = false;
          this.loadUserArticles();
          this.addingArticle = false;
        },
        error: (error) => {
          console.error('Error adding article:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo agregar el artículo';
          alert(`Error: ${errorMessage}`);
          this.addingArticle = false;
        }
      });
  }
  
  updateArticleQuantity(userArticle: UserArticle): void {
    const newQuantity = prompt(`Ingresa la nueva cantidad para "${userArticle.article.name}":`, userArticle.cant.toString());
    if (!newQuantity || isNaN(Number(newQuantity)) || Number(newQuantity) <= 0) {
      return;
    }
    
    this.editingArticleQuantity = { id: userArticle.id, quantity: Number(newQuantity) };
    
    this.articlesService.updateUserArticleQuantityAdmin({
      userArticleId: userArticle.id,
      cant: Number(newQuantity)
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: 'Cantidad actualizada correctamente',
            type: 'success'
          });
          this.loadUserArticles();
          this.editingArticleQuantity = null;
        },
        error: (error) => {
          console.error('Error updating quantity:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo actualizar la cantidad';
          alert(`Error: ${errorMessage}`);
          this.editingArticleQuantity = null;
        }
      });
  }
  
  toggleArticleNeeded(userArticle: UserArticle): void {
    this.articlesService.updateUserArticleNeededAdmin(userArticle.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: 'Estado actualizado correctamente',
            type: 'success'
          });
          this.loadUserArticles();
        },
        error: (error) => {
          console.error('Error updating needed status:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo actualizar el estado';
          alert(`Error: ${errorMessage}`);
        }
      });
  }
  
  deleteUserArticle(userArticle: UserArticle): void {
    if (!confirm(`¿Estás seguro de eliminar "${userArticle.article.name}" de la lista del usuario?`)) {
      return;
    }
    
    this.articlesService.deleteUserArticleAdmin(userArticle.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: 'Artículo eliminado correctamente',
            type: 'success'
          });
          this.loadUserArticles();
        },
        error: (error) => {
          console.error('Error deleting article:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo eliminar el artículo';
          alert(`Error: ${errorMessage}`);
        }
      });
  }

  saveUserChanges(): void {
    if (this.editUserForm.invalid || !this.selectedUser) {
      this.toastService.show({
        title: 'Error',
        message: 'Por favor completa todos los campos requeridos',
        type: 'error'
      });
      return;
    }

    this.editingUser = true;
    const formValue = this.editUserForm.value;
    
    // Preparar datos para enviar - SOLO los campos permitidos por el endpoint
    const updateData: UpdateUserDTO = {
      username: formValue.username,
      email: formValue.email,
      rolId: Number(formValue.rolId), // Asegurar que sea número
      profilePhoto: formValue.profilePhoto || undefined,
      block: formValue.block,
      verified: formValue.verified,
      isVerifiedEmail: formValue.isVerifiedEmail
    };

    // Solo incluir password si se proporcionó
    if (formValue.password && formValue.password.trim() !== '') {
      updateData.password = formValue.password;
    }

    // Solo incluir verificationCode si se proporcionó
    if (formValue.verificationCode && formValue.verificationCode.trim() !== '') {
      updateData.verificationCode = formValue.verificationCode;
    }

    // Incluir datos de people si existen
    if (formValue.people && (formValue.people.name || formValue.people.dni || formValue.people.lastName)) {
      // Construir objeto municipio en el formato correcto
      let municipioValue: any = null;
      if (formValue.people.municipio) {
        const municipio = formValue.people.municipio;
        // Solo incluir municipio si tiene al menos un valor
        if (municipio.pais?.iso2 || municipio.state?.iso2 || municipio.city?.name) {
          municipioValue = {
            pais: {
              iso2: municipio.pais?.iso2 || null
            },
            state: {
              iso2: municipio.state?.iso2 || null
            },
            city: {
              name: municipio.city?.name || null
            }
          };
        }
      }

      updateData.people = {
        name: formValue.people.name || null,
        lastName: formValue.people.lastName || null,
        birdthDate: formValue.people.birdthDate || null,
        dni: formValue.people.dni || null,
        residencia: formValue.people.residencia || null,
        telefono: formValue.people.telefono || null,
        municipio: municipioValue
      };
    }

    console.log('Enviando datos de actualización:', updateData);

    this.userService.updateUser(this.selectedUser.id, updateData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.editingUser = false; // Desactivar loading antes de cerrar
          this.toastService.show({
            title: 'Éxito',
            message: 'Usuario actualizado correctamente',
            type: 'success'
          });
          this.closeEditUserModal();
          this.loadUsers();
        },
        error: (error) => {
          this.editingUser = false; // Desactivar loading en caso de error
          console.error('Error updating user:', error);
          console.error('Error completo:', JSON.stringify(error, null, 2));
          
          // Extraer mensaje de error más detallado
          let errorMessage = 'No se pudo actualizar el usuario';
          if (error.error) {
            if (error.error.message) {
              errorMessage = error.error.message;
            } else if (typeof error.error === 'string') {
              errorMessage = error.error;
            } else if (error.error.error) {
              errorMessage = error.error.error;
            } else if (Array.isArray(error.error) && error.error.length > 0) {
              errorMessage = error.error.map((e: any) => e.message || e).join(', ');
            }
          } else if (error.message) {
            errorMessage = error.message;
          }

          this.toastService.show({
            title: 'Error al actualizar usuario',
            message: errorMessage,
            type: 'error'
          });
        }
      });
  }

  get editFormControls() {
    return this.editUserForm.controls;
  }

  get peopleFormGroup() {
    return this.editUserForm.get('people') as FormGroup;
  }

  // Métodos para creación de usuario
  initializeCreateForm(): void {
    this.createUserForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rolId: ['', Validators.required],
      people: this.fb.group({
        name: [''],
        lastName: [''],
        birdthDate: [''],
        tipodDni: [''],
        dni: [''],
        residencia: [''],
        telefono: [''],
        municipio: this.fb.group({
          pais: this.fb.group({
            iso2: ['']
          }),
          state: this.fb.group({
            iso2: ['']
          }),
          city: this.fb.group({
            name: ['']
          })
        })
      })
    });

    // Suscribirse a cambios en el país para cargar estados
    this.createUserForm.get('people.municipio.pais.iso2')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(countryIso => {
        if (countryIso) {
          this.loadStates(countryIso);
        } else {
          this.statesOptions = [];
          this.citiesOptions = [];
        }
      });

    // Suscribirse a cambios en el estado para cargar ciudades
    this.createUserForm.get('people.municipio.state.iso2')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(stateIso => {
        const countryIso = this.createUserForm.get('people.municipio.pais.iso2')?.value;
        if (stateIso && countryIso) {
          this.loadCities(countryIso, stateIso);
        } else {
          this.citiesOptions = [];
        }
      });
  }

  loadTypeDniOptions(): void {
    this.authService.loadTypesDni()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (types) => {
          this.typeDniOptions = types || [];
        },
        error: (error) => {
          console.error('Error loading identification types:', error);
        }
      });
  }

  loadCountries(): void {
    this.countriesService.countriesList()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (countries) => {
          this.countriesOptions = countries || [];
        },
        error: (error) => {
          console.error('Error loading countries:', error);
        }
      });
  }

  loadStates(countryIso: string): void {
    this.countriesService.statesByCountry(countryIso)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (states) => {
          this.statesOptions = states || [];
          this.citiesOptions = []; // Limpiar ciudades cuando cambia el estado
        },
        error: (error) => {
          console.error('Error loading states:', error);
          this.statesOptions = [];
        }
      });
  }

  loadCities(countryIso: string, stateIso: string): void {
    this.countriesService.citiesByState(countryIso, stateIso)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cities) => {
          this.citiesOptions = cities || [];
        },
        error: (error) => {
          console.error('Error loading cities:', error);
          this.citiesOptions = [];
        }
      });
  }

  openCreateUserModal(): void {
    this.showCreateUserModal = true;
    this.createUserForm.reset();
    this.initializeCreateForm();
  }

  closeCreateUserModal(): void {
    this.showCreateUserModal = false;
    this.createUserForm.reset();
    this.initializeCreateForm();
  }

  createUser(): void {
    if (this.createUserForm.invalid) {
      this.toastService.show({
        title: 'Error',
        message: 'Por favor completa todos los campos requeridos',
        type: 'error'
      });
      return;
    }

    this.creatingUser = true;
    const formValue = this.createUserForm.value;

    // Preparar datos para enviar
    const createData: CreateUserDTO = {
      username: formValue.username,
      email: formValue.email || undefined,
      password: formValue.password,
      rolId: Number(formValue.rolId)
    };

    // Incluir datos de people si existen
    if (formValue.people && (formValue.people.name || formValue.people.dni || formValue.people.lastName)) {
      let municipioValue: any = null;
      if (formValue.people.municipio) {
        const municipio = formValue.people.municipio;
        if (municipio.pais?.iso2 || municipio.state?.iso2 || municipio.city?.name) {
          municipioValue = {
            pais: {
              iso2: municipio.pais?.iso2 || null
            },
            state: {
              iso2: municipio.state?.iso2 || null
            },
            city: {
              name: municipio.city?.name || null
            }
          };
        }
      }

      createData.people = {
        name: formValue.people.name || undefined,
        lastName: formValue.people.lastName || undefined,
        birdthDate: formValue.people.birdthDate || undefined,
        tipodDni: formValue.people.tipodDni ? Number(formValue.people.tipodDni) : undefined,
        dni: formValue.people.dni || undefined,
        residencia: formValue.people.residencia || undefined,
        telefono: formValue.people.telefono || undefined,
        municipio: municipioValue
      };
    }

    this.userService.createUser(createData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.creatingUser = false;
          this.toastService.show({
            title: 'Éxito',
            message: 'Usuario creado correctamente',
            type: 'success'
          });
          this.closeCreateUserModal();
          this.loadUsers();
        },
        error: (error) => {
          this.creatingUser = false;
          console.error('Error creating user:', error);
          let errorMessage = 'No se pudo crear el usuario';
          if (error.error) {
            if (error.error.message) {
              errorMessage = error.error.message;
            } else if (typeof error.error === 'string') {
              errorMessage = error.error;
            } else if (Array.isArray(error.error) && error.error.length > 0) {
              errorMessage = error.error.map((e: any) => e.message || e).join(', ');
            }
          }
          this.toastService.show({
            title: 'Error',
            message: errorMessage,
            type: 'error'
          });
        }
      });
  }

  get createFormControls() {
    return this.createUserForm.controls;
  }

  get createPeopleFormGroup() {
    return this.createUserForm.get('people') as FormGroup;
  }

  // Métodos de exportación
  openExportModal(): void {
    if (this.users.length === 0) {
      this.toastService.show({
        title: 'Sin datos',
        message: 'No hay usuarios para exportar',
        type: 'info'
      });
      return;
    }
    // Preparar los datos antes de abrir el modal
    this.exportData = this.getExportData();
    this.showExportModal = true;
  }

  closeExportModal(): void {
    this.showExportModal = false;
  }

  onExportComplete(metadata: ExportMetadata): void {
    console.log('Exportación completada:', metadata);
  }

  getExportData(): any[] {
    // Preparar datos para exportación, aplanando objetos anidados
    return this.users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      rol: user.rol?.rol || 'N/A',
      bloqueado: user.block ? 'Sí' : 'No',
      verificado: user.verified ? 'Sí' : 'No',
      emailVerificado: user.emailVerified ? 'Sí' : 'No',
      nombre: user.people?.name || 'N/A',
      apellido: user.people?.lastName || 'N/A',
      dni: user.people?.dni || 'N/A',
      tipoDni: user.people?.typeDni?.type || 'N/A',
      telefono: user.people?.telefono || 'N/A',
      residencia: user.people?.residencia || 'N/A',
      fechaNacimiento: user.people?.birdthDate || 'N/A',
      ubicacion: user.location || 'N/A',
      ultimoLogin: user.lastLogin || 'N/A',
      fechaCreacion: user.createdAt || 'N/A',
      fechaActualizacion: user.updatedAt || 'N/A'
    }));
  }

  getExportColumns(): string[] {
    return [
      'id',
      'username',
      'email',
      'rol',
      'bloqueado',
      'verificado',
      'emailVerificado',
      'nombre',
      'apellido',
      'dni',
      'tipoDni',
      'telefono',
      'residencia',
      'fechaNacimiento',
      'ubicacion',
      'ultimoLogin',
      'fechaCreacion',
      'fechaActualizacion'
    ];
  }

  getExportFilename(): string {
    const today = new Date().toISOString().split('T')[0];
    return `usuarios-${today}`;
  }
}

