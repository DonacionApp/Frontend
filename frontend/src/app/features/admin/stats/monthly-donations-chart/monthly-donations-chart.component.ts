import { Component, OnInit, Input, OnDestroy, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CHART_COLORS, LINE_CHART_OPTIONS } from '../../../../shared/config/chart.config';

interface MonthlyData {
  month: string;
  donations: number;
  amount?: number;
}

@Component({
  selector: 'app-monthly-donations-chart',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './monthly-donations-chart.component.html',
  styleUrls: ['./monthly-donations-chart.component.scss']
})
export class MonthlyDonationsChartComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @Input() data: MonthlyData[] = [];
  @Input() showAmount = false; // Si es true, muestra monto en lugar de cantidad
  @Input() chartHeight = '320px';

  // Configuración del gráfico de líneas
  public lineChartData: ChartData<'line'> = {
    labels: [],
    datasets: []
  };

  public lineChartOptions: ChartConfiguration<'line'>['options'] = {
    ...LINE_CHART_OPTIONS,
    plugins: {
      ...LINE_CHART_OPTIONS.plugins,
      tooltip: {
        ...LINE_CHART_OPTIONS.plugins?.tooltip,
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            if (value === null || value === undefined) return label;
            if (this.showAmount) {
              return `${label}: $${value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
            return `${label}: ${value.toLocaleString('es-ES')} donaciones`;
          }
        }
      },
      title: {
        display: true,
        text: 'Donaciones por Mes',
        color: '#1F2937',
        font: {
          size: 16,
          weight: 'bold',
          family: "'Inter', sans-serif"
        },
        padding: { top: 10, bottom: 20 }
      }
    },
    scales: {
      ...LINE_CHART_OPTIONS.scales,
      y: {
        beginAtZero: true,
        grid: {
          display: true,
          color: 'rgba(229, 231, 235, 0.5)'
        },
        ticks: {
          color: '#6B7280',
          font: { size: 11 },
          stepSize: 1,
          callback: (value) => {
            // Mostrar solo números enteros
            if (Number.isInteger(value)) {
              if (this.showAmount) {
                return '$' + Number(value).toLocaleString('es-ES');
              }
              return value.toLocaleString('es-ES');
            }
            return '';
          }
        }
      }
    }
  };

  public isLoading = true;
  public hasData = false;
  private resizeListener?: () => void;

  constructor() {}

  ngOnInit(): void {
    this.initializeChart();
    this.setupResizeListener();
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
    this.lineChartOptions = {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: isTablet ? 1.2 : 2,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        ...LINE_CHART_OPTIONS.plugins,
        tooltip: {
          ...LINE_CHART_OPTIONS.plugins?.tooltip,
          callbacks: {
            label: (context) => {
              const label = context.dataset.label || '';
              const value = context.parsed.y;
              if (value === null || value === undefined) return label;
              return `${label}: ${value.toLocaleString('es-ES')}`;
            }
          }
        },
        title: {
          display: true,
          text: this.showAmount ? 'Donaciones Mensuales (Monto)' : 'Donaciones Mensuales (Cantidad)',
          color: '#1F2937',
          font: {
            size: isMobile ? 14 : 16,
            weight: 'bold',
            family: "'Inter', sans-serif"
          },
          padding: { top: 10, bottom: isMobile ? 15 : 20 }
        },
        legend: {
          position: 'bottom',
          labels: {
            color: '#374151',
            font: { size: isMobile ? 10 : 12 },
            padding: 15,
            usePointStyle: true
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(229, 231, 235, 0.5)'
          },
          ticks: {
            color: '#6B7280',
            font: { size: isMobile ? 10 : 12 },
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
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#4B5563',
            font: { size: isMobile ? 9 : 11 },
            maxRotation: isMobile ? 45 : 0,
            minRotation: isMobile ? 45 : 0
          }
        }
      }
    };
  }

  ngOnChanges(): void {
    // Detectar cambios en los datos de entrada
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
      // Mostrar estado de carga sin generar datos falsos
      this.isLoading = true;
      this.hasData = false;
    } else {
      this.updateChartData(this.data);
    }
  }

  /**
   * Actualiza los datos del gráfico
   */
  private updateChartData(data: MonthlyData[]): void {
    const labels = data.map(d => d.month);
    const values = data.map(d => this.showAmount ? (d.amount || 0) : d.donations);

    this.lineChartData = {
      labels,
      datasets: [
        {
          data: values,
          label: this.showAmount ? 'Monto Donado' : 'Cantidad de Donaciones',
          fill: true,
          tension: 0.4,
          borderColor: CHART_COLORS.primary.border,
          backgroundColor: this.createGradient(),
          pointBackgroundColor: CHART_COLORS.primary.border,
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: CHART_COLORS.primary.border,
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 3
        }
      ]
    };

    this.hasData = data.length > 0;
    this.isLoading = false;
  }

  /**
   * Crea un gradiente para el área bajo la línea
   */
  private createGradient(): CanvasGradient | string {
    // Nota: Este método será sobrescrito cuando el canvas esté disponible
    // Por ahora retornamos un color sólido con transparencia
    return CHART_COLORS.primary.background;
  }

  /**
   * Método público para actualizar los datos del gráfico desde el componente padre
   */
  public updateData(newData: MonthlyData[]): void {
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
   * Método para exportar los datos como CSV con formato de columnas
   */
  public exportCSV(): void {
    if (!this.data || this.data.length === 0) {
      console.warn('No hay datos para exportar');
      return;
    }

    // Siempre exportar ambas columnas (cantidad y monto)
    const header = 'Mes;Cantidad de Donaciones;Monto Total\n';
    
    const rows = this.data.map(d => {
      const month = d.month;
      const donations = d.donations;
      const amount = (d.amount || 0).toFixed(2);
      return `${month};${donations};${amount}`;
    }).join('\n');

    const csvContent = '\uFEFF' + header + rows; // BOM para UTF-8
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const timestamp = new Date().toISOString().split('T')[0];
    link.download = `donaciones-mensuales-${timestamp}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Obtiene el total de donaciones
   */
  public getTotalDonations(): number {
    if (!this.data || this.data.length === 0) return 0;
    return this.data.reduce((sum, d) => sum + d.donations, 0);
  }

  /**
   * Obtiene el total del monto donado
   */
  public getTotalAmount(): number {
    if (!this.data || this.data.length === 0) return 0;
    return this.data.reduce((sum, d) => sum + (d.amount || 0), 0);
  }

  /**
   * Obtiene el promedio mensual
   */
  public getMonthlyAverage(): number {
    if (!this.data || this.data.length === 0) return 0;
    const total = this.showAmount ? this.getTotalAmount() : this.getTotalDonations();
    return total / this.data.length;
  }
}
