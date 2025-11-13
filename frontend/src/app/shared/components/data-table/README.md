# DataTableComponent

Componente de tabla genérica reutilizable con capacidades de búsqueda, ordenamiento y paginación.

## Características

- ✅ Búsqueda en tiempo real
- ✅ Ordenamiento por columnas
- ✅ Paginación
- ✅ Selección de filas (preparado para acciones en lote)
- ✅ Acciones por fila
- ✅ Estados de carga y vacío
- ✅ Responsive

## Uso Básico

```typescript
import { DataTableComponent, TableColumn, TableAction } from '@shared/components/data-table/data-table.component';

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
  (rowClick)="onRowClick($event)"
  (selectionChange)="onSelectionChange($event)"
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

## Inputs

- `columns: TableColumn[]` - Definición de columnas
- `data: any[]` - Datos a mostrar
- `loading: boolean` - Estado de carga
- `searchable: boolean` - Habilitar búsqueda (default: true)
- `searchPlaceholder: string` - Placeholder del buscador
- `pageSize: number` - Tamaño de página (default: 10)
- `actions: TableAction[]` - Acciones por fila
- `selectable: boolean` - Habilitar selección de filas
- `emptyMessage: string` - Mensaje cuando no hay datos

## Outputs

- `rowClick: EventEmitter<any>` - Emitido al hacer clic en una fila
- `selectionChange: EventEmitter<any[]>` - Emitido cuando cambia la selección
- `pageChange: EventEmitter<number>` - Emitido al cambiar de página
- `sortChange: EventEmitter<SortConfig>` - Emitido al ordenar

