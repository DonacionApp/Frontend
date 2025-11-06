import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PostsService, Post } from '../../../core/services/posts.service';
import { AuthService } from '../../../core/services/auth.service';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';

@Component({
  selector: 'app-details',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarComponent, ButtonComponent],
  templateUrl: './details.component.html',
  styleUrl: './details.component.scss'
})
export class DetailsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  post: Post | null = null;
  isLoading = true;
  errorMessage = '';
  isAuthenticated = false;
  postId!: number;
  currentUserId: number | null = null;

  // Image gallery modal
  showImageModal = false;
  currentImages: string[] = [];
  currentImageIndex = 0;

  // Dropdown menu
  showDropdown = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private postsService: PostsService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Get post ID from route
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.postId = +params['id'];
        if (this.postId) {
          this.loadPost();
        }
      });

    // Check authentication
    this.isAuthenticated = this.authService.isAuthenticated();
    const currentUser = this.authService.currentUserValue;
    this.currentUserId = currentUser?.id ? Number(currentUser.id) : null;
    
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.isAuthenticated = this.authService.isAuthenticated();
        this.currentUserId = user?.id ? Number(user.id) : null;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    document.body.style.overflow = 'auto';
  }

  loadPost(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.postsService.getPostById(this.postId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (post) => {
          this.post = post;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading post:', err);
          if (err.status === 404) {
            this.errorMessage = 'Publicación no encontrada';
          } else {
            this.errorMessage = 'Error al cargar la publicación';
          }
          this.isLoading = false;
        }
      });
  }

  toggleLike(): void {
    if (!this.post) return;

    if (this.post.userHasLiked) {
      this.postsService.removeLikeFromPost(this.post.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            if (this.post) {
              this.post.userHasLiked = false;
              this.post.likesCount--;
            }
          },
          error: (err) => console.error('Error removing like:', err)
        });
    } else {
      this.postsService.addLikeToPost(this.post.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            if (this.post) {
              this.post.userHasLiked = true;
              this.post.likesCount++;
            }
          },
          error: (err) => console.error('Error adding like:', err)
        });
    }
  }

  requestDonation(): void {
    if (!this.post) return;
    console.log('Solicitar donación para el post:', this.post.id);
    alert(`Solicitud de donación para "${this.post.title}" registrada (funcionalidad en desarrollo)`);
  }

  toggleDropdown(): void {
    this.showDropdown = !this.showDropdown;
  }

  closeDropdown(): void {
    this.showDropdown = false;
  }

  isPostOwner(): boolean {
    if (!this.post || !this.currentUserId) return false;
    return this.post.user.id === this.currentUserId;
  }

  editPost(): void {
    if (!this.post) return;
    this.closeDropdown();
    this.router.navigate(['/post/edit', this.post.id]);
  }

  deletePost(): void {
    if (!this.post) return;
    console.log('Eliminar post:', this.post.id);
    this.closeDropdown();
    // TODO: Confirmar y eliminar
    // const confirmDelete = confirm('¿Estás seguro de que deseas eliminar esta publicación?');
    // if (confirmDelete) { ... }
  }

  handleCreatePost(): void {
    this.router.navigate(['/post/create']);
  }

  goBack(): void {
    this.router.navigate(['/post']);
  }

  // Image Gallery Methods
  openImageGallery(images: any[], index: number): void {
    this.currentImages = images.map(img => img.image);
    this.currentImageIndex = index;
    this.showImageModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeImageGallery(): void {
    this.showImageModal = false;
    document.body.style.overflow = 'auto';
  }

  nextImage(): void {
    if (this.currentImageIndex < this.currentImages.length - 1) {
      this.currentImageIndex++;
    }
  }

  previousImage(): void {
    if (this.currentImageIndex > 0) {
      this.currentImageIndex--;
    }
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event): void {
    const target = event.target as HTMLElement;
    if (this.showDropdown && !target.closest('.dropdown-container')) {
      this.closeDropdown();
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (!this.showImageModal) return;
    
    if (event.key === 'ArrowRight') {
      this.nextImage();
    } else if (event.key === 'ArrowLeft') {
      this.previousImage();
    } else if (event.key === 'Escape') {
      this.closeImageGallery();
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
    return typeColors[typeName] || 'bg-gray-100 text-gray-800';
  }
}
