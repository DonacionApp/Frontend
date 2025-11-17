import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DataTableComponent, TableColumn, TableAction, BatchAction } from '../../../shared/components/data-table/data-table.component';
import { 
  DonationService, 
  Donation, 
  DonationByUser,
  UpdateDonationDTO, 
  UpdateDonationStatusDTO,
  StatusDonation 
} from '../../../core/services/donation.service';
import { NotificationService } from '../../../shared/services/notification.service';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PostsService, Post } from '../../../core/services/posts.service';
import { UserManagementService, UserManagement } from '../../../core/services/user-management.service';
import { ExportDataComponent } from '../../../shared/components/export-data/export-data.component';
import { ExportMetadata } from '../../../core/services/export.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-donations',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DataTableComponent, ModalComponent, ExportDataComponent],
  templateUrl: './donations.component.html',
  styleUrls: ['./donations.component.scss']
})
export class DonationsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Vista actual: 'users' o 'donations'
  currentView: 'users' | 'donations' = 'users';
  selectedUser: UserManagement | null = null;
  
  // Lista de usuarios
  users: UserManagement[] = [];
  loadingUsers = false;
  
  // Donaciones del usuario seleccionado
  donations: DonationByUser[] = [];
  loading = false;
  errorMessage = '';

  // Modal de edición de donación
  showEditDonationModal = false;
  editDonationForm!: FormGroup;
  editingDonation: Donation | null = null;
  updatingDonation = false;

  // Modal de gestión de artículos
  showArticlesModal = false;
  currentDonationArticles: any[] = [];
  currentDonationId: number | null = null;
  availablePostArticles: any[] = [];
  selectedPostArticleId: number | null = null;
  articleQuantity = 1;
  addingArticle = false;

  // Modal de cambio de estado
  showStatusModal = false;
  availableStatuses: StatusDonation[] = [];
  selectedStatusId: number | null = null;
  changingStatus = false;

  // Modal de reviews
  showReviewsModal = false;
  donationReviews: any[] = [];

  // Exportación
  showExportModal = false;

  // Table configuration
  columns: TableColumn[] = [
    { key: 'id', label: 'ID', sortable: true, width: '80px' },
    { 
      key: 'post', 
      label: 'Post', 
      sortable: false,
      render: (value) => value?.title || '-'
    },
    { 
      key: 'lugarDonacion', 
      label: 'Lugar Donación', 
      sortable: true 
    },
    { 
      key: 'statusDonation', 
      label: 'Estado', 
      sortable: false,
      render: (value) => value?.status || '-'
    },
    { 
      key: 'articles', 
      label: 'Artículos', 
      sortable: false,
      render: (value) => value && Array.isArray(value) ? value.length : 0
    },
    { 
      key: 'fechaMaximaEntrega', 
      label: 'Fecha Entrega', 
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('es-ES') : '-'
    },
    { 
      key: 'createdAt', 
      label: 'Fecha Creación', 
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('es-ES') : '-'
    }
  ];

  actions: TableAction[] = [
    {
      label: 'Editar',
      icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
      action: (row) => this.openEditDonationModal(row),
      variant: 'primary'
    },
    {
      label: 'Artículos',
      icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
      action: (row) => this.openArticlesModal(row),
      variant: 'secondary'
    },
    {
      label: 'Estado',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      action: (row) => this.openStatusModal(row),
      variant: 'secondary'
    },
    {
      label: 'Extender Fecha',
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      action: (row) => this.extendDeliveryDate(row),
      variant: 'secondary'
    },
    {
      label: 'Reviews',
      icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
      action: (row) => this.openReviewsModal(row),
      variant: 'secondary'
    },
    {
      label: 'Eliminar',
      icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
      action: (row) => this.deleteDonation(row),
      variant: 'danger'
    }
  ];

  batchActions: BatchAction[] = [
    {
      label: 'Eliminar seleccionadas',
      icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
      action: (rows) => this.deleteBatch(rows),
      variant: 'danger',
      confirmMessage: '¿Estás seguro de eliminar las donaciones seleccionadas?'
    }
  ];

  constructor(
    private donationService: DonationService,
    private postsService: PostsService,
    private userService: UserManagementService,
    private fb: FormBuilder,
    private notificationService: NotificationService
  ) {
    this.initForms();
  }

  ngOnInit(): void {
    this.loadUsers();
    this.loadStatuses();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initForms(): void {
    this.editDonationForm = this.fb.group({
      lugarDonacion: ['', [Validators.required]],
      fechaMaximaEntrega: ['', [Validators.required]]
    });
  }

  loadUsers(): void {
    this.loadingUsers = true;
    this.errorMessage = '';
    
    this.userService.getAllUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          this.users = users;
          this.loadingUsers = false;
        },
        error: (error) => {
          console.error('Error loading users:', error);
          this.errorMessage = 'Error al cargar los usuarios';
          this.loadingUsers = false;
          this.notificationService.error('Error', 'No se pudieron cargar los usuarios');
        }
      });
  }

  selectUser(user: UserManagement): void {
    this.selectedUser = user;
    this.currentView = 'donations';
    this.loadDonationsByUser(user.id);
  }

  goBackToUsers(): void {
    this.currentView = 'users';
    this.selectedUser = null;
    this.donations = [];
  }

  loadDonationsByUser(userId: number): void {
    this.loading = true;
    this.errorMessage = '';
    
    this.donationService.getDonationsByUserId(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (donations) => {
          this.donations = donations;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading donations:', error);
          this.errorMessage = 'Error al cargar las donaciones del usuario';
          this.loading = false;
          this.notificationService.error('Error', 'No se pudieron cargar las donaciones del usuario');
        }
      });
  }

  loadStatuses(): void {
    this.donationService.getAllDonationStatuses()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (statuses) => {
          this.availableStatuses = statuses;
        },
        error: (error) => {
          console.error('Error loading statuses:', error);
        }
      });
  }

  // Modal de edición de donación
  openEditDonationModal(donation: DonationByUser): void {
    this.editingDonation = donation as any;
    const fecha = donation.fechaMaximaEntrega ? new Date(donation.fechaMaximaEntrega).toISOString().split('T')[0] : '';
    this.editDonationForm.patchValue({
      lugarDonacion: donation.lugarDonacion,
      fechaMaximaEntrega: fecha
    });
    this.showEditDonationModal = true;
  }

  closeEditDonationModal(): void {
    this.showEditDonationModal = false;
    this.editingDonation = null;
    this.editDonationForm.reset();
  }

  saveDonation(): void {
    if (this.editDonationForm.invalid || !this.editingDonation) {
      this.editDonationForm.markAllAsTouched();
      return;
    }

    this.updatingDonation = true;
    const formValue = this.editDonationForm.value;
    const updateData: UpdateDonationDTO = {
      lugarDonacion: formValue.lugarDonacion,
      fechaMaximaEntrega: new Date(formValue.fechaMaximaEntrega).toISOString()
    };

    this.donationService.updateDonationAdmin(this.editingDonation.id, updateData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notificationService.success('Éxito', 'Donación actualizada correctamente');
          this.closeEditDonationModal();
          if (this.selectedUser) {
            this.loadDonationsByUser(this.selectedUser.id);
          }
        },
        error: (error) => {
          console.error('Error updating donation:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo actualizar la donación';
          alert(`Error: ${errorMessage}`);
          this.updatingDonation = false;
        }
      });
  }

  // Modal de gestión de artículos
  openArticlesModal(donation: DonationByUser): void {
    this.currentDonationId = donation.id;
    this.currentDonationArticles = donation.articles || [];
    this.selectedPostArticleId = null;
    this.articleQuantity = 1;
    this.loadPostArticles(donation.post?.id);
    this.showArticlesModal = true;
  }

  closeArticlesModal(): void {
    this.showArticlesModal = false;
    this.currentDonationId = null;
    this.currentDonationArticles = [];
    this.selectedPostArticleId = null;
    this.articleQuantity = 1;
  }

  loadPostArticles(postId?: number): void {
    if (!postId) {
      this.availablePostArticles = [];
      return;
    }

    this.postsService.getPostById(postId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (post) => {
          this.availablePostArticles = post.postArticle || [];
        },
        error: (error) => {
          console.error('Error loading post articles:', error);
          this.availablePostArticles = [];
        }
      });
  }

  addArticleToDonation(): void {
    if (!this.currentDonationId || !this.selectedPostArticleId || this.articleQuantity <= 0) {
      return;
    }

    this.addingArticle = true;
    this.donationService.addArticleToDonationAdmin(
      this.currentDonationId,
      this.selectedPostArticleId,
      this.articleQuantity
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notificationService.success('Éxito', 'Artículo agregado correctamente');
          this.selectedPostArticleId = null;
          this.articleQuantity = 1;
          // Recargar donaciones del usuario
          if (this.selectedUser) {
            this.loadDonationsByUser(this.selectedUser.id);
            // Actualizar lista de artículos después de un breve delay
            setTimeout(() => {
              if (this.currentDonationId) {
                const donation = this.donations.find(d => d.id === this.currentDonationId);
                if (donation) {
                  this.currentDonationArticles = donation.articles || [];
                }
              }
            }, 500);
          }
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

  removeArticleFromDonation(articleId: number): void {
    if (!confirm('¿Estás seguro de eliminar este artículo de la donación?')) {
      return;
    }

    this.donationService.removeArticleFromDonationAdmin(articleId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notificationService.success('Éxito', 'Artículo eliminado correctamente');
          // Recargar donaciones del usuario
          if (this.selectedUser) {
            this.loadDonationsByUser(this.selectedUser.id);
            // Actualizar lista de artículos después de un breve delay
            setTimeout(() => {
              this.currentDonationArticles = this.currentDonationArticles.filter(a => a.id !== articleId);
            }, 500);
          }
        },
        error: (error) => {
          console.error('Error removing article:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo eliminar el artículo';
          alert(`Error: ${errorMessage}`);
        }
      });
  }

  updateArticleQuantity(articleId: number, currentQuantity: number | string): void {
    const currentQty = typeof currentQuantity === 'string' ? Number(currentQuantity) : currentQuantity;
    const newQuantity = prompt('Ingrese la nueva cantidad:', String(currentQty));
    if (!newQuantity || isNaN(Number(newQuantity)) || Number(newQuantity) <= 0) {
      return;
    }

    this.donationService.updateArticleQuantityAdmin(articleId, Number(newQuantity))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notificationService.success('Éxito', 'Cantidad actualizada correctamente');
          // Recargar donaciones del usuario
          if (this.selectedUser) {
            this.loadDonationsByUser(this.selectedUser.id);
            // Actualizar lista de artículos después de un breve delay
            setTimeout(() => {
              if (this.currentDonationId) {
                const donation = this.donations.find(d => d.id === this.currentDonationId);
                if (donation) {
                  this.currentDonationArticles = donation.articles || [];
                }
              }
            }, 500);
          }
        },
        error: (error) => {
          console.error('Error updating quantity:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo actualizar la cantidad';
          alert(`Error: ${errorMessage}`);
        }
      });
  }

  // Modal de cambio de estado
  openStatusModal(donation: DonationByUser): void {
    this.editingDonation = donation as any;
    this.selectedStatusId = donation.statusDonation?.id || null;
    this.showStatusModal = true;
  }

  closeStatusModal(): void {
    this.showStatusModal = false;
    this.editingDonation = null;
    this.selectedStatusId = null;
    this.changingStatus = false;
  }

  changeStatus(): void {
    if (!this.editingDonation || !this.selectedStatusId) {
      return;
    }

    this.changingStatus = true;
    const statusData: UpdateDonationStatusDTO = {
      status: this.selectedStatusId
    };

    this.donationService.updateDonationStatusAdmin(this.editingDonation.id, statusData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.changingStatus = false;
          this.notificationService.success('Éxito', 'Estado actualizado correctamente');
          this.closeStatusModal();
          if (this.selectedUser) {
            this.loadDonationsByUser(this.selectedUser.id);
          }
        },
        error: (error) => {
          console.error('Error changing status:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo actualizar el estado';
          alert(`Error: ${errorMessage}`);
          this.changingStatus = false;
        }
      });
  }

  // Extender fecha de entrega
  extendDeliveryDate(donation: DonationByUser): void {
    if (!confirm('¿Estás seguro de extender la fecha de entrega en 10 días?')) {
      return;
    }

    this.donationService.updateDonationDateAdmin(donation.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notificationService.success('Éxito', 'Fecha de entrega extendida correctamente');
          if (this.selectedUser) {
            this.loadDonationsByUser(this.selectedUser.id);
          }
        },
        error: (error) => {
          console.error('Error extending date:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo extender la fecha';
          alert(`Error: ${errorMessage}`);
        }
      });
  }

  // Modal de reviews
  openReviewsModal(donation: DonationByUser): void {
    this.currentDonationId = donation.id;
    this.loadDonationReviews();
    this.showReviewsModal = true;
  }

  closeReviewsModal(): void {
    this.showReviewsModal = false;
    this.currentDonationId = null;
    this.donationReviews = [];
  }

  loadDonationReviews(): void {
    this.donationService.getAllDonationReviews()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (reviews) => {
          // Filtrar reviews de la donación actual si es necesario
          this.donationReviews = reviews;
        },
        error: (error) => {
          console.error('Error loading reviews:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudieron cargar las reviews';
          alert(`Error: ${errorMessage}`);
          this.donationReviews = [];
        }
      });
  }

  deleteReview(reviewId: number): void {
    if (!confirm('¿Estás seguro de eliminar esta review?')) {
      return;
    }

    this.donationService.deleteDonationReviewAdmin(reviewId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notificationService.success('Éxito', 'Review eliminada correctamente');
          this.loadDonationReviews();
        },
        error: (error) => {
          console.error('Error deleting review:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo eliminar la review';
          alert(`Error: ${errorMessage}`);
        }
      });
  }

  // Eliminar donación
  deleteDonation(donation: DonationByUser): void {
    if (!confirm(`¿Estás seguro de eliminar la donación #${donation.id}?`)) {
      return;
    }

    this.donationService.deleteDonationAdmin(donation.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notificationService.success('Éxito', 'Donación eliminada correctamente');
          if (this.selectedUser) {
            this.loadDonationsByUser(this.selectedUser.id);
          }
        },
        error: (error) => {
          console.error('Error deleting donation:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo eliminar la donación';
          alert(`Error: ${errorMessage}`);
        }
      });
  }

  deleteBatch(rows: DonationByUser[]): void {
    const deleteObservables = rows.map(donation => 
      this.donationService.deleteDonationAdmin(donation.id).pipe(
        catchError(error => {
          console.error(`Error deleting donation ${donation.id}:`, error);
          return of(null);
        })
      )
    );

    forkJoin(deleteObservables)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notificationService.success('Éxito', `${rows.length} donación(es) eliminada(s) correctamente`);
          if (this.selectedUser) {
            this.loadDonationsByUser(this.selectedUser.id);
          }
        },
        error: (error) => {
          console.error('Error deleting donations:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudieron eliminar algunas donaciones';
          alert(`Error: ${errorMessage}`);
          if (this.selectedUser) {
            this.loadDonationsByUser(this.selectedUser.id);
          }
        }
      });
  }

  onBatchActionExecuted(event: { action: BatchAction; rows: any[] }): void {
    // La acción ya se ejecutó
  }

  // Métodos de exportación
  openExportModal(): void {
    if (this.donations.length === 0) {
      this.notificationService.info('Sin datos', 'No hay donaciones para exportar');
      return;
    }
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
    return this.donations.map(donation => ({
      id: donation.id,
      tituloPost: donation.post?.title || 'N/A',
      lugarRecogida: donation.lugarRecogida || 'N/A',
      lugarDonacion: donation.lugarDonacion || 'N/A',
      estado: donation.statusDonation?.status || 'N/A',
      fechaMaximaEntrega: donation.fechaMaximaEntrega ? new Date(donation.fechaMaximaEntrega).toLocaleDateString('es-ES') : 'N/A',
      donador: donation.donator?.username || 'N/A',
      beneficiario: donation.beneficiary?.username || 'N/A',
      cantidadArticulos: donation.articles?.length || 0,
      articulos: donation.articles?.map((a: any) => `${a.article?.name || 'N/A'} (${a.quantity || 0})`).join(', ') || 'N/A',
      fechaCreacion: donation.createdAt ? new Date(donation.createdAt).toLocaleDateString('es-ES') : 'N/A',
      fechaActualizacion: donation.updatedAt ? new Date(donation.updatedAt).toLocaleDateString('es-ES') : 'N/A'
    }));
  }

  getExportColumns(): string[] {
    return [
      'id',
      'tituloPost',
      'lugarRecogida',
      'lugarDonacion',
      'estado',
      'fechaMaximaEntrega',
      'donador',
      'beneficiario',
      'cantidadArticulos',
      'articulos',
      'fechaCreacion',
      'fechaActualizacion'
    ];
  }

  getExportFilename(): string {
    const today = new Date().toISOString().split('T')[0];
    const username = this.selectedUser?.username || 'usuario';
    return `donaciones-${username}-${today}`;
  }
}

