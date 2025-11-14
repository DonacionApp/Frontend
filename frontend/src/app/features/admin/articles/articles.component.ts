import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DataTableComponent, TableColumn, TableAction, BatchAction } from '../../../shared/components/data-table/data-table.component';
import { ArticlesService, Article, CreateArticleDTO } from '../../../core/services/articles.service';
import { NotificationService } from '../../../shared/services/notification.service';
import { ModalComponent } from '../../../shared/components/modal/modal.component';

@Component({
  selector: 'app-articles',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DataTableComponent, ModalComponent],
  templateUrl: './articles.component.html',
  styleUrls: ['./articles.component.scss']
})
export class ArticlesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  articles: Article[] = [];
  loading = false;
  errorMessage = '';

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
    if (!confirm(`¿Estás seguro de eliminar el artículo "${article.name}"?`)) {
      return;
    }

    this.articlesService.deleteArticleAdmin(article.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notificationService.success('Éxito', 'Artículo eliminado correctamente');
          this.loadArticles();
        },
        error: (error) => {
          console.error('Error deleting article:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo eliminar el artículo';
          alert(`Error: ${errorMessage}`);
        }
      });
  }

  deleteBatch(rows: Article[]): void {
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
          this.notificationService.success('Éxito', `${rows.length} artículo(s) eliminado(s) correctamente`);
          this.loadArticles();
        },
        error: (error) => {
          console.error('Error deleting articles:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudieron eliminar algunos artículos';
          alert(`Error: ${errorMessage}`);
          this.loadArticles();
        }
      });
  }

  onBatchActionExecuted(event: { action: BatchAction; rows: any[] }): void {
    // La acción ya se ejecutó
  }
}

