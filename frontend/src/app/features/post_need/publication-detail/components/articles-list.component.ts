import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Article {
  name: string;
  quantity: number;
}

@Component({
  selector: 'app-articles-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="border-t pt-4">
      <h3 class="text-lg font-semibold text-gray-900 mb-3">
        Artículos necesarios
        <span class="text-sm font-normal text-gray-500 ml-2">
          ({{ totalQuantity }} total)
        </span>
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div 
          *ngFor="let article of articles" 
          class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <span class="font-medium text-gray-900">{{ article.name }}</span>
          <span class="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            x{{ article.quantity }}
          </span>
        </div>
      </div>
    </div>
  `
})
export class ArticlesListComponent {
  @Input() articles: Article[] = [];

  get totalQuantity(): number {
    return this.articles.reduce((sum, article) => sum + article.quantity, 0);
  }
}

