import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { DataTableComponent, TableColumn, TableAction, BatchAction } from '../../../shared/components/data-table/data-table.component';
import { CategoryService, Category, CreateCategoryDTO, UpdateCategoryDTO } from '../../../core/services/category.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DataTableComponent],
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.scss']
})
export class CategoriesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  categories: Category[] = [];
  loading = false;
  errorMessage = '';

  // Modal state
  showModal = false;
  isEditMode = false;
  editingCategory: Category | null = null;
  categoryForm!: FormGroup;

  // Table configuration
  columns: TableColumn[] = [
    { key: 'id', label: 'ID', sortable: true, width: '80px' },
    { key: 'name', label: 'Nombre', sortable: true },
    { 
      key: 'description', 
      label: 'Descripción', 
      sortable: false,
      render: (value) => value || '-'
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
      label: 'Editar',
      icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
      action: (row) => this.editCategory(row),
      variant: 'primary'
    },
    {
      label: 'Eliminar',
      icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
      action: (row) => this.deleteCategory(row),
      variant: 'danger',
      disabled: (row) => false
    }
  ];

  batchActions: BatchAction[] = [
    {
      label: 'Eliminar seleccionadas',
      icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
      action: (rows) => this.deleteBatch(rows),
      variant: 'danger',
      confirmMessage: '¿Estás seguro de eliminar las categorías seleccionadas?'
    }
  ];

  constructor(
    private categoryService: CategoryService,
    private fb: FormBuilder,
    private toastService: ToastService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initForm(): void {
    this.categoryForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: ['']
    });
  }

  loadCategories(): void {
    this.loading = true;
    this.errorMessage = '';
    
    this.categoryService.getAllCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories) => {
          this.categories = categories;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading categories:', error);
          this.errorMessage = 'Error al cargar las categorías';
          this.loading = false;
          this.toastService.show({
            title: 'Error',
            message: 'No se pudieron cargar las categorías',
            type: 'error'
          });
        }
      });
  }

  openCreateModal(): void {
    this.isEditMode = false;
    this.editingCategory = null;
    this.categoryForm.reset();
    this.showModal = true;
  }

  editCategory(category: Category): void {
    this.isEditMode = true;
    this.editingCategory = category;
    this.categoryForm.patchValue({
      name: category.name,
      description: category.description || ''
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.isEditMode = false;
    this.editingCategory = null;
    this.categoryForm.reset();
  }

  saveCategory(): void {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    const formValue = this.categoryForm.value;

    if (this.isEditMode && this.editingCategory) {
      const updateData: UpdateCategoryDTO = {
        name: formValue.name,
        description: formValue.description || undefined
      };

      this.categoryService.updateCategory(this.editingCategory.id, updateData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.toastService.show({
              title: 'Éxito',
              message: 'Categoría actualizada correctamente',
              type: 'success'
            });
            this.closeModal();
            this.loadCategories();
          },
          error: (error) => {
            console.error('Error updating category:', error);
            this.toastService.show({
              title: 'Error',
              message: 'No se pudo actualizar la categoría',
              type: 'error'
            });
          }
        });
    } else {
      const createData: CreateCategoryDTO = {
        name: formValue.name,
        description: formValue.description || undefined
      };

      this.categoryService.createCategory(createData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.toastService.show({
              title: 'Éxito',
              message: 'Categoría creada correctamente',
              type: 'success'
            });
            this.closeModal();
            this.loadCategories();
          },
          error: (error) => {
            console.error('Error creating category:', error);
            this.toastService.show({
              title: 'Error',
              message: 'No se pudo crear la categoría',
              type: 'error'
            });
          }
        });
    }
  }

  deleteCategory(category: Category): void {
    if (!confirm(`¿Estás seguro de eliminar la categoría "${category.name}"?`)) {
      return;
    }

    this.categoryService.deleteCategory(category.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: 'Categoría eliminada correctamente',
            type: 'success'
          });
          this.loadCategories();
        },
        error: (error) => {
          console.error('Error deleting category:', error);
          this.toastService.show({
            title: 'Error',
            message: 'No se pudo eliminar la categoría',
            type: 'error'
          });
        }
      });
  }

  deleteBatch(rows: Category[]): void {
    const ids = rows.map(row => row.id);
    
    this.categoryService.deleteCategories(ids)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: `${rows.length} categoría(s) eliminada(s) correctamente`,
            type: 'success'
          });
          this.loadCategories();
        },
        error: (error) => {
          console.error('Error deleting categories:', error);
          this.toastService.show({
            title: 'Error',
            message: 'No se pudieron eliminar las categorías',
            type: 'error'
          });
        }
      });
  }

  onBatchActionExecuted(event: { action: BatchAction; rows: any[] }): void {
    // La acción ya se ejecutó, solo recargar si es necesario
    // this.loadCategories();
  }
}

