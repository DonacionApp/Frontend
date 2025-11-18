import { Component, OnInit, Input, OnDestroy, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CHART_COLORS, BAR_CHART_OPTIONS } from '../../../../shared/config/chart.config';
import { StatsFilterService } from '../../../../core/services/stats-filter.service';

interface CategoryData {
  category: string;
  count: number;
  percentage?: number;
}

@Component({
  selector: 'app-popular-categories-chart',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './popular-categories-chart.component.html'
})
export class PopularCategoriesChartComponent implements OnInit, OnDestroy, OnChanges {
  private destroy$ = new Subject<void>();

  @Input() data: CategoryData[] = [];
  @Input() chartHeight = '360px';
  @Input() maxCategories = 10; // Mostrar top 10 por defecto
  @Input() totalCategoriesInDb = 0; // Total de categorías en la BD

  // Variable para mostrar información de filtros activos
  public activeFiltersInfo = '';

  // Configuración del gráfico de barras
  public barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: []
  };

  public barChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: window.innerWidth < 768 ? 0.8 : 1.5,
    indexAxis: 'y', // Barras horizontales
    plugins: {
      ...BAR_CHART_OPTIONS.plugins,
      tooltip: {
        ...BAR_CHART_OPTIONS.plugins?.tooltip,
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || '';
            const value = context.parsed.x;
            if (value === null || value === undefined) return label;
            const percentage = this.data[context.dataIndex]?.percentage || 0;
            return `${label}: ${value.toLocaleString('es-ES')} (${percentage.toFixed(1)}%)`;
          }
        }
      },
      title: {
        display: true,
        text: 'Categorías Más Populares',
        color: '#1F2937',
        font: {
          size: window.innerWidth < 640 ? 14 : 16,
          weight: 'bold',
          family: "'Inter', sans-serif"
        },
        padding: { top: 10, bottom: window.innerWidth < 640 ? 15 : 20 }
      },
      legend: {
        display: false
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: {
          display: true,
          color: 'rgba(229, 231, 235, 0.5)'
        },
        ticks: {
          color: '#6B7280',
          font: { size: window.innerWidth < 640 ? 9 : 11 },
          stepSize: 1,
          callback: (value) => {
            // Mostrar solo números enteros
            if (Number.isInteger(value)) {
              return value.toLocaleString('es-ES');
            }
            return '';
          }
        }
      },
      y: {
        grid: {
          display: false
        },
        ticks: {
          color: '#4B5563',
          font: { 
            size: window.innerWidth < 640 ? 10 : 12, 
            weight: 500 
          },
          autoSkip: window.innerWidth < 640,
          maxTicksLimit: window.innerWidth < 640 ? 5 : 10
        }
      }
    }
  };

  public isLoading = true;
  public hasData = false;
  private resizeListener?: () => void;

  constructor(private filterService: StatsFilterService) {}

  ngOnInit(): void {
    this.initializeChart();
    this.setupResizeListener();
    this.subscribeToFilterChanges();
  }

  private subscribeToFilterChanges(): void {
    this.filterService.filters$
      .pipe(takeUntil(this.destroy$))
      .subscribe(filters => {
        this.updateActiveFiltersInfo(filters.dateRange?.startDate, filters.dateRange?.endDate);
      });
  }

  private updateActiveFiltersInfo(startDate?: string, endDate?: string): void {
    if (startDate && endDate) {
      const start = new Date(startDate).toLocaleDateString('es-ES');
      const end = new Date(endDate).toLocaleDateString('es-ES');
      this.activeFiltersInfo = `Filtrando desde ${start} hasta ${end}`;
    } else if (startDate) {
      const start = new Date(startDate).toLocaleDateString('es-ES');
      this.activeFiltersInfo = `Filtrando desde ${start}`;
    } else if (endDate) {
      const end = new Date(endDate).toLocaleDateString('es-ES');
      this.activeFiltersInfo = `Filtrando hasta ${end}`;
    } else {
      this.activeFiltersInfo = '';
    }
  }

  private setupResizeListener(): void {
    this.resizeListener = () => {
      this.updateChartResponsiveOptions();
    };
    window.addEventListener('resize', this.resizeListener);
  }

  private updateChartResponsiveOptions(): void {
    const isMobile = window.innerWidth < 640;
    const isTablet = window.innerWidth < 768;
    
    // Recrear opciones con configuraciones responsivas
    this.barChartOptions = {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: isTablet ? 0.8 : 1.5,
      indexAxis: 'y',
      plugins: {
        ...BAR_CHART_OPTIONS.plugins,
        tooltip: {
          ...BAR_CHART_OPTIONS.plugins?.tooltip,
          callbacks: {
            label: (context) => {
              const label = context.dataset.label || '';
              const value = context.parsed.x;
              if (value === null || value === undefined) return label;
              const percentage = this.data[context.dataIndex]?.percentage || 0;
              return `${label}: ${value.toLocaleString('es-ES')} (${percentage.toFixed(1)}%)`;
            }
          }
        },
        title: {
          display: true,
          text: 'Categorías Más Populares',
          color: '#1F2937',
          font: {
            size: isMobile ? 14 : 16,
            weight: 'bold',
            family: "'Inter', sans-serif"
          },
          padding: { top: 10, bottom: isMobile ? 15 : 20 }
        },
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: {
            display: true,
            color: 'rgba(229, 231, 235, 0.5)'
          },
          ticks: {
            color: '#6B7280',
            font: { size: isMobile ? 9 : 11 },
            stepSize: 1,
            callback: (value) => {
              // Mostrar solo números enteros
              if (Number.isInteger(value)) {
                return value.toLocaleString('es-ES');
              }
              return '';
            }
          }
        },
        y: {
          grid: {
            display: false
          },
          ticks: {
            color: '#4B5563',
            font: { 
              size: isMobile ? 10 : 12, 
              weight: 500 
            },
            autoSkip: isMobile,
            maxTicksLimit: isMobile ? 5 : 10
          }
        }
      }
    };
  }

  ngOnChanges(): void {
    if (this.data && this.data.length > 0) {
      this.updateChartData(this.data);
    }
  }

  ngOnDestroy(): void {
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inicializa el gráfico con los datos proporcionados
   */
  private initializeChart(): void {
    if (!this.data || this.data.length === 0) {
      this.isLoading = true;
      this.hasData = false;
    } else {
      this.updateChartData(this.data);
    }
  }

  /**
   * Actualiza los datos del gráfico
   */
  private updateChartData(data: CategoryData[]): void {
    // Ordenar por count descendente y tomar solo las top categorías
    const sortedData = [...data]
      .sort((a, b) => b.count - a.count)
      .slice(0, this.maxCategories);

    const labels = sortedData.map(d => d.category);
    const values = sortedData.map(d => d.count);

    // Generar colores degradados para cada barra
    const colors = this.generateBarColors(sortedData.length);

    this.barChartData = {
      labels,
      datasets: [
        {
          data: values,
          label: 'Publicaciones',
          backgroundColor: colors.background,
          borderColor: colors.border,
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false,
          hoverBackgroundColor: colors.hover,
          hoverBorderColor: colors.border
        }
      ]
    };

    this.hasData = sortedData.length > 0;
    this.isLoading = false;
  }

  /**
   * Genera colores para las barras con gradiente
   */
  private generateBarColors(count: number): { background: string[], border: string[], hover: string[] } {
    const colorSchemes = [
      { bg: 'rgba(59, 130, 246, 0.8)', border: 'rgb(59, 130, 246)', hover: 'rgba(59, 130, 246, 0.95)' },   // blue
      { bg: 'rgba(34, 197, 94, 0.8)', border: 'rgb(34, 197, 94)', hover: 'rgba(34, 197, 94, 0.95)' },      // green
      { bg: 'rgba(251, 146, 60, 0.8)', border: 'rgb(251, 146, 60)', hover: 'rgba(251, 146, 60, 0.95)' },   // orange
      { bg: 'rgba(168, 85, 247, 0.8)', border: 'rgb(168, 85, 247)', hover: 'rgba(168, 85, 247, 0.95)' },   // purple
      { bg: 'rgba(236, 72, 153, 0.8)', border: 'rgb(236, 72, 153)', hover: 'rgba(236, 72, 153, 0.95)' },   // pink
      { bg: 'rgba(14, 165, 233, 0.8)', border: 'rgb(14, 165, 233)', hover: 'rgba(14, 165, 233, 0.95)' },   // cyan
      { bg: 'rgba(239, 68, 68, 0.8)', border: 'rgb(239, 68, 68)', hover: 'rgba(239, 68, 68, 0.95)' },      // red
      { bg: 'rgba(99, 102, 241, 0.8)', border: 'rgb(99, 102, 241)', hover: 'rgba(99, 102, 241, 0.95)' },   // indigo
      { bg: 'rgba(16, 185, 129, 0.8)', border: 'rgb(16, 185, 129)', hover: 'rgba(16, 185, 129, 0.95)' },   // emerald
      { bg: 'rgba(245, 158, 11, 0.8)', border: 'rgb(245, 158, 11)', hover: 'rgba(245, 158, 11, 0.95)' }    // amber
    ];

    const background: string[] = [];
    const border: string[] = [];
    const hover: string[] = [];

    for (let i = 0; i < count; i++) {
      const scheme = colorSchemes[i % colorSchemes.length];
      background.push(scheme.bg);
      border.push(scheme.border);
      hover.push(scheme.hover);
    }

    return { background, border, hover };
  }

  /**
   * Método público para actualizar los datos del gráfico desde el componente padre
   */
  public updateData(newData: CategoryData[]): void {
    this.isLoading = true;
    this.data = newData;
    this.updateChartData(newData);
  }

  /**
   * Método para refrescar el gráfico
   */
  public refresh(): void {
    this.isLoading = true;
    this.initializeChart();
  }

  /**
   * Método para exportar los datos como CSV
   */
  public exportCSV(): void {
    if (!this.data || this.data.length === 0) {
      console.warn('No hay datos para exportar');
      return;
    }

    const header = 'Categoría;Cantidad;Porcentaje\n';
    
    const rows = this.data
      .sort((a, b) => b.count - a.count)
      .map(d => {
        const category = d.category;
        const count = d.count;
        const percentage = (d.percentage || 0).toFixed(2);
        return `${category};${count};${percentage}%`;
      })
      .join('\n');

    const csvContent = '\uFEFF' + header + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const timestamp = new Date().toISOString().split('T')[0];
    link.download = `categorias-populares-${timestamp}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Obtiene el total de publicaciones
   */
  public getTotalPosts(): number {
    if (!this.data || this.data.length === 0) return 0;
    return this.data.reduce((sum, d) => sum + d.count, 0);
  }

  /**
   * Obtiene la categoría más popular
   */
  public getTopCategory(): string {
    if (!this.data || this.data.length === 0) return 'N/A';
    const sorted = [...this.data].sort((a, b) => b.count - a.count);
    return sorted[0]?.category || 'N/A';
  }

  /**
   * Obtiene el número de categorías diferentes con formato activas/totales
   */
  public getCategoriesCount(): string {
    if (!this.data || this.data.length === 0) {
      return this.totalCategoriesInDb > 0 ? `0/${this.totalCategoriesInDb}` : '0';
    }
    const activeCategories = this.data.length;
    return this.totalCategoriesInDb > 0 ? `${activeCategories}/${this.totalCategoriesInDb}` : activeCategories.toString();
  }
}
