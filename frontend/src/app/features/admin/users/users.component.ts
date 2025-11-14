import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DataTableComponent, TableColumn, TableAction, BatchAction } from '../../../shared/components/data-table/data-table.component';
import { UserManagementService, UserManagement, UpdateUserDTO } from '../../../core/services/user-management.service';
import { ToastService } from '../../../core/services/toast.service';
import { RoleService } from '../../../core/services/role.service';
import { Rol } from '../../../shared/model/rol.model';
import { ModalComponent } from '../../../shared/components/modal/modal.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DataTableComponent, ModalComponent],
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
    private fb: FormBuilder
  ) {
    this.initializeEditForm();
  }

  ngOnInit(): void {
    this.loadUsers();
    this.loadRoles();
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

  blockUser(user: UserManagement): void {
    if (!confirm(`¿Estás seguro de bloquear al usuario "${user.username}"?`)) {
      return;
    }

    this.userService.blockUser(user.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: 'Usuario bloqueado correctamente',
            type: 'success'
          });
          this.loadUsers();
        },
        error: (error) => {
          console.error('Error blocking user:', error);
          this.toastService.show({
            title: 'Error',
            message: 'No se pudo bloquear el usuario',
            type: 'error'
          });
        }
      });
  }

  unblockUser(user: UserManagement): void {
    if (!confirm(`¿Estás seguro de desbloquear al usuario "${user.username}"?`)) {
      return;
    }

    this.userService.unblockUser(user.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: 'Usuario desbloqueado correctamente',
            type: 'success'
          });
          this.loadUsers();
        },
        error: (error) => {
          console.error('Error unblocking user:', error);
          this.toastService.show({
            title: 'Error',
            message: 'No se pudo desbloquear el usuario',
            type: 'error'
          });
        }
      });
  }

  verifyUser(user: UserManagement): void {
    if (!confirm(`¿Estás seguro de verificar al usuario "${user.username}"?`)) {
      return;
    }

    this.userService.verifyUser(user.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: 'Usuario verificado correctamente',
            type: 'success'
          });
          this.loadUsers();
        },
        error: (error) => {
          console.error('Error verifying user:', error);
          this.toastService.show({
            title: 'Error',
            message: 'No se pudo verificar el usuario',
            type: 'error'
          });
        }
      });
  }

  unverifyUser(user: UserManagement): void {
    if (!confirm(`¿Estás seguro de desverificar al usuario "${user.username}"?`)) {
      return;
    }

    this.userService.unverifyUser(user.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: 'Usuario desverificado correctamente',
            type: 'success'
          });
          this.loadUsers();
        },
        error: (error) => {
          console.error('Error unverifying user:', error);
          this.toastService.show({
            title: 'Error',
            message: 'No se pudo desverificar el usuario',
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
  }

  openEditUserModal(user: UserManagement): void {
    this.selectedUser = user;
    
    // Cargar datos del usuario si no están completos
    if (!user.people && user.id) {
      this.userService.getUserById(user.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (fullUser) => {
            this.populateEditForm(fullUser);
            this.showEditUserModal = true;
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
    
    if (people?.municipio) {
      try {
        let municipioObj: any;
        if (typeof people.municipio === 'string') {
          municipioObj = JSON.parse(people.municipio);
        } else {
          municipioObj = people.municipio;
        }
        
        // Extraer valores del objeto parseado
        municipioData = {
          pais: {
            iso2: municipioObj?.pais?.iso2 || ''
          },
          state: {
            iso2: municipioObj?.state?.iso2 || ''
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
  }

  closeEditUserModal(): void {
    this.showEditUserModal = false;
    this.selectedUser = null;
    this.editUserForm.reset();
    this.initializeEditForm();
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
}

