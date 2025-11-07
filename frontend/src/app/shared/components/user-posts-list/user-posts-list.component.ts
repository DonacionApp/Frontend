import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Post } from '../../../core/services/posts.service';

@Component({
  selector: 'app-user-posts-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './user-posts-list.component.html',
  styleUrls: ['./user-posts-list.component.scss']
})
export class UserPostsListComponent implements OnChanges {
  @Input() posts: Post[] = [];
  @Input() isLoading: boolean = false;
  @Input() errorMessage: string = '';

  constructor(private router: Router) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['posts']) {
      console.log('Posts received:', this.posts);
    }
  }

  viewPostDetails(postId: number): void {
    this.router.navigate(['/post', postId]);
  }

  openImageGallery(images: any[], event: Event): void {
    event.stopPropagation();
    if (images.length > 0) {
      window.open(images[0].image, '_blank');
    }
  }

  getTypeColor(typeName: string): string {
    const typeColors: { [key: string]: string } = {
      'donacion': 'bg-blue-100 text-blue-800',
      'publicacion': 'bg-purple-100 text-purple-800',
      'donacion completada': 'bg-green-100 text-green-800',
      'solicitud de donacion': 'bg-orange-100 text-orange-800',
      'articulos para donar': 'bg-pink-100 text-pink-800'
    };
    return typeColors[typeName.toLowerCase()] || 'bg-gray-100 text-gray-800';
  }
}
