import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DataTableComponent, TableColumn, TableAction, BatchAction } from '../../../shared/components/data-table/data-table.component';
import { ArticlesService, Article, CreateArticleDTO } from '../../../core/services/articles.service';
import { NotificationService } from '../../../shared/services/notification.service';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { MessageModalComponent } from '../../../shared/components/message-modal/message-modal.component';

@Component({
  selector: 'app-articles',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DataTableComponent, ModalComponent, ConfirmModalComponent, MessageModalComponent],
  templateUrl: './articles.component.html',
  styleUrls: ['./articles.component.scss']
})
export class ArticlesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  articles: Article[] = [];
  loading = false;
  errorMessage = '';

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
  selectedArticleForAction: Article | null = null;

  // Modal state
  showModal = false;
  isEditMode = false;
  editingArticle: Article | null = null;
  articleForm!: FormGroup;
  saving = false;

  // Table configuration
  columns: TableColumn[] = [
    { key: 'id', label: 'ID', sortable: true, width: '80px' },
    { key: 'name', label: 'Nombre', sortable: true },
    { 
      key: 'descripcion', 
      label: 'Descripción', 
      sortable: false,
      render: (value) => value ? (value.length > 50 ? value.substring(0, 50) + '...' : value) : '-'
    },
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
      action: (row) => this.editArticle(row),
      variant: 'primary'
    },
    {
      label: 'Eliminar',
      icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
      action: (row) => this.deleteArticle(row),
      variant: 'danger'
    }
  ];

  batchActions: BatchAction[] = [
    {
      label: 'Eliminar seleccionados',
      icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
      action: (rows) => this.deleteBatch(rows),
      variant: 'danger',
      confirmMessage: '¿Estás seguro de eliminar los artículos seleccionados?'
    }
  ];

  constructor(
    private articlesService: ArticlesService,
    private fb: FormBuilder,
    private notificationService: NotificationService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadArticles();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initForm(): void {
    this.articleForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: ['']
    });
  }

  loadArticles(): void {
    this.loading = true;
    this.errorMessage = '';
    
    this.articlesService.getAllArticles()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (articles) => {
          this.articles = articles;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading articles:', error);
          this.errorMessage = 'Error al cargar los artículos';
          this.loading = false;
          alert(`Error: ${error?.error?.message || error?.message || 'No se pudieron cargar los artículos'}`);
        }
      });
  }

  openCreateModal(): void {
    this.isEditMode = false;
    this.editingArticle = null;
    this.articleForm.reset();
    this.showModal = true;
  }

  editArticle(article: Article): void {
    this.isEditMode = true;
    this.editingArticle = article;
    this.articleForm.patchValue({
      name: article.name,
      description: article.descripcion || ''
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.isEditMode = false;
    this.editingArticle = null;
    this.articleForm.reset();
    this.saving = false;
  }

  saveArticle(): void {
    if (this.articleForm.invalid) {
      this.articleForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    const formValue = this.articleForm.value;
    const articleData: CreateArticleDTO = {
      name: formValue.name,
      description: formValue.description || undefined
    };

    if (this.isEditMode && this.editingArticle) {
      // Actualizar artículo
      this.articlesService.updateArticleAdmin(this.editingArticle.id, articleData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.notificationService.success('Éxito', 'Artículo actualizado correctamente');
            this.closeModal();
            this.loadArticles();
          },
          error: (error) => {
            console.error('Error updating article:', error);
            const errorMessage = error?.error?.message || error?.message || 'No se pudo actualizar el artículo';
            alert(`Error: ${errorMessage}`);
            this.saving = false;
          }
        });
    } else {
      // Crear artículo
      this.articlesService.createArticle(articleData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.notificationService.success('Éxito', 'Artículo creado correctamente');
            this.closeModal();
            this.loadArticles();
          },
          error: (error) => {
            console.error('Error creating article:', error);
            const errorMessage = error?.error?.message || error?.message || 'No se pudo crear el artículo';
            alert(`Error: ${errorMessage}`);
            this.saving = false;
          }
        });
    }
  }

  deleteArticle(article: Article): void {
    this.selectedArticleForAction = article;
    this.confirmModalConfig = {
      title: 'Eliminar Artículo',
      message: `¿Estás seguro de eliminar el artículo "${article.name}"?`,
      type: 'warning',
      onConfirm: () => this.executeDeleteArticle(article.id)
    };
    this.showConfirmModal = true;
  }

  executeDeleteArticle(articleId: number): void {
    this.showConfirmModal = false;
    this.articlesService.deleteArticleAdmin(articleId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Éxito',
            message: 'Artículo eliminado correctamente',
            type: 'success'
          };
          this.loadArticles();
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

  deleteBatch(rows: Article[]): void {
    this.confirmModalConfig = {
      title: 'Eliminar Artículos',
      message: `¿Estás seguro de eliminar ${rows.length} artículo(s)?`,
      type: 'warning',
      onConfirm: () => this.executeDeleteBatch(rows)
    };
    this.showConfirmModal = true;
  }

  executeDeleteBatch(rows: Article[]): void {
    this.showConfirmModal = false;
    const deleteObservables = rows.map(article => 
      this.articlesService.deleteArticleAdmin(article.id).pipe(
        catchError(error => {
          console.error(`Error deleting article ${article.id}:`, error);
          return of(null);
        })
      )
    );

    forkJoin(deleteObservables)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Éxito',
            message: `${rows.length} artículo(s) eliminado(s) correctamente`,
            type: 'success'
          };
          this.loadArticles();
        },
        error: (error) => {
          console.error('Error deleting articles:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudieron eliminar algunos artículos';
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Error',
            message: errorMessage,
            type: 'error'
          };
          this.loadArticles();
        }
      });
  }

  closeConfirmModal(): void {
    this.showConfirmModal = false;
    this.confirmModalConfig = null;
    this.selectedArticleForAction = null;
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

  onBatchActionExecuted(event: { action: BatchAction; rows: any[] }): void {
    // La acción ya se ejecutó
  }
}

