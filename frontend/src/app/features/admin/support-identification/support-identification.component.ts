import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject, takeUntil } from 'rxjs';
import { DataTableComponent, TableColumn, TableAction } from '../../../shared/components/data-table/data-table.component';
import { 
  SupportIdentificationService,
  CommentSupport,
  CommentSupportFilterDTO,
  UserWithSupport
} from '../../../core/services/support-identification.service';
import { NotificationService } from '../../../shared/services/notification.service';
import { ModalComponent } from '../../../shared/components/modal/modal.component';

@Component({
  selector: 'app-support-identification',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DataTableComponent, ModalComponent],
  templateUrl: './support-identification.component.html',
  styleUrls: ['./support-identification.component.scss']
})
export class SupportIdentificationComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Vista actual: 'users' o 'support'
  currentView: 'users' | 'support' = 'users';
  selectedUser: UserWithSupport | null = null;

  // Lista de usuarios con soporte
  users: UserWithSupport[] = [];
  loadingUsers = false;

  // Comentario de soporte del usuario seleccionado
  userCommentSupport: CommentSupport | null = null;
  loadingSupport = false;
  errorMessage = '';
  
  // Visor de documento
  showDocumentViewer = false;

  // Filtros
  filterForm!: FormGroup;
  showFilters = false;

  // Modal de aceptar soporte
  showAcceptModal = false;
  acceptForm!: FormGroup;
  acceptingSupport = false;
  selectedCommentSupport: CommentSupport | null = null;

  // Modal de rechazar soporte
  showRejectModal = false;
  rejectForm!: FormGroup;
  rejectingSupport = false;

  // Modal de editar comentario
  showEditCommentModal = false;
  editCommentForm!: FormGroup;
  editingComment = false;

  // Table configuration para usuarios
  userColumns: TableColumn[] = [
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
      key: 'people.name', 
      label: 'Nombre', 
      sortable: false,
      render: (value, row) => {
        if (row.people) {
          return `${row.people.name || ''} ${row.people.lastName || ''}`.trim() || '-';
        }
        return '-';
      }
    },
    { 
      key: 'role.name', 
      label: 'Rol', 
      sortable: false,
      render: (value) => value || '-'
    }
  ];

  userActions: TableAction[] = [
    {
      label: 'Ver Soporte',
      icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
      action: (row) => this.selectUser(row),
      variant: 'primary'
    }
  ];

  constructor(
    private supportService: SupportIdentificationService,
    private notificationService: NotificationService,
    private fb: FormBuilder,
    private sanitizer: DomSanitizer
  ) {
    this.initForms();
  }

  ngOnInit(): void {
    this.loadUsersWithSupport();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initForms(): void {
    this.filterForm = this.fb.group({
      idStatusSupportId: [''],
      idUser: [''],
      search: [''],
      sortBy: ['createdAt'],
      sortOrder: ['DESC']
    });

    this.acceptForm = this.fb.group({
      comment: ['', [Validators.required]]
    });

    this.rejectForm = this.fb.group({
      comment: ['', [Validators.required]]
    });

    this.editCommentForm = this.fb.group({
      newComment: ['', [Validators.required]]
    });
  }

  selectUser(user: UserWithSupport): void {
    this.selectedUser = user;
    this.currentView = 'support';
    this.loadUserSupport(user.id);
  }

  goBackToUsers(): void {
    this.currentView = 'users';
    this.selectedUser = null;
    this.userCommentSupport = null;
    this.showDocumentViewer = false;
  }
  
  toggleDocumentViewer(): void {
    this.showDocumentViewer = !this.showDocumentViewer;
  }
  
  getDocumentUrl(): string {
    return this.selectedUser?.people?.supportId || '';
  }
  
  getSafeDocumentUrl(): SafeResourceUrl {
    const url = this.getDocumentUrl();
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : '';
  }
  
  isPdfDocument(url: string): boolean {
    if (!url) return false;
    return url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf');
  }
  
  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.style.display = 'none';
    }
  }

  loadUserSupport(userId: number): void {
    this.loadingSupport = true;
    this.errorMessage = '';

    this.supportService.getUserCommentSupport(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (comments) => {
          // Tomar el primer comentario si existe
          this.userCommentSupport = comments && comments.length > 0 ? comments[0] : null;
          this.loadingSupport = false;
          
          // Si no hay comentarios, no es un error, solo informamos
          if (!this.userCommentSupport) {
            this.errorMessage = '';
          }
        },
        error: (error) => {
          console.error('Error loading user support:', error);
          const errorMessage = error?.error?.message || error?.message || '';
          
          // Si el error es que no se encontraron comentarios o es un 400/404, no mostrar alert
          // El 400 puede indicar que el usuario no tiene comentarios de soporte aún
          if (errorMessage.toLowerCase().includes('no se encontraron comentarios') || 
              errorMessage.toLowerCase().includes('not found') ||
              errorMessage.toLowerCase().includes('bad request') ||
              error.status === 404 ||
              error.status === 400) {
            this.userCommentSupport = null;
            this.errorMessage = '';
            this.loadingSupport = false;
            return;
          }
          
          // Para otros errores, mostrar alert
          this.errorMessage = 'Error al cargar el soporte del usuario';
          this.loadingSupport = false;
          alert(`Error: ${errorMessage}`);
        }
      });
  }

  loadUsersWithSupport(): void {
    this.loadingUsers = true;
    this.errorMessage = '';

    const searchValue = this.filterForm?.value?.search || '';

    this.supportService.getUsersWithSupport({
      limit: 100,
      search: searchValue,
      orderBy: 'created',
      order: 'DESC'
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          // Asegurar que siempre sea un array
          this.users = Array.isArray(users) ? users : [];
          this.loadingUsers = false;
        },
        error: (error) => {
          console.error('Error loading users with support:', error);
          this.errorMessage = 'Error al cargar los usuarios';
          this.loadingUsers = false;
          this.users = []; // Asegurar que sea un array vacío en caso de error
          const errorMessage = error?.error?.message || error?.message || 'No se pudieron cargar los usuarios';
          alert(`Error: ${errorMessage}`);
        }
      });
  }

  openAcceptModal(): void {
    if (!this.selectedUser) return;
    this.acceptForm.reset();
    this.acceptForm.patchValue({
      comment: ''
    });
    this.showAcceptModal = true;
  }

  closeAcceptModal(): void {
    this.showAcceptModal = false;
    this.acceptForm.reset();
  }

  acceptSupport(): void {
    if (this.acceptForm.invalid || !this.selectedUser) {
      // Si el formulario es inválido, marcar los campos como touched para mostrar errores
      if (this.acceptForm.invalid) {
        this.acceptForm.markAllAsTouched();
      }
      return;
    }
    
    // Validar que el comentario no esté vacío
    const comment = this.acceptForm.value.comment?.trim();
    if (!comment || comment === '') {
      this.acceptForm.get('comment')?.setErrors({ required: true });
      this.acceptForm.get('comment')?.markAsTouched();
      return;
    }

    this.acceptingSupport = true;
    this.supportService.acceptSupport(
      this.selectedUser.id,
      { comment: this.acceptForm.value.comment }
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notificationService.success('Éxito', 'Soporte aceptado correctamente');
          this.closeAcceptModal();
          this.loadUserSupport(this.selectedUser!.id);
          this.acceptingSupport = false;
        },
        error: (error) => {
          console.error('Error accepting support:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo aceptar el soporte';
          alert(`Error: ${errorMessage}`);
          this.acceptingSupport = false;
        }
      });
  }

  openRejectModal(): void {
    if (!this.selectedUser) return;
    this.rejectForm.reset();
    this.rejectForm.patchValue({
      comment: ''
    });
    this.showRejectModal = true;
  }

  closeRejectModal(): void {
    this.showRejectModal = false;
    this.rejectForm.reset();
  }

  rejectSupport(): void {
    if (this.rejectForm.invalid || !this.selectedUser) {
      // Si el formulario es inválido, marcar los campos como touched para mostrar errores
      if (this.rejectForm.invalid) {
        this.rejectForm.markAllAsTouched();
      }
      return;
    }
    
    // Validar que el comentario no esté vacío
    const comment = this.rejectForm.value.comment?.trim();
    if (!comment || comment === '') {
      this.rejectForm.get('comment')?.setErrors({ required: true });
      this.rejectForm.get('comment')?.markAsTouched();
      return;
    }

    this.rejectingSupport = true;
    const rejectData = { comment: this.rejectForm.value.comment };
    console.log('Rechazando soporte para usuario:', this.selectedUser.id);
    console.log('Datos a enviar:', rejectData);
    
    this.supportService.rejectSupport(
      this.selectedUser.id,
      rejectData
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notificationService.success('Éxito', 'Soporte rechazado correctamente');
          this.closeRejectModal();
          this.loadUserSupport(this.selectedUser!.id);
          this.rejectingSupport = false;
        },
        error: (error) => {
          console.error('Error rejecting support:', error);
          console.error('URL completa:', error?.url);
          console.error('Status:', error?.status);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo rechazar el soporte';
          alert(`Error: ${errorMessage}`);
          this.rejectingSupport = false;
        }
      });
  }

  openEditCommentModal(): void {
    if (!this.userCommentSupport) return;
    this.editCommentForm.patchValue({
      newComment: this.userCommentSupport.comment || ''
    });
    this.showEditCommentModal = true;
  }

  closeEditCommentModal(): void {
    this.showEditCommentModal = false;
    this.editCommentForm.reset();
  }

  updateComment(): void {
    if (this.editCommentForm.invalid || !this.userCommentSupport) {
      return;
    }

    this.editingComment = true;
    this.supportService.updateComment(
      this.userCommentSupport.id,
      { newComment: this.editCommentForm.value.newComment }
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notificationService.success('Éxito', 'Comentario actualizado correctamente');
          this.closeEditCommentModal();
          if (this.selectedUser) {
            this.loadUserSupport(this.selectedUser.id);
          }
          this.editingComment = false;
        },
        error: (error) => {
          console.error('Error updating comment:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo actualizar el comentario';
          alert(`Error: ${errorMessage}`);
          this.editingComment = false;
        }
      });
  }

  applyFilters(): void {
    this.loadUsersWithSupport();
  }

  clearFilters(): void {
    this.filterForm.reset({
      search: '',
      sortBy: 'createdAt',
      sortOrder: 'DESC'
    });
    this.loadUsersWithSupport();
  }

  getStatusBadgeClass(statusName: string): string {
    const name = statusName?.toLowerCase() || '';
    if (name === 'aceptado' || name === 'aceptada') {
      return 'bg-green-100 text-green-800';
    } else if (name === 'rechazado' || name === 'rechazada') {
      return 'bg-red-100 text-red-800';
    } else if (name === 'pendiente') {
      return 'bg-yellow-100 text-yellow-800';
    }
    return 'bg-gray-100 text-gray-800';
  }

  canAccept(): boolean {
    // Si no hay comentario pero hay documento, se puede aceptar
    if (!this.userCommentSupport && this.selectedUser?.people?.supportId) {
      return true;
    }
    // Si hay comentario, verificar el estado
    if (!this.userCommentSupport?.status) return false;
    const statusName = this.userCommentSupport.status.name?.toLowerCase() || '';
    return statusName !== 'aceptado' && statusName !== 'aceptada';
  }

  canReject(): boolean {
    // Si no hay comentario pero hay documento, se puede rechazar
    if (!this.userCommentSupport && this.selectedUser?.people?.supportId) {
      return true;
    }
    // Si hay comentario, verificar el estado
    if (!this.userCommentSupport?.status) return false;
    const statusName = this.userCommentSupport.status.name?.toLowerCase() || '';
    return statusName !== 'rechazado' && statusName !== 'rechazada';
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  formatDate(date: string | null | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleString('es-ES');
  }

  getUserFullName(user: UserWithSupport | null): string {
    if (!user || !user.people) return '-';
    const name = user.people.name || '';
    const lastName = user.people.lastName || '';
    return `${name} ${lastName}`.trim() || '-';
  }
}

