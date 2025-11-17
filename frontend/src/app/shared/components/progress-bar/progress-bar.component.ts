import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-progress-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-medium text-gray-700">{{ label }}</h3>
        <span class="text-2xl font-bold text-gray-900">{{ currentValue }}</span>
      </div>
      
      <!-- Progress Bar -->
      <div class="relative">
        <div class="overflow-hidden h-2 text-xs flex rounded-full bg-gray-200">
          <div 
            [style.width.%]="percentage" 
            [class]="barColor"
            class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500">
          </div>
        </div>
        <div class="flex items-center justify-between mt-2">
          <span class="text-xs text-gray-500">0</span>
          <span class="text-xs font-semibold text-gray-700">{{ percentage }}%</span>
          <span class="text-xs text-gray-500">{{ maxValue }}</span>
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
export class ProgressBarComponent {
  @Input() label: string = '';
  @Input() currentValue: number = 0;
  @Input() maxValue: number = 100;
  @Input() barColor: string = 'bg-blue-500';
  @Input() percentage: number = 0;

  ngOnChanges(): void {
    // Calcular el porcentaje automáticamente si se proporcionan los valores
    if (this.maxValue > 0 && this.percentage === 0) {
      this.percentage = Math.round((this.currentValue / this.maxValue) * 100);
    }
  }
}
