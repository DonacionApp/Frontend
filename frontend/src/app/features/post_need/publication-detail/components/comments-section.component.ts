import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Comment {
  text: string;
}

@Component({
  selector: 'app-comments-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="border-t pt-4">
      <h3 class="text-lg font-semibold text-gray-900 mb-3">
        Instrucciones y comentarios
      </h3>
      <div class="space-y-2">
        <div 
          *ngFor="let comment of comments" 
          class="p-3 bg-blue-50 border-l-4 border-blue-500 rounded"
        >
          <p class="text-gray-700">{{ comment.text }}</p>
        </div>
      </div>
    </div>
  `
})
export class CommentsSectionComponent {
  @Input() comments: Comment[] = [];
}

