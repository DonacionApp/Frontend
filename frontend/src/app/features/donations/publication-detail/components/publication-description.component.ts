import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-publication-description',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div>
      <h3 class="text-lg font-semibold text-gray-900 mb-2">Descripción</h3>
      <p class="text-gray-700 whitespace-pre-wrap">{{ description }}</p>
    </div>
  `
})
export class PublicationDescriptionComponent {
  @Input() description: string = '';
}

