import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: any) => string;
}

export interface TableAction {
  label: string;
  icon?: string;
  action: (row: any) => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: (row: any) => boolean;
}

export interface BatchAction {
  label: string;
  icon?: string;
  action: (rows: any[]) => void;
  variant?: 'primary' | 'secondary' | 'danger';
  confirmMessage?: string; // Mensaje de confirmación antes de ejecutar
  disabled?: (rows: any[]) => boolean;
}

export interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './data-table.component.html',
  styleUrls: ['./data-table.component.scss']
})
export class DataTableComponent implements OnInit, OnChanges {
  @Input() columns: TableColumn[] = [];
  @Input() data: any[] = [];
  @Input() loading: boolean = false;
  @Input() searchable: boolean = true;
  @Input() searchPlaceholder: string = 'Buscar...';
  @Input() pageSize: number = 10;
  @Input() actions?: TableAction[];
  @Input() batchActions?: BatchAction[];
  @Input() selectable: boolean = false;
  @Input() emptyMessage: string = 'No hay datos para mostrar';
  
  @Output() rowClick = new EventEmitter<any>();
  @Output() selectionChange = new EventEmitter<any[]>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() sortChange = new EventEmitter<SortConfig>();
  @Output() batchActionExecuted = new EventEmitter<{ action: BatchAction; rows: any[] }>();

  // Estado interno
  searchTerm: string = '';
  currentPage: number = 1;
  sortConfig: SortConfig | null = null;
  selectedRows: Set<any> = new Set();
  filteredData: any[] = [];
  paginatedData: any[] = [];
  totalPages: number = 1;

