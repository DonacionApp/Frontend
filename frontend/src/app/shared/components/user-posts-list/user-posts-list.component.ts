import { Component, Input, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { Post, PostsService } from '../../../core/services/posts.service';
import { AuthService } from '../../../core/services/auth.service';
import { ScrollRestorationService } from '../../../core/services/scroll-restoration.service';

@Component({
  selector: 'app-user-posts-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './user-posts-list.component.html',
  styleUrls: ['./user-posts-list.component.scss']
})
export class UserPostsListComponent implements OnChanges, OnDestroy {
  private destroy$ = new Subject<void>();
  
  @Input() posts: Post[] = [];
  @Input() isLoading: boolean = false;
  @Input() errorMessage: string = '';

  isAuthenticated = false;
  currentUserId: number | null = null;

  constructor(
    private router: Router,
    private authService: AuthService,
    private postsService: PostsService,
    private scrollService: ScrollRestorationService
  ) {
    this.isAuthenticated = this.authService.isAuthenticated();
    const currentUser = this.authService.currentUserValue;
    this.currentUserId = currentUser?.id ? Number(currentUser.id) : null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['posts']) {
      console.log('Posts received:', this.posts);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get canLike(): boolean {
    return this.authService.canLike();
  }

  get canRequestDonation(): boolean {
    return this.authService.canRequestDonation();
  }

  toggleLike(post: Post, event: Event): void {
    event.stopPropagation();
    
    if (!this.authService.canLike()) {
      this.router.navigate(['/auth/login']);
      return;
    }

    if (post.userHasLiked) {
      this.postsService.removeLikeFromPost(post.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            post.userHasLiked = false;
            post.likesCount--;
          },
          error: (err) => console.error('Error removing like:', err)
        });
    } else {
      this.postsService.addLikeToPost(post.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            post.userHasLiked = true;
            post.likesCount++;
          },
          error: (err) => console.error('Error adding like:', err)
        });
    }
  }

  viewPostDetails(postId: number): void {
    // Guardar posición de scroll para el perfil antes de navegar a detalles
    this.scrollService.savePosition('profileScrollPosition');
    this.router.navigate(['/post', postId]);
  }

  openImageGallery(images: any[], event: Event): void {
    event.stopPropagation();
    if (images.length > 0) {
      window.open(images[0].image, '_blank');
    }
  }

  requestDonation(post: Post, event: Event): void {
    event.stopPropagation();
    
    if (!this.authService.canRequestDonation()) {
      if (!this.authService.isAuthenticated()) {
        this.router.navigate(['/auth/login']);
      } else {
        // Mostrar mensaje de que necesita verificación
        alert('Debes verificar tu cuenta para solicitar donaciones');
      }
      return;
    }
    
    this.router.navigate(['/organization/donations/create'], {
      queryParams: { post: post.id }
    });
  }

  donateToCampaign(post: Post, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/donor/donate'], {
      queryParams: { campaign: post.id }
    });
  }

  isPostOwner(post: Post): boolean {
    if (!post || !this.currentUserId) return false;
    return post.user.id === this.currentUserId;
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
