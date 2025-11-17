import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
      <div class="flex items-center justify-between mb-4">
        <div [class]="colorClass" class="p-3 rounded-lg">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="iconPath"></path>
          </svg>
        </div>
      </div>
      
      <h3 class="text-sm font-medium text-gray-600 mb-2">{{ title }}</h3>
      
      <div *ngIf="!loading">
        <p class="text-2xl font-bold text-gray-900 mb-1">{{ value }}</p>
        <div *ngIf="trend" class="flex items-center gap-1">
          <svg [class]="getTrendColor()" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="getTrendIconPath()"></path>
          </svg>
          <span [class]="getTrendColor()" class="text-sm font-medium">{{ trend }}</span>
          <span class="text-xs text-gray-500 ml-1">{{ subtitle }}</span>
        </div>
      </div>
      
      <div *ngIf="loading">
        <div class="h-8 bg-gray-200 rounded animate-pulse mb-2"></div>
        <div class="h-4 bg-gray-200 rounded animate-pulse w-2/3"></div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class StatCardComponent {
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

  getTrendColor(): string {
    if (this.trendDirection === 'up') return 'text-green-600';
    if (this.trendDirection === 'down') return 'text-red-600';
    return 'text-gray-600';
  }
}
