import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnInit } from '@angular/core';
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
      <div class="relative bg-gray-100 min-h-[400px] flex items-center justify-center">
        <!-- Loading State -->
        <div *ngIf="imageLoading" class="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div class="flex flex-col items-center space-y-3">
            <div class="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p class="text-sm text-gray-600">Cargando imagen...</p>
          </div>
        </div>

        <!-- Error State -->
        <div *ngIf="imageError && !imageLoading" class="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div class="text-center p-6">
            <svg class="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p class="text-gray-600 font-medium">No se pudo cargar la imagen</p>
            <p class="text-sm text-gray-500 mt-1">La imagen no está disponible</p>
          </div>
        </div>

        <!-- Main Image -->
        <img 
          *ngIf="currentImage && currentImage.trim() !== '' && !imageError"
          [src]="currentImage" 
          [alt]="currentImageName || 'Imagen de la donación'"
          class="w-full max-h-[600px] object-contain"
          [class.hidden]="imageLoading"
          loading="eager"
          decoding="async"
          fetchpriority="high"
          (load)="onImageLoad()"
          (error)="onImageError($event)"
          crossorigin="anonymous"
        />
      </div>

      <!-- Thumbnails -->
      <div *ngIf="images.length > 1" class="p-4 bg-gray-50 flex gap-2 overflow-x-auto">
        <button
          *ngFor="let image of images; let i = index"
          (click)="selectImage(image.url)"
          class="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:scale-105"
          [class.border-blue-600]="selectedImage === image.url"
          [class.border-gray-200]="selectedImage !== image.url"
          [class.ring-2]="selectedImage === image.url"
          [class.ring-blue-300]="selectedImage === image.url"
          [attr.aria-label]="'Seleccionar ' + image.name"
        >
          <img 
            [src]="image.url" 
            [alt]="image.name || 'Miniatura ' + (i + 1)" 
            class="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            (error)="onThumbnailError($event, i)"
          />
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    img {
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
    }
  `]
})
export class ImageGalleryComponent implements OnInit, OnChanges {
  @Input() images: ImageFile[] = [];
  @Input() selectedImage: string | null = null;
  @Output() imageSelected = new EventEmitter<string>();

  imageLoading = true;
  imageError = false;
  private loadTimeoutId: any;
  private previousImageUrl: string = '';

  private startLoadingWatchdog(): void {
    if (this.loadTimeoutId) {
      clearTimeout(this.loadTimeoutId);
    }

    // Intentar verificar caché después de 100ms
    const cacheCheckId = setTimeout(() => {
      if (this.imageLoading && this.currentImage) {
        this.checkImageCache(this.currentImage);
      }
    }, 100);

    // Si en 10s no carga ni falla, marcar como error para evitar spinner infinito
    this.loadTimeoutId = setTimeout(() => {
      clearTimeout(cacheCheckId);
      if (this.imageLoading) {
        this.imageLoading = false;
        this.imageError = true;
      }
    }, 10000);
  }

  ngOnInit(): void {
    // Inicializar estado de carga cuando hay imágenes disponibles
    if (this.images && this.images.length > 0) {
      this.previousImageUrl = this.currentImage;
      this.imageLoading = true;
      this.imageError = false;
      this.startLoadingWatchdog();
    } else {
      this.imageLoading = false;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    const currentImageUrl = this.currentImage;

    // Manejar cuando las imágenes se reciben por primera vez
    if (changes['images'] && changes['images'].firstChange && this.images.length > 0) {
      this.previousImageUrl = currentImageUrl;
      this.imageLoading = true;
      this.imageError = false;
      this.startLoadingWatchdog();
    }

    // Reset loading state SOLO si la URL de imagen actual cambió
    if (changes['selectedImage'] && !changes['selectedImage'].firstChange) {
      const newImage = changes['selectedImage'].currentValue;
      if (newImage && newImage !== changes['selectedImage'].previousValue) {
        if (newImage !== this.previousImageUrl) {
          this.previousImageUrl = newImage;
          this.imageLoading = true;
          this.imageError = false;
          this.startLoadingWatchdog();
        }
      }
    }

    // Reset loading state SOLO si la URL actual realmente cambió
    if (changes['images'] && !changes['images'].firstChange) {
      if (currentImageUrl && currentImageUrl !== this.previousImageUrl) {
        this.previousImageUrl = currentImageUrl;
        this.imageLoading = true;
        this.imageError = false;
        this.startLoadingWatchdog();
      }
    }
  }

  get currentImage(): string {
    const image = this.selectedImage || (this.images.length > 0 ? this.images[0].url : '');
    return image;
  }

  get currentImageName(): string {
    if (this.selectedImage) {
      const selected = this.images.find(img => img.url === this.selectedImage);
      return selected?.name || '';
    }
    return this.images[0]?.name || '';
  }

  selectImage(url: string): void {
    if (!url || url === this.selectedImage) return;
    
    // Reset loading state when changing image
    this.imageLoading = true;
    this.imageError = false;
    this.imageSelected.emit(url);
  }

  onImageLoad(): void {
    this.imageLoading = false;
    this.imageError = false;
    if (this.loadTimeoutId) {
      clearTimeout(this.loadTimeoutId);
      this.loadTimeoutId = null;
    }
  }

  // Método para verificar si la imagen ya está en caché
  checkImageCache(imageSrc: string): void {
    const img = new Image();
    img.onload = () => {
      // Si la imagen se carga rápidamente desde caché, marcar como cargada
      this.imageLoading = false;
      this.imageError = false;
      if (this.loadTimeoutId) {
        clearTimeout(this.loadTimeoutId);
        this.loadTimeoutId = null;
      }
    };
    img.onerror = () => {
      // Si hay error al precargar, lo manejará el evento error del <img>
    };
    img.src = imageSrc;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    this.imageLoading = false;
    this.imageError = true;
    // Hide the broken image
    img.style.display = 'none';
    if (this.loadTimeoutId) {
      clearTimeout(this.loadTimeoutId);
      this.loadTimeoutId = null;
    }
  }

  onThumbnailError(event: Event, index: number): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
}

