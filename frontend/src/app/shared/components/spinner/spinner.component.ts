import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-spinner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      class="flex flex-col items-center justify-center py-12"
      [class.fixed]="overlay"
      [class.inset-0]="overlay"
      [class.bg-white]="overlay"
      [class.bg-opacity-80]="overlay"
      [class.z-50]="overlay"
    >
      <div 
        class="animate-spin rounded-full border-b-2 border-green-600"
        [style.width.px]="size"
        [style.height.px]="size"
        [style.border-width]="size >= 40 ? '4px' : '3px'"
      ></div>
      <p *ngIf="message" class="mt-3 text-sm text-gray-600">{{ message }}</p>
    </div>
  `
})
export class SpinnerComponent {
  @Input() size: number = 48;
  @Input() message?: string;
  @Input() overlay: boolean = false;
}