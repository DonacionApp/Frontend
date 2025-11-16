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

@Component({
  selector: 'app-organizations',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DataTableComponent, ModalComponent, ConfirmModalComponent, MessageModalComponent, DetailsModalComponent],
  templateUrl: './organizations.component.html',
  styleUrls: ['./organizations.component.scss']
})
export class OrganizationsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  organizations: UserManagement[] = [];
  loading = false;
  errorMessage = '';
  
  // Modal de cambio de rol
  showChangeRoleModal = false;
  selectedOrganization: UserManagement | null = null;
  availableRoles: Rol[] = [];
  selectedRoleId: number | null = null;
  changingRole = false;

  // Modal de edición completa
  showEditOrganizationModal = false;
  editOrganizationForm!: FormGroup;
  editingOrganization = false;

  // Modal de creación de organización
  showCreateOrganizationModal = false;
  createOrganizationForm!: FormGroup;
  creatingOrganization = false;
  typeDniOptions: any[] = [];
  countriesOptions: any[] = [];
  statesOptions: any[] = [];
  citiesOptions: any[] = [];
  
  // Pestañas del modal
  activeTab: 'data' | 'articles' = 'data';
  
  // Gestión de artículos de la organización
  organizationArticles: UserArticle[] = [];
  loadingOrganizationArticles = false;
  availableArticles: Article[] = [];
  selectedArticleId: number | null = null;
  articleQuantity = 1;
  articleNeeded = false;
  addingArticle = false;
  editingArticleQuantity: { id: number; quantity: number } | null = null;

  // Modales
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
  showDetailsModal = false;
  organizationDetails: DetailItem[] = [];
  selectedOrganizationForAction: UserManagement | null = null;

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
          return row.people.name || '-';
        }
        return '-';
      }
    },
    { 
      key: 'people.lastName', 
      label: 'Descripción', 
      sortable: false,
      render: (value, row) => {
        if (row.people && row.people.lastName) {
          try {
            // Intentar parsear el JSON si viene como string
            const lastNameData = typeof row.people.lastName === 'string' 
              ? JSON.parse(row.people.lastName) 
              : row.people.lastName;
            
            if (lastNameData && typeof lastNameData === 'object' && lastNameData.description) {
              return lastNameData.description || '-';
            }
            return row.people.lastName;
          } catch (e) {
            // Si no es JSON válido, devolver el valor tal cual
            return row.people.lastName;
          }
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
      action: (row) => this.viewOrganizationDetails(row),
      variant: 'primary'
    },
    {
      label: 'Editar',
      icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
      action: (row) => this.openEditOrganizationModal(row),
      variant: 'primary'
    },
    {
      label: 'Bloquear',
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
      action: (row) => this.blockOrganization(row),
      variant: 'secondary',
      visible: (row) => !row.block
    },
    {
      label: 'Desbloquear',
      icon: 'M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z',
      action: (row) => this.unblockOrganization(row),
      variant: 'secondary',
      visible: (row) => row.block === true
    },
    {
      label: 'Verificar',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      action: (row) => this.verifyOrganization(row),
      variant: 'primary',
      visible: (row) => !row.verified
    },
    {
      label: 'Desverificar',
      icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
      action: (row) => this.unverifyOrganization(row),
      variant: 'primary',
      visible: (row) => row.verified === true
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
      action: (row) => this.deleteOrganization(row),
      variant: 'danger',
      disabled: (row) => row.rol?.rol === 'admin'
    }
  ];

  batchActions: BatchAction[] = [
    {
      label: 'Bloquear seleccionadas',
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
      action: (rows) => this.blockBatch(rows),
      variant: 'secondary',
      confirmMessage: '¿Estás seguro de bloquear las organizaciones seleccionadas?'
    },
    {
      label: 'Desbloquear seleccionadas',
      icon: 'M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z',
      action: (rows) => this.unblockBatch(rows),
      variant: 'secondary',
      confirmMessage: '¿Estás seguro de desbloquear las organizaciones seleccionadas?'
    },
    {
      label: 'Eliminar seleccionadas',
      icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
      action: (rows) => this.deleteBatch(rows),
      variant: 'danger',
      confirmMessage: '¿Estás seguro de eliminar las organizaciones seleccionadas?',
      disabled: (rows) => rows.some(row => row.rol?.rol === 'admin')
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
    this.loadOrganizations();
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

  loadOrganizations(): void {
    this.loading = true;
    this.errorMessage = '';
    
    this.userService.getAllUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          // Filtrar solo organizaciones
          this.organizations = users.filter(user => {
            const role = user.rol?.rol?.toLowerCase();
            return role === 'organizacion' || role === 'organization';
          });
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading organizations:', error);
          this.errorMessage = 'Error al cargar las organizaciones';
          this.loading = false;
          this.toastService.show({
            title: 'Error',
            message: 'No se pudieron cargar las organizaciones',
            type: 'error'
          });
        }
      });
  }



  viewOrganizationDetails(organization: UserManagement): void {
    this.selectedOrganizationForAction = organization;
    
    // Parsear la descripción del lastName si existe
    let description = '-';
    if (organization.people?.lastName) {
      try {
        const lastNameData = JSON.parse(organization.people.lastName);
        if (lastNameData && typeof lastNameData === 'object' && lastNameData.description) {
          description = lastNameData.description;
        } else if (typeof organization.people.lastName === 'string' && organization.people.lastName.trim() !== '') {
          // Si no es JSON válido, usar el valor directamente
          description = organization.people.lastName;
        }
      } catch (e) {
        // Si no es JSON, usar el valor directamente
        description = organization.people.lastName;
      }
    }

    this.organizationDetails = [
      { label: 'Organización', value: organization.username },
      { label: 'Email', value: organization.email },
      { label: 'Rol', value: this.getRoleDisplayName(organization.rol?.rol || '') },
      { label: 'Verificado', value: organization.verified ? 'Sí' : 'No', type: 'badge' },
      { label: 'Bloqueado', value: organization.block ? 'Sí' : 'No', type: 'badge' },
      { label: 'Email Verificado', value: organization.emailVerified ? 'Sí' : 'No', type: 'badge' },
      { label: 'Último Acceso', value: organization.lastLogin || 'Nunca', type: 'date' },
      { label: 'Fecha de Creación', value: organization.createdAt, type: 'date' },
      ...(organization.people ? [
        { label: 'Nombre', value: organization.people.name },
        { label: 'Descripción', value: description },
        { label: 'DNI', value: organization.people.dni || '-' },
        { label: 'Teléfono', value: organization.people.telefono || '-' }
      ] : [])
    ];
    this.showDetailsModal = true;
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedOrganizationForAction = null;
    this.organizationDetails = [];
  }

  openEditOrganizationModal(organization: UserManagement): void {
    this.selectedOrganization = organization;
    this.activeTab = 'data';
    
    // Cargar datos completos de la organización si no están disponibles
    if (!organization.people && organization.id) {
      this.userService.getUserById(organization.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (fullOrganization) => {
            this.populateEditForm(fullOrganization);
            this.showEditOrganizationModal = true;
            this.loadAvailableArticles();
          },
          error: (error) => {
            console.error('Error loading organization details:', error);
            this.toastService.show({
              title: 'Error',
              message: 'No se pudieron cargar los detalles de la organización',
              type: 'error'
            });
          }
        });
    } else {
      this.populateEditForm(organization);
      this.showEditOrganizationModal = true;
      this.loadAvailableArticles();
    }
  }

  closeEditOrganizationModal(): void {
    this.showEditOrganizationModal = false;
    this.selectedOrganization = null;
    this.editingOrganization = false;
    this.activeTab = 'data';
    this.organizationArticles = [];
    this.loadingOrganizationArticles = false;
    this.selectedArticleId = null;
    this.articleQuantity = 1;
    this.articleNeeded = false;
    this.addingArticle = false;
    this.editingArticleQuantity = null;
    this.editOrganizationForm.reset();
    this.initializeEditForm();
  }

  switchTab(tab: 'data' | 'articles'): void {
    this.activeTab = tab;
    if (tab === 'articles' && this.selectedOrganization) {
      this.loadOrganizationArticles();
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

  loadOrganizationArticles(): void {
    if (!this.selectedOrganization) return;
    
    this.loadingOrganizationArticles = true;
    this.articlesService.getUserArticlesAdmin(this.selectedOrganization.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (articles) => {
          this.organizationArticles = Array.isArray(articles) ? articles : [];
          this.loadingOrganizationArticles = false;
        },
        error: (error) => {
          console.error('Error loading organization articles:', error);
          this.organizationArticles = [];
          this.loadingOrganizationArticles = false;
        }
      });
  }

  saveOrganization(): void {
    if (this.editOrganizationForm.invalid || !this.selectedOrganization) {
      this.toastService.show({
        title: 'Error',
        message: 'Por favor completa todos los campos requeridos',
        type: 'error'
      });
      this.editOrganizationForm.markAllAsTouched();
      return;
    }

    this.editingOrganization = true;
    const formValue = this.editOrganizationForm.value;
    
    // Preparar datos para enviar
    const updateData: UpdateUserDTO = {
      username: formValue.username,
      email: formValue.email,
      profilePhoto: formValue.profilePhoto || undefined
    };

    // Incluir datos de people si existen
    if (formValue.people && (formValue.people.name || formValue.people.dni || formValue.description)) {
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

      // Para organizaciones, la descripción se guarda en lastName como JSON
      let lastNameValue: string | null = null;
      if (formValue.description) {
        lastNameValue = JSON.stringify({ description: formValue.description });
      } else if (formValue.people.lastName) {
        // Mantener el lastName existente si no hay nueva descripción
        lastNameValue = formValue.people.lastName;
      }

      updateData.people = {
        name: formValue.people.name || null,
        lastName: lastNameValue,
        birdthDate: formValue.people.birdthDate || null,
        dni: formValue.people.dni || null,
        residencia: formValue.people.residencia || null,
        telefono: formValue.people.telefono || null,
        municipio: municipioValue
      };
    }

    this.userService.updateUser(this.selectedOrganization.id, updateData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.editingOrganization = false;
          this.toastService.show({
            title: 'Éxito',
            message: 'Organización actualizada correctamente',
            type: 'success'
          });
          this.closeEditOrganizationModal();
          this.loadOrganizations();
        },
        error: (error) => {
          this.editingOrganization = false;
          console.error('Error updating organization:', error);
          let errorMessage = 'No se pudo actualizar la organización';
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

  blockOrganization(organization: UserManagement): void {
    if (!confirm(`¿Estás seguro de bloquear a ${organization.username}?`)) {
      return;
    }

    this.userService.blockUser(organization.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          alert('Organización bloqueada correctamente');
          this.loadOrganizations();
        },
        error: (error) => {
          console.error('Error blocking organization:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo bloquear la organización';
          alert(`Error: ${errorMessage}`);
        }
      });
  }

  unblockOrganization(organization: UserManagement): void {
    if (!confirm(`¿Estás seguro de desbloquear a ${organization.username}?`)) {
      return;
    }

    this.userService.unblockUser(organization.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          alert('Organización desbloqueada correctamente');
          this.loadOrganizations();
        },
        error: (error) => {
          console.error('Error unblocking organization:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo desbloquear la organización';
          alert(`Error: ${errorMessage}`);
        }
      });
  }

  verifyOrganization(organization: UserManagement): void {
    if (!confirm(`¿Estás seguro de verificar a ${organization.username}?`)) {
      return;
    }

    this.userService.verifyUser(organization.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          alert('Organización verificada correctamente');
          this.loadOrganizations();
        },
        error: (error) => {
          console.error('Error verifying organization:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo verificar la organización';
          alert(`Error: ${errorMessage}`);
        }
      });
  }

  unverifyOrganization(organization: UserManagement): void {
    if (!confirm(`¿Estás seguro de desverificar a ${organization.username}?`)) {
      return;
    }

    this.userService.unverifyUser(organization.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          alert('Organización desverificada correctamente');
          this.loadOrganizations();
        },
        error: (error) => {
          console.error('Error unverifying organization:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo desverificar la organización';
          alert(`Error: ${errorMessage}`);
        }
      });
  }

  openChangeRoleModal(organization: UserManagement): void {
    this.selectedOrganization = organization;
    this.selectedRoleId = organization.rol?.id || null;
    this.showChangeRoleModal = true;
  }

  closeChangeRoleModal(): void {
    this.showChangeRoleModal = false;
    this.selectedOrganization = null;
    this.selectedRoleId = null;
    this.changingRole = false;
  }

  changeRole(): void {
    if (!this.selectedOrganization || !this.selectedRoleId) {
      return;
    }

    this.changingRole = true;
    this.userService.changeUserRole(this.selectedOrganization.id, this.selectedRoleId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Éxito',
            message: 'Rol cambiado correctamente',
            type: 'success'
          };
          this.closeChangeRoleModal();
          this.loadOrganizations();
        },
        error: (error) => {
          console.error('Error changing role:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo cambiar el rol';
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Error',
            message: errorMessage,
            type: 'error'
          };
          this.changingRole = false;
        }
      });
  }

  deleteOrganization(organization: UserManagement): void {
    this.confirmModalConfig = {
      title: 'Eliminar Organización',
      message: `¿Estás seguro de eliminar a ${organization.username}?\n\nEsta acción no se puede deshacer.`,
      type: 'danger',
      onConfirm: () => this.executeDeleteOrganization(organization.id)
    };
    this.showConfirmModal = true;
  }

  executeDeleteOrganization(organizationId: number): void {
    this.showConfirmModal = false;
    this.userService.deleteUser(organizationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Éxito',
            message: 'Organización eliminada correctamente',
            type: 'success'
          };
          this.loadOrganizations();
        },
        error: (error) => {
          console.error('Error deleting organization:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo eliminar la organización';
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Error',
            message: errorMessage,
            type: 'error'
          };
        }
      });
  }

  blockBatch(organizations: UserManagement[]): void {
    this.confirmModalConfig = {
      title: 'Bloquear Organizaciones',
      message: `¿Estás seguro de bloquear ${organizations.length} organización(es)?`,
      type: 'warning',
      onConfirm: () => this.executeBlockBatch(organizations)
    };
    this.showConfirmModal = true;
  }

  executeBlockBatch(organizations: UserManagement[]): void {
    this.showConfirmModal = false;
    const requests = organizations.map(org => 
      this.userService.blockUser(org.id).pipe(
        catchError(error => {
          console.error(`Error blocking organization ${org.id}:`, error);
          return of(null);
        })
      )
    );

    forkJoin(requests)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Éxito',
            message: `${organizations.length} organización(es) bloqueada(s)`,
            type: 'success'
          };
          this.loadOrganizations();
        }
      });
  }

  unblockBatch(organizations: UserManagement[]): void {
    this.confirmModalConfig = {
      title: 'Desbloquear Organizaciones',
      message: `¿Estás seguro de desbloquear ${organizations.length} organización(es)?`,
      type: 'warning',
      onConfirm: () => this.executeUnblockBatch(organizations)
    };
    this.showConfirmModal = true;
  }

  executeUnblockBatch(organizations: UserManagement[]): void {
    this.showConfirmModal = false;
    const requests = organizations.map(org => 
      this.userService.unblockUser(org.id).pipe(
        catchError(error => {
          console.error(`Error unblocking organization ${org.id}:`, error);
          return of(null);
        })
      )
    );

    forkJoin(requests)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Éxito',
            message: `${organizations.length} organización(es) desbloqueada(s)`,
            type: 'success'
          };
          this.loadOrganizations();
        }
      });
  }

  deleteBatch(organizations: UserManagement[]): void {
    this.confirmModalConfig = {
      title: 'Eliminar Organizaciones',
      message: `¿Estás seguro de eliminar ${organizations.length} organización(es)?\n\nEsta acción no se puede deshacer.`,
      type: 'danger',
      onConfirm: () => this.executeDeleteBatch(organizations)
    };
    this.showConfirmModal = true;
  }

  executeDeleteBatch(organizations: UserManagement[]): void {
    this.showConfirmModal = false;
    const ids = organizations.map(org => org.id);
    this.userService.deleteUsers(ids)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Éxito',
            message: `${organizations.length} organización(es) eliminada(s)`,
            type: 'success'
          };
          this.loadOrganizations();
        },
        error: (error) => {
          console.error('Error deleting organizations:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudieron eliminar las organizaciones';
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
    // El evento ya contiene la acción y las filas, los métodos específicos se llaman directamente
  }

  // Métodos para gestión de artículos (similar a users.component.ts)
  addArticleToOrganization(): void {
    if (!this.selectedOrganization || !this.selectedArticleId) {
      return;
    }

    this.addingArticle = true;
    this.articlesService.addUserArticleAdmin({
      user: this.selectedOrganization.id,
      article: this.selectedArticleId,
      cant: this.articleQuantity,
      needed: this.articleNeeded
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Éxito',
            message: 'Artículo agregado correctamente',
            type: 'success'
          };
          this.loadOrganizationArticles();
          this.selectedArticleId = null;
          this.articleQuantity = 1;
          this.articleNeeded = false;
          this.addingArticle = false;
        },
        error: (error) => {
          console.error('Error adding article:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo agregar el artículo';
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Error',
            message: errorMessage,
            type: 'error'
          };
          this.addingArticle = false;
        }
      });
  }

  updateArticleQuantity(userArticle: UserArticle): void {
    const newQuantity = prompt('Ingresa la nueva cantidad:', userArticle.cant.toString());
    if (!newQuantity || isNaN(Number(newQuantity))) {
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
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Éxito',
            message: 'Cantidad actualizada correctamente',
            type: 'success'
          };
          this.loadOrganizationArticles();
          this.editingArticleQuantity = null;
        },
        error: (error) => {
          console.error('Error updating quantity:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo actualizar la cantidad';
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Error',
            message: errorMessage,
            type: 'error'
          };
          this.editingArticleQuantity = null;
        }
      });
  }

  toggleArticleNeeded(userArticle: UserArticle): void {
    this.articlesService.updateUserArticleNeededAdmin(userArticle.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Éxito',
            message: 'Estado actualizado correctamente',
            type: 'success'
          };
          this.loadOrganizationArticles();
        },
        error: (error) => {
          console.error('Error toggling needed:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo actualizar el estado';
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Error',
            message: errorMessage,
            type: 'error'
          };
        }
      });
  }

  deleteOrganizationArticle(userArticle: UserArticle): void {
    this.confirmModalConfig = {
      title: 'Eliminar Artículo',
      message: '¿Estás seguro de eliminar este artículo?',
      type: 'warning',
      onConfirm: () => this.executeDeleteOrganizationArticle(userArticle.id)
    };
    this.showConfirmModal = true;
  }

  executeDeleteOrganizationArticle(userArticleId: number): void {
    this.showConfirmModal = false;
    this.articlesService.deleteUserArticleAdmin(userArticleId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Éxito',
            message: 'Artículo eliminado correctamente',
            type: 'success'
          };
          this.loadOrganizationArticles();
        },
        error: (error) => {
          console.error('Error deleting article:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo eliminar el artículo';
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

  // Métodos para edición de organización
  initializeEditForm(): void {
    this.editOrganizationForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      profilePhoto: [''],
      description: [''], // Descripción de la organización
      people: this.fb.group({
        name: [''],
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
    this.editOrganizationForm.get('people.municipio.pais.iso2')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(countryIso => {
        if (countryIso) {
          this.loadStates(countryIso);
        } else {
          this.statesOptions = [];
          this.citiesOptions = [];
          // Limpiar estado y ciudad cuando se limpia el país
          this.editOrganizationForm.get('people.municipio.state.iso2')?.setValue('');
          this.editOrganizationForm.get('people.municipio.city.name')?.setValue('');
        }
      });

    // Suscribirse a cambios en el estado para cargar ciudades
    this.editOrganizationForm.get('people.municipio.state.iso2')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(stateIso => {
        const countryIso = this.editOrganizationForm.get('people.municipio.pais.iso2')?.value;
        if (stateIso && countryIso) {
          this.loadCities(countryIso, stateIso);
        } else {
          this.citiesOptions = [];
          // Limpiar ciudad cuando se limpia el estado
          this.editOrganizationForm.get('people.municipio.city.name')?.setValue('');
        }
      });
  }

  populateEditForm(organization: UserManagement): void {
    const people = organization.people;
    
    // Parsear municipio si viene como string JSON o como objeto
    let municipioData: any = {
      pais: { iso2: '' },
      state: { iso2: '' },
      city: { name: '' }
    };
    
    let countryIso = '';
    let stateIso = '';
    let description = '';

    // Parsear descripción de lastName (JSON)
    if (people?.lastName) {
      try {
        const lastNameData = typeof people.lastName === 'string' 
          ? JSON.parse(people.lastName) 
          : people.lastName;
        
        if (lastNameData && typeof lastNameData === 'object' && lastNameData.description) {
          description = lastNameData.description;
        }
      } catch (e) {
        // Si no es JSON válido, dejar vacío
        console.warn('Error parsing description from lastName:', e);
      }
    }
    
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
    
    this.editOrganizationForm.patchValue({
      username: organization.username || '',
      email: organization.email || '',
      profilePhoto: organization.profilePhoto || '',
      description: description,
      people: {
        name: people?.name || '',
        birdthDate: people?.birdthDate ? people.birdthDate.split('T')[0] : '',
        tipodDni: people?.typeDni?.id || '',
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

  get editFormControls() {
    return this.editOrganizationForm.controls;
  }

  get editPeopleFormGroup() {
    return this.editOrganizationForm.get('people') as FormGroup;
  }

  // Métodos para creación de organización
  initializeCreateForm(): void {
    this.createOrganizationForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rolId: ['', Validators.required],
      description: [''], // Descripción de la organización
      people: this.fb.group({
        name: [''],
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
    this.createOrganizationForm.get('people.municipio.pais.iso2')?.valueChanges
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
    this.createOrganizationForm.get('people.municipio.state.iso2')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(stateIso => {
        const countryIso = this.createOrganizationForm.get('people.municipio.pais.iso2')?.value;
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
          console.error('Error loading DNI types:', error);
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
          this.citiesOptions = [];
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

  openCreateOrganizationModal(): void {
    this.showCreateOrganizationModal = true;
    this.createOrganizationForm.reset();
    this.initializeCreateForm();
  }

  closeCreateOrganizationModal(): void {
    this.showCreateOrganizationModal = false;
    this.createOrganizationForm.reset();
    this.initializeCreateForm();
  }

  createOrganization(): void {
    if (this.createOrganizationForm.invalid) {
      this.toastService.show({
        title: 'Error',
        message: 'Por favor completa todos los campos requeridos',
        type: 'error'
      });
      return;
    }

    this.creatingOrganization = true;
    const formValue = this.createOrganizationForm.value;

    // Preparar datos para enviar
    const createData: CreateUserDTO = {
      username: formValue.username,
      email: formValue.email || undefined,
      password: formValue.password,
      rolId: Number(formValue.rolId)
    };

    // Incluir datos de people si existen
    if (formValue.people && (formValue.people.name || formValue.people.dni || formValue.description)) {
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

      // Para organizaciones, la descripción se guarda en lastName como JSON
      let lastNameValue: string | undefined = undefined;
      if (formValue.description) {
        lastNameValue = JSON.stringify({ description: formValue.description });
      }

      createData.people = {
        name: formValue.people.name || undefined,
        lastName: lastNameValue,
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
          this.creatingOrganization = false;
          this.toastService.show({
            title: 'Éxito',
            message: 'Organización creada correctamente',
            type: 'success'
          });
          this.closeCreateOrganizationModal();
          this.loadOrganizations();
        },
        error: (error) => {
          this.creatingOrganization = false;
          console.error('Error creating organization:', error);
          let errorMessage = 'No se pudo crear la organización';
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
    return this.createOrganizationForm.controls;
  }

  get createPeopleFormGroup() {
    return this.createOrganizationForm.get('people') as FormGroup;
  }
}

