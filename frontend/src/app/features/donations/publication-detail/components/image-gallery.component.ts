import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ImageFile {
  url: string;
  name: string;
}

@Component({
  selector: 'app-image-gallery',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="border-b border-gray-200">
      <!-- Main Image Display -->
      <div class="relative bg-black">
        <img 
          [src]="currentImage" 
          alt="Imagen de la donación"
          class="w-full h-96 object-contain"
        />
      </div>

      <!-- Thumbnails -->
      <div *ngIf="images.length > 1" class="p-4 bg-gray-50 flex gap-2 overflow-x-auto">
        <button
          *ngFor="let image of images"
          (click)="selectImage(image.url)"
          class="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          [class.border-blue-600]="selectedImage === image.url"
          [class.border-gray-200]="selectedImage !== image.url"
          [attr.aria-label]="'Seleccionar ' + image.name"
        >
          <img 
            [src]="image.url" 
            [alt]="image.name" 
            class="w-full h-full object-cover" 
          />
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class ImageGalleryComponent {
  @Input() images: ImageFile[] = [];
  @Input() selectedImage: string | null = null;
  @Output() imageSelected = new EventEmitter<string>();

  get currentImage(): string {
    return this.selectedImage || (this.images.length > 0 ? this.images[0].url : '');
  }

  selectImage(url: string): void {
    this.imageSelected.emit(url);
  }
}

