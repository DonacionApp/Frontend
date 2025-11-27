import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';

interface StatusData {
  status: string;
  count: number;
  percentage: number;
}

@Component({
  selector: 'app-donation-status-donut-chart',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './donation-status-donut-chart.component.html',
  styleUrls: ['./donation-status-donut-chart.component.scss']
})
export class DonationStatusDonutChartComponent implements OnInit, OnChanges {
  @Input() data: any[] = [];
  @Input() title: string = 'Estado de Donaciones';
  @Input() chartType: 'requests' | 'contributions' = 'requests'; // 'requests' = solicitudes, 'contributions' = aportes
  @Input() chartHeight: string = '300px';

  public doughnutChartLabels: string[] = [];
  public doughnutChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: []
  };
  public doughnutChartType: ChartType = 'doughnut';
  public doughnutChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          padding: 15,
          font: {
            size: 12
          },
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
          weight: 'bold'
        },
        bodyFont: {
          size: 13
        },
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    }
  } as any;

  statusBreakdown: StatusData[] = [];
  totalCount = 0;
  hasData = false;

  ngOnInit(): void {
    this.processData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && !changes['data'].firstChange) {
      this.processData();
    }
  }

  private processData(): void {
    if (!this.data || this.data.length === 0) {
      this.hasData = false;
      this.totalCount = 0;
      this.statusBreakdown = [];
      return;
    }

    // Agrupar por estado considerando los distintos formatos de entrada
    const statusMap = new Map<string, number>();

    this.data.forEach((record: any) => {
      const status = this.extractStatus(record);
      const count = this.extractCount(record);

      if (count <= 0) {
        return;
      }

      statusMap.set(status, (statusMap.get(status) || 0) + count);
    });

    this.totalCount = Array.from(statusMap.values()).reduce((sum, value) => sum + value, 0);

    if (this.totalCount === 0) {
      this.statusBreakdown = [];
      this.hasData = false;
      return;
    }

    // Convertir a array y calcular porcentajes
    this.statusBreakdown = Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
      percentage: (count / this.totalCount) * 100
    }));

    // Ordenar por cantidad descendente
    this.statusBreakdown.sort((a, b) => b.count - a.count);

    // Preparar datos para el gráfico
    this.doughnutChartLabels = this.statusBreakdown.map(item => item.status);
    this.doughnutChartData = {
      labels: this.doughnutChartLabels,
      datasets: [{
        data: this.statusBreakdown.map(item => item.count),
        backgroundColor: this.getStatusColors(this.statusBreakdown.map(item => item.status)),
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverOffset: 10
      }]
    };

    // Aplicar cutout para efecto de dona
    (this.doughnutChartOptions as any).cutout = '65%';
    this.hasData = true;
  }

  /**
   * Normalizar nombres de estados para consistencia
   */
  private normalizeStatus(status: string): string {
    const normalized = status.toLowerCase().trim();
    
    const statusMap: { [key: string]: string } = {
      'pendiente': 'Pendiente',
      'pending': 'Pendiente',
      'aceptada': 'Aceptada',
      'accepted': 'Aceptada',
      'en proceso': 'En Proceso',
      'in progress': 'En Proceso',
      'completada': 'Completada',
      'completed': 'Completada',
      'entregada': 'Entregada',
      'delivered': 'Entregada',
      'cancelada': 'Cancelada',
      'cancelled': 'Cancelada',
      'rechazada': 'Rechazada',
      'rejected': 'Rechazada'
    };

    return statusMap[normalized] || status;
  }

  /**
   * Extrae el nombre estandarizado del estado, sin importar el formato de entrada
   */
  private extractStatus(record: any): string {
    const rawStatus = record?.statusDonation?.status
      || record?.status
      || record?.name
      || 'Desconocido';
    return this.normalizeStatus(rawStatus);
  }

  /**
   * Determina la cantidad asociada al registro recibido.
   * Soporta objetos agregados (count/value), listas de donaciones o registros individuales.
   */
  private extractCount(record: any): number {
    if (!record) {
      return 0;
    }

    if (typeof record.count === 'number' && !isNaN(record.count)) {
      return record.count;
    }

    if (typeof record.value === 'number' && !isNaN(record.value)) {
      return record.value;
    }

    if (Array.isArray(record.donations)) {
      return record.donations.length;
    }

    return 1; // Registro individual
  }

  /**
   * Obtener colores según el estado
   */
  private getStatusColors(statuses: string[]): string[] {
    const colorMap: { [key: string]: string } = {
      'Pendiente': '#FFA500',
      'Aceptada': '#4CAF50',
      'En Proceso': '#2196F3',
      'Completada': '#8BC34A',
      'Entregada': '#00BCD4',
      'Cancelada': '#9E9E9E',
      'Rechazada': '#F44336'
    };

    return statuses.map(status => colorMap[status] || '#607D8B');
  }

  /**
   * Obtener color para un estado específico
   */
  getColorForStatus(status: string): string {
    const colorMap: { [key: string]: string } = {
      'Pendiente': 'bg-orange-100 text-orange-800',
      'Aceptada': 'bg-green-100 text-green-800',
      'En Proceso': 'bg-blue-100 text-blue-800',
      'Completada': 'bg-green-100 text-green-800',
      'Entregada': 'bg-cyan-100 text-cyan-800',
      'Cancelada': 'bg-gray-100 text-gray-800',
      'Rechazada': 'bg-red-100 text-red-800'
    };

    return colorMap[status] || 'bg-gray-100 text-gray-800';
  }
}
