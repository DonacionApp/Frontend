import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ArticleSummary } from '../../../core/services/public-stats.service';

@Component({
  selector: 'app-articles-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './articles-list.component.html',
  styleUrl: './articles-list.component.scss'
})
export class ArticlesListComponent {
  @Input() title: string = 'Artículos';
  @Input() articles: ArticleSummary[] = [];
  @Input() emptyMessage: string = 'No hay artículos para mostrar';
  @Input() iconColor: string = 'blue';

  get hasArticles(): boolean {
    return this.articles && this.articles.length > 0;
  }

  get totalQuantity(): number {
    return this.articles.reduce((sum, article) => sum + article.quantity, 0);
  }

  get iconColorClass(): string {
    const colorMap: { [key: string]: string } = {
      'blue': 'text-blue-600',
      'green': 'text-green-600',
      'purple': 'text-purple-600',
      'orange': 'text-orange-600',
      'pink': 'text-pink-600',
      'indigo': 'text-indigo-600'
    };
    return colorMap[this.iconColor] || 'text-blue-600';
  }

  get bgColorClass(): string {
    const colorMap: { [key: string]: string } = {
      'blue': 'bg-blue-50',
      'green': 'bg-green-50',
      'purple': 'bg-purple-50',
      'orange': 'bg-orange-50',
      'pink': 'bg-pink-50',
      'indigo': 'bg-indigo-50'
    };
    return colorMap[this.iconColor] || 'bg-blue-50';
  }

  get borderColorClass(): string {
    const colorMap: { [key: string]: string } = {
      'blue': 'border-blue-200',
      'green': 'border-green-200',
      'purple': 'border-purple-200',
      'orange': 'border-orange-200',
      'pink': 'border-pink-200',
      'indigo': 'border-indigo-200'
    };
    return colorMap[this.iconColor] || 'border-blue-200';
  }
}
