import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DataTableComponent, TableColumn, TableAction, BatchAction } from '../../../shared/components/data-table/data-table.component';
import { PostsService, Tag } from '../../../core/services/posts.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-tags',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DataTableComponent],
  templateUrl: './tags.component.html',
  styleUrls: ['./tags.component.scss']
})
export class TagsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  tags: Tag[] = [];
  loading = false;
  errorMessage = '';

  // Modal state
  showModal = false;
  isEditMode = false;
  editingTag: Tag | null = null;
  tagForm!: FormGroup;

  // Table configuration
  columns: TableColumn[] = [
    { key: 'id', label: 'ID', sortable: true, width: '80px' },
    { key: 'tag', label: 'Nombre del Tag', sortable: true },
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
      action: (row) => this.editTag(row),
      variant: 'primary'
    },
    {
      label: 'Eliminar',
      icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
      action: (row) => this.deleteTag(row),
      variant: 'danger'
    }
  ];

  batchActions: BatchAction[] = [
    {
      label: 'Eliminar seleccionados',
      icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
      action: (rows) => this.deleteBatch(rows),
      variant: 'danger',
      confirmMessage: '¿Estás seguro de eliminar los tags seleccionados?'
    }
  ];

  constructor(
    private postsService: PostsService,
    private fb: FormBuilder,
    private toastService: ToastService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadTags();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initForm(): void {
    this.tagForm = this.fb.group({
      tag: ['', [Validators.required, Validators.minLength(2)]]
    });
  }

  loadTags(): void {
    this.loading = true;
    this.errorMessage = '';
    
    this.postsService.getAllTags()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tags) => {
          this.tags = tags;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading tags:', error);
          this.errorMessage = 'Error al cargar los tags';
          this.loading = false;
          this.toastService.show({
            title: 'Error',
            message: 'No se pudieron cargar los tags',
            type: 'error'
          });
        }
      });
  }

  openCreateModal(): void {
    this.isEditMode = false;
    this.editingTag = null;
    this.tagForm.reset();
    this.showModal = true;
  }

  editTag(tag: Tag): void {
    this.isEditMode = true;
    this.editingTag = tag;
    this.tagForm.patchValue({
      tag: tag.tag
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.isEditMode = false;
    this.editingTag = null;
    this.tagForm.reset();
  }

  saveTag(): void {
    if (this.tagForm.invalid) {
      this.tagForm.markAllAsTouched();
      return;
    }

    const formValue = this.tagForm.value;

    if (this.isEditMode && this.editingTag) {
      this.postsService.updateTag(this.editingTag.id, formValue.tag)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.toastService.show({
              title: 'Éxito',
              message: 'Tag actualizado correctamente',
              type: 'success'
            });
            this.closeModal();
            this.loadTags();
          },
          error: (error) => {
            console.error('Error updating tag:', error);
            const errorMessage = error?.error?.message || 'No se pudo actualizar el tag';
            this.toastService.show({
              title: 'Error',
              message: errorMessage,
              type: 'error'
            });
          }
        });
    } else {
      this.postsService.createTag(formValue.tag)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.toastService.show({
              title: 'Éxito',
              message: 'Tag creado correctamente',
              type: 'success'
            });
            this.closeModal();
            this.loadTags();
          },
          error: (error) => {
            console.error('Error creating tag:', error);
            const errorMessage = error?.error?.message || 'No se pudo crear el tag';
            this.toastService.show({
              title: 'Error',
              message: errorMessage,
              type: 'error'
            });
          }
        });
    }
  }

  deleteTag(tag: Tag): void {
    if (!confirm(`¿Estás seguro de eliminar el tag "${tag.tag}"?`)) {
      return;
    }

    this.postsService.deleteTag(tag.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: 'Tag eliminado correctamente',
            type: 'success'
          });
          this.loadTags();
        },
        error: (error) => {
          console.error('Error deleting tag:', error);
          this.toastService.show({
            title: 'Error',
            message: 'No se pudo eliminar el tag',
            type: 'error'
          });
        }
      });
  }

  deleteBatch(rows: Tag[]): void {
    // Eliminar tags uno por uno ya que no hay endpoint batch
    const deleteObservables = rows.map(tag => 
      this.postsService.deleteTag(tag.id).pipe(
        catchError(error => {
          console.error(`Error deleting tag ${tag.id}:`, error);
          return of(null); // Continuar aunque falle uno
        })
      )
    );

    forkJoin(deleteObservables)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: `${rows.length} tag(s) eliminado(s) correctamente`,
            type: 'success'
          });
          this.loadTags();
        },
        error: (error) => {
          console.error('Error deleting tags:', error);
          this.toastService.show({
            title: 'Error',
            message: 'No se pudieron eliminar algunos tags',
            type: 'error'
          });
          this.loadTags();
        }
      });
  }

  onBatchActionExecuted(event: { action: BatchAction; rows: any[] }): void {
    // La acción ya se ejecutó, solo recargar si es necesario
    // this.loadTags();
  }
}

