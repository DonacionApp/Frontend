import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-back-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button 
      (click)="onClick.emit()"
      class="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
    >
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
      </svg>
      {{ label }}
    </button>
  `
})
export class BackButtonComponent {
  @Input() label: string = 'Volver';
  @Output() onClick = new EventEmitter<void>();
}

