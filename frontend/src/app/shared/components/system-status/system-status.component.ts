import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

interface StatusItem {
  name: string;
  status: 'operational' | 'degraded' | 'down';
}

interface ResourceMetric {
  name: string;
  value: number;
  maxValue: number;
  percentage: number;
  color: string;
}

@Component({
  selector: 'app-system-status',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-white rounded-xl shadow-md p-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">{{ title }}</h2>
      
      <!-- Status Items -->
      <div class="space-y-4">
        <div *ngFor="let item of statusItems" class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div 
              [class]="getStatusColor(item.status)" 
              class="w-3 h-3 rounded-full"
              [class.animate-pulse]="item.status === 'operational'">
            </div>
            <span class="text-sm font-medium text-gray-700">{{ item.name }}</span>
          </div>
          <span 
            [class]="getStatusTextColor(item.status)" 
            class="text-sm font-semibold">
            {{ getStatusText(item.status) }}
          </span>
        </div>

        <!-- Resource Metrics -->
        <div *ngIf="showMetrics && resourceMetrics.length > 0" class="mt-6 space-y-4">
          <div *ngFor="let metric of resourceMetrics" class="p-4 bg-gray-50 rounded-lg">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-gray-700">{{ metric.name }}</span>
              <span class="text-sm font-bold text-gray-900">{{ metric.percentage }}%</span>
            </div>
            <div class="overflow-hidden h-2 text-xs flex rounded-full bg-gray-200">
              <div 
                [style.width.%]="metric.percentage" 
                [class]="metric.color"
                class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center">
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class SystemStatusComponent {
  @Input() title: string = 'Estado del Sistema';
  @Input() statusItems: StatusItem[] = [];
  @Input() showMetrics: boolean = false;
  @Input() resourceMetrics: ResourceMetric[] = [];

  getStatusColor(status: string): string {
    switch (status) {
      case 'operational':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'down':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  }

  getStatusTextColor(status: string): string {
    switch (status) {
      case 'operational':
        return 'text-green-600';
      case 'degraded':
        return 'text-yellow-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'operational':
        return 'Operativo';
      case 'degraded':
        return 'Degradado';
      case 'down':
        return 'Inactivo';
      default:
        return 'Desconocido';
    }
  }
}
