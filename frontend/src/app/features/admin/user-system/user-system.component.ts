import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { DataTableComponent, TableColumn, TableAction } from '../../../shared/components/data-table/data-table.component';
import { UserSystemService, UserSystem, UserSystemFilters } from '../../../core/services/user-system.service';
import { DetailsModalComponent, DetailItem } from '../../../shared/components/details-modal/details-modal.component';
import { MessageModalComponent } from '../../../shared/components/message-modal/message-modal.component';

@Component({
  selector: 'app-user-system',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DataTableComponent, DetailsModalComponent, MessageModalComponent],
  templateUrl: './user-system.component.html',
  styleUrls: ['./user-system.component.scss']
})
export class UserSystemComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  users: UserSystem[] = [];
  loading = false;
  errorMessage = '';

  // Filtros
  filterForm!: FormGroup;
  showFilters = false;
  currentCursor: string | undefined;
  hasMore = false;

  // Modales
  showDetailsModal = false;
  showMessageModal = false;
  userDetails: DetailItem[] = [];
  messageModalConfig: {
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  } | null = null;

  // Table configuration
  columns: TableColumn[] = [
    { 
      key: 'user.id', 
      label: 'ID', 
      sortable: true, 
      width: '80px',
      render: (value, row) => row.user?.id || '-'
    },
    { 
      key: 'user.username', 
      label: 'Usuario', 
      sortable: true,
      render: (value, row) => row.user?.username || '-'
    },
    { 
      key: 'user.email', 
      label: 'Email', 
      sortable: true,
      render: (value, row) => row.user?.email || '-'
    },
    { 
      key: 'role.name', 
      label: 'Rol', 
      sortable: true,
      render: (value) => {
        const roleMap: { [key: string]: string } = {
          'admin': 'Administrador',
          'donor': 'Donante',
          'user': 'Usuario',
          'organizacion': 'Organización',
          'organization': 'Organización'
        };
        return roleMap[value?.toLowerCase()] || value || '-';
      }
    },
    { 
      key: 'people.name', 
      label: 'Nombre Completo', 
      sortable: false,
      render: (value, row) => {
        if (row.people) {
          return `${row.people.name} ${row.people.lastName || ''}`.trim();
        }
        return '-';
      }
    },
    { 
      key: 'people.dni', 
      label: 'Número de identificación', 
      sortable: false,
      render: (value, row) => row.people?.dni || '-'
    }
  ];

  actions: TableAction[] = [
    {
      label: 'Ver Detalles',
      icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
      action: (row) => this.viewUserDetails(row),
      variant: 'primary'
    }
  ];

  constructor(
    private userSystemService: UserSystemService,
    private fb: FormBuilder
  ) {
    this.initFilterForm();
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initFilterForm(): void {
    this.filterForm = this.fb.group({
      limit: [20],
      search: [''],
      role: ['']
    });
  }

  /**
   * Cargar usuarios que han aceptado los términos
   */
  loadUsers(cursor?: string): void {
    this.loading = true;
    this.errorMessage = '';

    const filters: UserSystemFilters = {
      limit: this.filterForm.value.limit || 20,
      search: this.filterForm.value.search || undefined,
      role: this.filterForm.value.role || undefined,
      cursor: cursor || this.currentCursor || undefined
    };

    this.userSystemService.getUserSystems(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (cursor) {
            // Si hay cursor, agregar a la lista existente (paginación)
            this.users = [...this.users, ...response.items];
          } else {
            // Si no hay cursor, reemplazar la lista (nueva búsqueda)
            this.users = response.items;
          }
          this.currentCursor = response.cursor;
          this.hasMore = response.hasMore || false;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading users:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudieron cargar los usuarios';
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Error',
            message: errorMessage,
            type: 'error'
          };
          this.loading = false;
          this.users = [];
        }
      });
  }

  /**
   * Aplicar filtros
   */
  applyFilters(): void {
    this.currentCursor = undefined; // Reset cursor al aplicar nuevos filtros
    this.loadUsers();
  }

  /**
   * Limpiar filtros
   */
  clearFilters(): void {
    this.filterForm.patchValue({
      limit: 20,
      search: '',
      role: ''
    });
    this.currentCursor = undefined;
    this.loadUsers();
  }

  /**
   * Cargar más usuarios (paginación)
   */
  loadMore(): void {
    if (this.currentCursor && !this.loading) {
      this.loadUsers(this.currentCursor);
    }
  }

  /**
   * Ver detalles del usuario
   */
  viewUserDetails(user: UserSystem): void {
    const roleName = user.role?.name || 'N/A';
    const isOrganization = roleName.toLowerCase() === 'organizacion' || roleName.toLowerCase() === 'organization';
    
    // Parsear la descripción del lastName si es una organización
    let description: string | null = null;
    if (isOrganization && user.people?.lastName) {
      try {
        const lastNameData = JSON.parse(user.people.lastName);
        if (lastNameData && typeof lastNameData === 'object' && lastNameData.description) {
          description = lastNameData.description;
        }
      } catch (e) {
        // Si no es JSON válido, intentar usar el valor directamente si parece ser texto
        if (typeof user.people.lastName === 'string' && user.people.lastName.trim() !== '') {
          // Si no empieza con {, probablemente no es JSON
          if (!user.people.lastName.trim().startsWith('{')) {
            description = user.people.lastName;
          }
        }
      }
    }

    this.userDetails = [
      { label: 'ID', value: user.user?.id || 'N/A' },
      { label: 'Usuario', value: user.user?.username || 'N/A' },
      { label: 'Email', value: user.user?.email || 'N/A' },
      { label: 'Rol', value: this.getRoleDisplayName(roleName) },
      { label: 'Nombre', value: user.people?.name || 'N/A' },
      ...(isOrganization && description ? [
        { label: 'Descripción', value: description }
      ] : [])
    ];
    this.showDetailsModal = true;
  }

  getRoleDisplayName(role: string): string {
    const roleMap: { [key: string]: string } = {
      'admin': 'Administrador',
      'donor': 'Donante',
      'donante': 'Donante',
      'user': 'Usuario',
      'organizacion': 'Organización',
      'organization': 'Organización'
    };
    return roleMap[role?.toLowerCase()] || role || '-';
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.userDetails = [];
  }

  closeMessageModal(): void {
    this.showMessageModal = false;
    this.messageModalConfig = null;
  }

  /**
   * Toggle mostrar/ocultar filtros
   */
  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }
}

