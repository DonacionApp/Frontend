import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

interface PdfFile {
  url: string;
  name: string;
  size: number;
}

@Component({
  selector: 'app-pdfs-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="border-t pt-4">
      <h3 class="text-lg font-semibold text-gray-900 mb-3">Documentos PDF</h3>
      <div class="space-y-2">
        <a 
          *ngFor="let pdf of pdfs"
          [href]="pdf.url" 
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center justify-between p-3 bg-red-50 hover:bg-red-100 rounded-lg transition-colors group"
        >
          <div class="flex items-center">
            <svg class="w-6 h-6 mr-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/>
            </svg>
            <div>
              <p class="font-medium text-gray-900 group-hover:text-red-700">{{ pdf.name }}</p>
              <p class="text-sm text-gray-500">{{ formatFileSize(pdf.size) }}</p>
            </div>
          </div>
          <svg class="w-5 h-5 text-gray-400 group-hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
          </svg>
        </a>
      </div>
    </div>
  `
})
export class PdfsSectionComponent {
  @Input() pdfs: PdfFile[] = [];

  formatFileSize(bytes: number): string {
    if (!bytes) return 'Tamaño desconocido';
    
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(2)} KB`;
    }
    
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  }
}

