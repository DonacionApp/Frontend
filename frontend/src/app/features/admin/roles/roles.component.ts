import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { DataTableComponent, TableColumn, TableAction, BatchAction } from '../../../shared/components/data-table/data-table.component';
import { RoleService, CreateRoleDTO, UpdateRoleDTO } from '../../../core/services/role.service';
import { Rol } from '../../../shared/model/rol.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DataTableComponent],
  templateUrl: './roles.component.html',
  styleUrls: ['./roles.component.scss']
})
export class RolesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  roles: Rol[] = [];
  loading = false;
  errorMessage = '';

  // Modal state
  showModal = false;
  isEditMode = false;
  editingRole: Rol | null = null;
  roleForm!: FormGroup;

  // Table configuration
  columns: TableColumn[] = [
    { key: 'id', label: 'ID', sortable: true, width: '80px' },
    { key: 'rol', label: 'Nombre del Rol', sortable: true },
    { 
      key: 'createdAt', 
      label: 'Fecha de Creación', 
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('es-ES') : '-'
    },
    { 
      key: 'updatedAt', 
      label: 'Última Actualización', 
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('es-ES') : '-'
    }
  ];

  actions: TableAction[] = [
    {
      label: 'Editar',
      icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
      action: (row) => this.editRole(row),
      variant: 'primary'
    },
    {
      label: 'Eliminar',
      icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
      action: (row) => this.deleteRole(row),
      variant: 'danger'
    }
  ];

  batchActions: BatchAction[] = [
    {
      label: 'Eliminar seleccionados',
      icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
      action: (rows) => this.deleteBatch(rows),
      variant: 'danger',
      confirmMessage: '¿Estás seguro de eliminar los roles seleccionados?'
    }
  ];

  constructor(
    private roleService: RoleService,
    private fb: FormBuilder,
    private toastService: ToastService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadRoles();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initForm(): void {
    this.roleForm = this.fb.group({
      rol: ['', [Validators.required, Validators.minLength(2)]]
    });
  }

  loadRoles(): void {
    this.loading = true;
    this.errorMessage = '';
    
    this.roleService.getAllRoles()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (roles) => {
          this.roles = roles;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading roles:', error);
          this.errorMessage = 'Error al cargar los roles';
          this.loading = false;
          this.toastService.show({
            title: 'Error',
            message: 'No se pudieron cargar los roles',
            type: 'error'
          });
        }
      });
  }

  openCreateModal(): void {
    this.isEditMode = false;
    this.editingRole = null;
    this.roleForm.reset();
    this.showModal = true;
  }

  editRole(role: Rol): void {
    this.isEditMode = true;
    this.editingRole = role;
    this.roleForm.patchValue({
      rol: role.rol
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.isEditMode = false;
    this.editingRole = null;
    this.roleForm.reset();
  }

  saveRole(): void {
    if (this.roleForm.invalid) {
      this.roleForm.markAllAsTouched();
      return;
    }

    const formValue = this.roleForm.value;

    if (this.isEditMode && this.editingRole) {
      const updateData: UpdateRoleDTO = {
        rol: formValue.rol
      };

      this.roleService.updateRole(this.editingRole.id, updateData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.toastService.show({
              title: 'Éxito',
              message: 'Rol actualizado correctamente',
              type: 'success'
            });
            this.closeModal();
            this.loadRoles();
          },
          error: (error) => {
            console.error('Error updating role:', error);
            this.toastService.show({
              title: 'Error',
              message: 'No se pudo actualizar el rol',
              type: 'error'
            });
          }
        });
    } else {
      const createData: CreateRoleDTO = {
        rol: formValue.rol
      };

      this.roleService.createRole(createData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.toastService.show({
              title: 'Éxito',
              message: 'Rol creado correctamente',
              type: 'success'
            });
            this.closeModal();
            this.loadRoles();
          },
          error: (error) => {
            console.error('Error creating role:', error);
            this.toastService.show({
              title: 'Error',
              message: 'No se pudo crear el rol',
              type: 'error'
            });
          }
        });
    }
  }

  deleteRole(role: Rol): void {
    if (!confirm(`¿Estás seguro de eliminar el rol "${role.rol}"?`)) {
      return;
    }

    this.roleService.deleteRole(role.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: 'Rol eliminado correctamente',
            type: 'success'
          });
          this.loadRoles();
        },
        error: (error) => {
          console.error('Error deleting role:', error);
          this.toastService.show({
            title: 'Error',
            message: 'No se pudo eliminar el rol',
            type: 'error'
          });
        }
      });
  }

  deleteBatch(rows: Rol[]): void {
    const ids = rows.map(row => row.id);
    
    this.roleService.deleteRoles(ids)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: `${rows.length} rol(es) eliminado(s) correctamente`,
            type: 'success'
          });
          this.loadRoles();
        },
        error: (error) => {
          console.error('Error deleting roles:', error);
          this.toastService.show({
            title: 'Error',
            message: 'No se pudieron eliminar los roles',
            type: 'error'
          });
        }
      });
  }

  onBatchActionExecuted(event: { action: BatchAction; rows: any[] }): void {
    // La acción ya se ejecutó, solo recargar si es necesario
    // this.loadRoles();
  }
}

