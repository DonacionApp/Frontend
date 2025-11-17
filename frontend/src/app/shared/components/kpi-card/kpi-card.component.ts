import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
      <div [class]="colorClass" class="p-6 text-white">
        <div class="flex items-center justify-between mb-4">
          <!-- Icon -->
          <div class="p-3 bg-white bg-opacity-20 rounded-lg backdrop-blur-sm">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="iconPath"></path>
            </svg>
          </div>
          
          <!-- Trend Badge -->
          <div *ngIf="trend" class="flex items-center gap-1 bg-white bg-opacity-20 px-2 py-1 rounded-full text-xs font-medium">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="getTrendIconPath()"></path>
            </svg>
            <span class="text-white">{{ trend }}</span>
          </div>
        </div>
        
        <!-- Title -->
        <h3 class="text-sm font-medium mb-2 opacity-90">{{ title }}</h3>
        
        <!-- Value or Loading -->
        <div *ngIf="!loading" class="mb-1">
          <p class="text-3xl font-bold">{{ value }}</p>
        </div>
        <div *ngIf="loading" class="mb-1">
          <div class="h-9 bg-white bg-opacity-20 rounded animate-pulse"></div>
        </div>
        
        <!-- Subtitle -->
        <p *ngIf="subtitle" class="text-xs opacity-75">{{ subtitle }}</p>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class KpiCardComponent {
  @Input() title: string = '';
  @Input() value: string | number = 0;
  @Input() subtitle?: string;
  @Input() iconPath: string = '';
  @Input() colorClass: string = 'bg-gradient-to-br from-blue-500 to-blue-600';
  @Input() trend?: string;
  @Input() trendDirection?: 'up' | 'down' | 'neutral' = 'neutral';
  @Input() loading: boolean = false;

  getTrendIconPath(): string {
    if (this.trendDirection === 'up') {
      return 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6';
    } else if (this.trendDirection === 'down') {
      return 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6';
    }
    return 'M5 12h14';
  }
}
