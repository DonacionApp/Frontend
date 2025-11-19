# ImpactMetricsComponent

Componente reutilizable para mostrar las métricas de impacto de la plataforma DonanApp.

## 📋 Descripción

Muestra un grid responsive con 4 métricas clave:
- Total de donaciones realizadas
- Organizaciones registradas
- Ciudades cubiertas
- Porcentaje de satisfacción de usuarios

## 🎨 Características

- **Responsive**: Se adapta a todos los tamaños de pantalla (mobile-first)
- **Loading State**: Muestra "..." mientras carga los datos
- **Animaciones opcionales**: Efectos de entrada suaves
- **Standalone Component**: No requiere módulo adicional
- **Formato numérico**: Formatea automáticamente los números con separadores de miles

## 📦 Uso

### Importación

```typescript
import { ImpactMetricsComponent, ImpactStats } from '@shared/components/impact-metrics';
// o
import { ImpactMetricsComponent, ImpactStats } from '../../shared/components/impact-metrics/impact-metrics.component';
```

### En el template

```html
<app-impact-metrics 
  [stats]="impactStats" 
  [isLoading]="isLoadingStats"
  [showAnimation]="true">
</app-impact-metrics>
```

### En el componente TypeScript

```typescript
import { Component, OnInit } from '@angular/core';
import { ImpactMetricsComponent, ImpactStats } from '@shared/components/impact-metrics';

@Component({
  selector: 'app-example',
  standalone: true,
  imports: [ImpactMetricsComponent],
  template: `
    <app-impact-metrics 
      [stats]="stats" 
      [isLoading]="loading">
    </app-impact-metrics>
  `
})
export class ExampleComponent implements OnInit {
  stats: ImpactStats = {
    totalDonations: 1200,
    totalOrganizations: 150,
    totalCities: 50,
    satisfactionRate: 98
  };
  
  loading = true;

  ngOnInit() {
    // Cargar datos del backend
    this.loadStats();
  }

  loadStats() {
    // Tu lógica aquí
    this.loading = false;
  }
}
```

## 🔧 Props (Inputs)

| Prop | Tipo | Requerido | Default | Descripción |
|------|------|-----------|---------|-------------|
| `stats` | `ImpactStats` | ✅ Sí | - | Objeto con las 4 métricas |
| `isLoading` | `boolean` | ❌ No | `false` | Muestra estado de carga |
| `showAnimation` | `boolean` | ❌ No | `true` | Habilita animaciones de entrada |

### ImpactStats Interface

```typescript
export interface ImpactStats {
  totalDonations: number;        // Total de donaciones
  totalOrganizations: number;    // Total de organizaciones
  totalCities: number;           // Total de ciudades
  satisfactionRate: number;      // Porcentaje de satisfacción (0-100)
}
```

## 🎯 Ejemplos de Uso

### Caso 1: En el Landing Page

```html
<!-- Sección de Impacto -->
<section id="impacto" class="impact-section py-20 px-4">
  <div class="max-w-7xl mx-auto">
    <h2 class="text-4xl font-bold text-white mb-16 text-center">
      Nuestro Impacto
    </h2>
    
    <app-impact-metrics 
      [stats]="impactStats" 
      [isLoading]="isLoadingStats"
      [showAnimation]="true">
    </app-impact-metrics>
  </div>
</section>
```

### Caso 2: En un Dashboard

```html
<!-- Sin animaciones para dashboards -->
<div class="bg-gradient-to-r from-green-600 to-blue-600 rounded-lg p-8">
  <h3 class="text-2xl font-bold text-white mb-6">Estadísticas Globales</h3>
  
  <app-impact-metrics 
    [stats]="globalStats" 
    [isLoading]="false"
    [showAnimation]="false">
  </app-impact-metrics>
</div>
```

### Caso 3: Con carga de datos del servicio

```typescript
export class DashboardComponent implements OnInit {
  impactStats: ImpactStats = {
    totalDonations: 0,
    totalOrganizations: 0,
    totalCities: 0,
    satisfactionRate: 0
  };
  
  isLoadingStats = true;

  constructor(private publicStatsService: PublicStatsService) {}

  ngOnInit(): void {
    this.loadImpactStats();
  }

  loadImpactStats(): void {
    this.isLoadingStats = true;
    this.publicStatsService.getGlobalImpactStats().subscribe({
      next: (stats) => {
        this.impactStats = stats;
        this.isLoadingStats = false;
      },
      error: (error) => {
        console.error('Error loading stats:', error);
        this.isLoadingStats = false;
        // Mantiene valores por defecto en caso de error
      }
    });
  }
}
```

## 🎨 Personalización de Estilos

El componente usa clases de Tailwind CSS y puede personalizarse fácilmente:

```html
<!-- Envolver en un contenedor con estilos personalizados -->
<div class="custom-background p-10 rounded-2xl">
  <app-impact-metrics 
    [stats]="stats" 
    [isLoading]="loading">
  </app-impact-metrics>
</div>
```

## 📱 Diseño Responsive

El componente se adapta automáticamente:
- **Mobile** (< 640px): 2 columnas (grid-cols-2)
- **Tablet+** (≥ 640px): 4 columnas (grid-cols-4)
- Los tamaños de texto y espaciado se ajustan con breakpoints

## ♿ Accesibilidad

- Formato de números mejorado para lectores de pantalla
- Contraste adecuado de colores (texto blanco sobre fondos oscuros)
- Estructura semántica HTML5

## 🔄 Estados

### Loading State
Muestra "..." en lugar de números mientras carga:
```typescript
isLoadingStats = true; // Muestra "..."
```

### Loaded State
Muestra los números formateados:
```typescript
isLoadingStats = false; // Muestra "1,200+"
```

## 📝 Notas

- El componente es **standalone**, no requiere ser declarado en un módulo
- Usa el pipe `number` de Angular para formatear automáticamente con separadores de miles
- Los estilos de hover añaden un efecto de escala sutil (1.05x)
- Las animaciones usan `animation-delay` para un efecto escalonado