  ngOnInit(): void {
    this.applyFilters();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['pageSize']) {
      this.applyFilters();
    }
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  applyFilters(): void {
    // Aplicar búsqueda
    let filtered = [...this.data];
    
    if (this.searchTerm.trim()) {
      const searchLower = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(row => {
        return this.columns.some(col => {
          const value = this.getCellValue(row, col.key);
          return value?.toString().toLowerCase().includes(searchLower);
        });
      });
    }

    // Aplicar ordenamiento
    if (this.sortConfig) {
      filtered.sort((a, b) => {
        const aValue = this.getCellValue(a, this.sortConfig!.column);
        const bValue = this.getCellValue(b, this.sortConfig!.column);
        
        let comparison = 0;
        if (aValue < bValue) comparison = -1;
        if (aValue > bValue) comparison = 1;
        
        return this.sortConfig!.direction === 'asc' ? comparison : -comparison;
      });
    }

    this.filteredData = filtered;
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalPages = Math.max(1, Math.ceil(this.filteredData.length / this.pageSize));
    
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }

    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.paginatedData = this.filteredData.slice(start, end);
  }

  onSort(column: TableColumn): void {
    if (!column.sortable) return;

    if (this.sortConfig?.column === column.key) {
      // Cambiar dirección si es la misma columna
      this.sortConfig.direction = this.sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
      // Nueva columna, ordenar ascendente
      this.sortConfig = { column: column.key, direction: 'asc' };
    }

    this.applyFilters();
    this.sortChange.emit(this.sortConfig);
  }

  getSortIcon(column: TableColumn): string {
    if (!column.sortable || this.sortConfig?.column !== column.key) {
      return 'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4';
    }
    return this.sortConfig.direction === 'asc' 
      ? 'M5 15l7-7 7 7'
      : 'M19 9l-7 7-7-7';
  }

  getCellValue(row: any, key: string): any {
    const keys = key.split('.');
    let value = row;
    for (const k of keys) {
      value = value?.[k];
    }
    return value;
  }

  getCellDisplayValue(row: any, column: TableColumn): string {
    const value = this.getCellValue(row, column.key);
    if (column.render) {
      return column.render(value, row);
    }
    return value?.toString() || '';
  }

  onRowClick(row: any): void {
    this.rowClick.emit(row);
  }

  onActionClick(action: TableAction, row: any, event: Event): void {
    event.stopPropagation();
    if (action.disabled && action.disabled(row)) {
      return;
    }
    action.action(row);
  }

  // Selección
  toggleRowSelection(row: any, event: Event): void {
    event.stopPropagation();
    if (this.selectedRows.has(row)) {
      this.selectedRows.delete(row);
    } else {
      this.selectedRows.add(row);
    }
    this.emitSelectionChange();
  }

  toggleAllSelection(event: Event): void {
    event.stopPropagation();
    if (this.isAllSelected()) {
      this.selectedRows.clear();
    } else {
      this.paginatedData.forEach(row => this.selectedRows.add(row));
    }
    this.emitSelectionChange();
  }

  isRowSelected(row: any): boolean {
    return this.selectedRows.has(row);
  }

  isAllSelected(): boolean {
    return this.paginatedData.length > 0 && 
           this.paginatedData.every(row => this.selectedRows.has(row));
  }

  isIndeterminate(): boolean {
    const selectedCount = this.paginatedData.filter(row => this.selectedRows.has(row)).length;
    return selectedCount > 0 && selectedCount < this.paginatedData.length;
  }

  emitSelectionChange(): void {
    this.selectionChange.emit(Array.from(this.selectedRows));
  }

  getSelectedCount(): number {
    return this.selectedRows.size;
  }

  hasSelection(): boolean {
    return this.selectedRows.size > 0;
  }

  clearSelection(): void {
    this.selectedRows.clear();
    this.emitSelectionChange();
  }

  onBatchAction(batchAction: BatchAction): void {
    const selectedRowsArray = Array.from(this.selectedRows);
    
    if (batchAction.disabled && batchAction.disabled(selectedRowsArray)) {
      return;
    }

    // Si hay mensaje de confirmación, mostrarlo
    if (batchAction.confirmMessage) {
      const confirmed = confirm(batchAction.confirmMessage);
      if (!confirmed) {
        return;
      }
    }

    // Ejecutar la acción
    batchAction.action(selectedRowsArray);
    
    // Emitir evento
    this.batchActionExecuted.emit({ action: batchAction, rows: selectedRowsArray });
    
    // Limpiar selección después de la acción (opcional, depende del caso de uso)
    // this.clearSelection();
  }

  selectAllPages(): void {
    // Seleccionar todas las filas de todas las páginas
    this.filteredData.forEach(row => this.selectedRows.add(row));
    this.emitSelectionChange();
  }

  isAllDataSelected(): boolean {
    return this.filteredData.length > 0 && 
           this.filteredData.every(row => this.selectedRows.has(row));
  }

  getSelectedRowsArray(): any[] {
    return Array.from(this.selectedRows);
  }

  // Paginación
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePagination();
    this.pageChange.emit(page);
  }

  previousPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible - 1);
    
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.onSearchChange();
  }

  getActionButtonClasses(action: TableAction): string {
    const baseClasses = 'inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors';
    const variantClasses = {
      primary: 'text-white bg-green-600 hover:bg-green-700',
      secondary: 'text-gray-700 bg-gray-100 hover:bg-gray-200',
      danger: 'text-white bg-red-600 hover:bg-red-700'
    };
    const variant = action.variant || 'secondary';
    return `${baseClasses} ${variantClasses[variant]}`;
  }

  getCurrentPageEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredData.length);
  }

  getCurrentPageStart(): number {
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  getBatchActionButtonClasses(batchAction: BatchAction): string {
    const baseClasses = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
    const variantClasses = {
      primary: 'text-white bg-green-600 hover:bg-green-700',
      secondary: 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50',
      danger: 'text-white bg-red-600 hover:bg-red-700'
    };
    const variant = batchAction.variant || 'secondary';
    return `${baseClasses} ${variantClasses[variant]}`;
  }
}

