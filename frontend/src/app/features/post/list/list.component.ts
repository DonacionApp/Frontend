import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PostsService, Post, TypePost, FilterPostDTO } from '../../../core/services/posts.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar.component';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-list',
  imports: [CommonModule, RouterModule, ButtonComponent, SidebarComponent],
  templateUrl: './list.component.html',
  styleUrl: './list.component.scss'
})
export class ListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  posts: Post[] = [];
  typesPosts: TypePost[] = [];
  isLoading = false;
  errorMessage = '';
  isAuthenticated = false;
  
  selectedTypeId: number | null = null;
  searchTerm = '';
  
  cursor: number | null = null;
  limit = 10;
  hasMore = true;

  // Image gallery modal
  showImageModal = false;
  currentImages: string[] = [];
  currentImageIndex = 0;

  // Dropdown state for owner actions
  showDropdownId: number | null = null;
  currentUserId: number | null = null;

  constructor(
    private postsService: PostsService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadTypePosts();
    this.loadPosts();
    
    // Verificar autenticación
    this.isAuthenticated = this.authService.isAuthenticated();
    
    // Obtener el ID del usuario actual
    const currentUser = this.authService.currentUserValue;
    this.currentUserId = currentUser?.id ? Number(currentUser.id) : null;
    
    // Suscribirse a cambios en el usuario
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        this.isAuthenticated = this.authService.isAuthenticated();
        this.currentUserId = user?.id ? Number(user.id) : null;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTypePosts(): void {
    this.postsService.getAllTypePost()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (types) => {
          this.typesPosts = types;
        },
        error: (err) => {
          console.error('Error loading post types:', err);
        }
      });
  }

  loadPosts(append = false): void {
    this.isLoading = true;
    this.errorMessage = '';

    const params = {
      limit: this.limit,
      cursor: append && this.cursor ? this.cursor : undefined
    };

    this.postsService.getAllPosts(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (posts) => {
          if (append) {
            this.posts = [...this.posts, ...posts];
          } else {
            this.posts = posts;
          }
          console.log('Loaded posts:', posts);
          
          this.hasMore = posts.length === this.limit;
          if (posts.length > 0) {
            this.cursor = posts[posts.length - 1].id;
          }
          
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading posts:', err);
          this.errorMessage = 'Error al cargar las publicaciones';
          this.isLoading = false;
        }
      });
  }

  filterPosts(): void {
    if (!this.searchTerm && !this.selectedTypeId) {
      this.loadPosts();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cursor = null;
    this.hasMore = false;

    const filters: FilterPostDTO = {};
    
    if (this.searchTerm && this.searchTerm.trim()) {
      filters.search = this.searchTerm.trim();
    }
    
    if (this.selectedTypeId) {
      filters.typePost = this.selectedTypeId;
    }
    
    filters.orderBy = 'createdAt';
    filters.orderDirection = 'DESC';

    this.postsService.getPostsWithFilters(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (posts) => {
          this.posts = posts;
          this.isLoading = false;
        },
        error: (err) => {
          // Si es 404, significa que no hay resultados con ese filtro
          if (err.status === 404) {
            this.posts = [];
            this.errorMessage = '';
          } else {
            this.errorMessage = 'Error al filtrar las publicaciones';
          }
          this.isLoading = false;
          console.error('Error filtering posts:', err);
        }
      });
  }

  onTypeFilterChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    this.selectedTypeId = value === '' ? null : +value;
    
    if (this.selectedTypeId === null && !this.searchTerm) {
      this.loadPosts();
    } else {
      this.filterPosts();
    }
  }

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm = input.value.trim();
    
    if (this.searchTerm.length >= 3) {
      this.filterPosts();
    } else if (this.searchTerm.length === 0 && !this.selectedTypeId) {
      this.loadPosts();
    } else if (this.searchTerm.length === 0 && this.selectedTypeId) {
      this.filterPosts();
    }
  }

  loadMore(): void {
    if (!this.isLoading && this.hasMore) {
      this.loadPosts(true);
    }
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedTypeId = null;
    this.loadPosts();
  }

  goToCreate(): void {
    this.router.navigate(['/post/create']);
  }

  goToEdit(postId: number): void {
    this.router.navigate(['/post/edit', postId]);
  }

  viewImage(imageUrl: string): void {
    window.open(imageUrl, '_blank');
  }

  // Dropdown methods for owner actions
  toggleDropdown(postId: number, event: Event): void {
    event.stopPropagation();
    this.showDropdownId = this.showDropdownId === postId ? null : postId;
  }

  closeDropdown(): void {
    this.showDropdownId = null;
  }

  isPostOwner(post: Post): boolean {
    if (!post || !this.currentUserId) return false;
    return post.user.id === this.currentUserId;
  }

  editPost(post: Post): void {
    this.closeDropdown();
    this.router.navigate(['/post/edit', post.id]);
  }

  deletePost(post: Post): void {
    console.log('Eliminar post:', post.id);
    this.closeDropdown();
    // TODO: Confirmation dialog and delete logic
  }

  toggleLike(post: Post): void {
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

  handleCreatePost(): void {
    this.router.navigate(['/post/create']);
  }

  requestDonation(post: Post): void {
    // TODO: Implementar lógica de solicitud de donación
    console.log('Solicitar donación para el post:', post.id);
    // Por ahora solo muestra un mensaje en consola
    alert(`Solicitud de donación para "${post.title}" registrada (funcionalidad en desarrollo)`);
  }

  openImageGallery(images: any[], index: number): void {
    this.currentImages = images.map(img => img.image);
    this.currentImageIndex = index;
    this.showImageModal = true;
    document.body.style.overflow = 'hidden'; // Prevent scroll
  }

  closeImageGallery(): void {
    this.showImageModal = false;
    document.body.style.overflow = 'auto'; // Restore scroll
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

  onKeyDown(event: KeyboardEvent): void {
    if (!this.showImageModal) return;
    
    if (event.key === 'ArrowRight') {
      this.nextImage();
    } else if (event.key === 'ArrowLeft') {
      this.previousImage();
    } else if (event.key === 'Escape') {
      this.closeImageGallery();
    }
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event): void {
    const target = event.target as HTMLElement;
    if (this.showDropdownId && !target.closest('.dropdown-container')) {
      this.closeDropdown();
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    this.onKeyDown(event);
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
