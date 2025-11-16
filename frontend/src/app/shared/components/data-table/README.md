# DataTableComponent

Componente de tabla genérica reutilizable con capacidades de búsqueda, ordenamiento y paginación.

## Características

- ✅ Búsqueda en tiempo real
- ✅ Ordenamiento por columnas
- ✅ Paginación
- ✅ Selección de filas
- ✅ **Acciones en lote** (seleccionar múltiples filas y aplicar una acción)
- ✅ Acciones por fila
- ✅ Estados de carga y vacío
- ✅ Responsive

## Uso Básico

```typescript
import { DataTableComponent, TableColumn, TableAction, BatchAction } from '@shared/components/data-table/data-table.component';

@Component({
  imports: [DataTableComponent],
  // ...
})
export class MyComponent {
  columns: TableColumn[] = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'name', label: 'Nombre', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { 
      key: 'status', 
      label: 'Estado',
      render: (value) => value === 'active' ? 'Activo' : 'Inactivo'
    }
  ];

  data = [
    { id: 1, name: 'Juan', email: 'juan@example.com', status: 'active' },
    { id: 2, name: 'María', email: 'maria@example.com', status: 'inactive' }
  ];

  actions: TableAction[] = [
    {
      label: 'Editar',
      icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
      action: (row) => this.edit(row),
      variant: 'primary'
    },
    {
      label: 'Eliminar',
      action: (row) => this.delete(row),
      variant: 'danger'
    }
  ];

  batchActions: BatchAction[] = [
    {
      label: 'Eliminar seleccionados',
      icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
      action: (rows) => this.deleteBatch(rows),
      variant: 'danger',
      confirmMessage: '¿Estás seguro de eliminar los elementos seleccionados?'
    },
    {
      label: 'Activar seleccionados',
      action: (rows) => this.activateBatch(rows),
      variant: 'primary'
    }
  ];

  onRowClick(row: any): void {
    console.log('Row clicked:', row);
  }

  onSelectionChange(selected: any[]): void {
    console.log('Selected rows:', selected);
  }
}
```

```html
<app-data-table
  [columns]="columns"
  [data]="data"
  [loading]="loading"
  [searchable]="true"
  [selectable]="true"
  [actions]="actions"
  [batchActions]="batchActions"
  (rowClick)="onRowClick($event)"
  (selectionChange)="onSelectionChange($event)"
  (batchActionExecuted)="onBatchActionExecuted($event)"
></app-data-table>
```

## Interfaces

### TableColumn
```typescript
interface TableColumn {
  key: string;                    // Clave del campo (puede ser anidada con '.')
  label: string;                  // Etiqueta de la columna
  sortable?: boolean;             // Si la columna es ordenable
  width?: string;                 // Ancho de la columna
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: any) => string; // Función de renderizado personalizado
}
```

### TableAction
```typescript
interface TableAction {
  label: string;                 // Texto del botón
  icon?: string;                  // SVG path del icono
  action: (row: any) => void;    // Función a ejecutar
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: (row: any) => boolean; // Función para deshabilitar el botón
}
```

### BatchAction
```typescript
interface BatchAction {
  label: string;                      // Texto del botón
  icon?: string;                       // SVG path del icono
  action: (rows: any[]) => void;       // Función a ejecutar con todas las filas seleccionadas
  variant?: 'primary' | 'secondary' | 'danger';
  confirmMessage?: string;             // Mensaje de confirmación antes de ejecutar
  disabled?: (rows: any[]) => boolean;  // Función para deshabilitar el botón
}
```

## Inputs

- `columns: TableColumn[]` - Definición de columnas
- `data: any[]` - Datos a mostrar
- `loading: boolean` - Estado de carga
- `searchable: boolean` - Habilitar búsqueda (default: true)
- `searchPlaceholder: string` - Placeholder del buscador
- `pageSize: number` - Tamaño de página (default: 10)
- `actions: TableAction[]` - Acciones por fila
- `batchActions: BatchAction[]` - Acciones en lote (requiere selectable: true)
- `selectable: boolean` - Habilitar selección de filas
- `emptyMessage: string` - Mensaje cuando no hay datos

## Outputs

- `rowClick: EventEmitter<any>` - Emitido al hacer clic en una fila
- `selectionChange: EventEmitter<any[]>` - Emitido cuando cambia la selección
- `pageChange: EventEmitter<number>` - Emitido al cambiar de página
- `sortChange: EventEmitter<SortConfig>` - Emitido al ordenar
- `batchActionExecuted: EventEmitter<{ action: BatchAction; rows: any[] }>` - Emitido después de ejecutar una acción en lote

## Acciones en Lote

Las acciones en lote permiten aplicar una acción a múltiples filas seleccionadas. La barra de acciones aparece automáticamente cuando hay filas seleccionadas.

**Características:**
- Barra de acciones visible solo cuando hay selección
- Contador de elementos seleccionados
- Botón para deseleccionar todo
- Botón para seleccionar todos los elementos (incluso de otras páginas)
- Confirmación opcional antes de ejecutar acciones
- Las acciones reciben un array con todas las filas seleccionadas

