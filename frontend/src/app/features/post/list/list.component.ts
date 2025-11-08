import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { ViewportScroller } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { PostsService, Post, TypePost, FilterPostDTO, PostLiked } from '../../../core/services/posts.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar.component';
import { AuthService } from '../../../core/services/auth.service';
import { AlertService } from '../../../shared/services/alert.service';

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
  selectedTagName: string | null = null;
  
  cursor: number | null = null;
  limit = 10;
  hasMore = true;

  showImageModal = false;
  currentImages: string[] = [];
  currentImageIndex = 0;

  showDropdownId: number | null = null;
  currentUserId: number | null = null;

  showLikesModal = false;
  usersWhoLiked: PostLiked[] = [];
  loadingLikes = false;

  constructor(
    private postsService: PostsService,
    private router: Router,
    private authService: AuthService,
    private route: ActivatedRoute,
    private viewportScroller: ViewportScroller,
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    this.loadTypePosts();
    
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.selectedTagName = params['tag'] || null;
        if (this.selectedTagName) {
          this.filterPosts();
        } else {
          this.loadPosts();
        }
      });
    
    this.isAuthenticated = this.authService.isAuthenticated();
    
    const currentUser = this.authService.currentUserValue;
    this.currentUserId = currentUser?.id ? Number(currentUser.id) : null;
    
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
          
          this.hasMore = posts.length === this.limit;
          if (posts.length > 0) {
            this.cursor = posts[posts.length - 1].id;
          }
          
          this.isLoading = false;
          this.restoreScrollPosition();
        },
        error: (err) => {
          console.error('Error loading posts:', err);
          this.errorMessage = 'Error al cargar las publicaciones';
          this.isLoading = false;
        }
      });
  }

  restoreScrollPosition(): void {
    const savedPosition = sessionStorage.getItem('postListScrollPosition');
    if (savedPosition) {
      setTimeout(() => {
        requestAnimationFrame(() => {
          window.scrollTo({
            top: parseInt(savedPosition, 10),
            behavior: 'auto'
          });
          sessionStorage.removeItem('postListScrollPosition');
        });
      }, 300);
    }
  }

  filterPosts(): void {
    if (!this.searchTerm && !this.selectedTypeId && !this.selectedTagName) {
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

    if (this.selectedTagName) {
      filters.tags = [this.selectedTagName];
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
    this.selectedTagName = null;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {}
    });
    this.loadPosts();
  }

  filterByTag(tagName: string): void {
    this.selectedTagName = tagName;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tag: tagName }
    });
    this.filterPosts();
  }

  goToCreate(): void {
    this.router.navigate(['/post/create']);
  }

  viewPostDetails(postId: number): void {
    sessionStorage.setItem('postListScrollPosition', window.pageYOffset.toString());
    this.router.navigate(['/post', postId]);
  }

  goToEdit(postId: number): void {
    this.router.navigate(['/post/edit', postId]);
  }

  viewImage(imageUrl: string): void {
    window.open(imageUrl, '_blank');
  }

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

  async deletePost(post: Post): Promise<void> {
    this.closeDropdown();
    
    const confirmed = await this.alertService.confirm({
      title: '¿Eliminar publicación?',
      message: `¿Estás seguro de que deseas eliminar <strong>"${post.title}"</strong>?<br><br>Esta acción no se puede deshacer.`,
      type: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280'
    });

    if (confirmed) {
      this.alertService.showLoading('Eliminando...', 'Por favor espera');

      this.postsService.deletePost(post.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.posts = this.posts.filter(p => p.id !== post.id);
            this.alertService.close();
            
            // Esperar un momento antes de mostrar el mensaje de éxito
            setTimeout(async () => {
              await this.alertService.success(
                '¡Eliminado!',
                'La publicación ha sido eliminada exitosamente.'
              );
            }, 300);
          },
          error: (err) => {
            console.error('Error al eliminar el post:', err);
            this.alertService.close();
            
            // Esperar un momento antes de mostrar el mensaje de error
            setTimeout(async () => {
              await this.alertService.error(
                'Error',
                'Hubo un error al eliminar la publicación. Por favor, intenta nuevamente.'
              );
            }, 300);
          }
        });
    }
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
    this.router.navigate(['/organization/donations/create'], {
      queryParams: { post: post.id }
    });
  }

  donateToCampaign(post: Post): void {
    // Navegar a la página de donación con el ID del post
    this.router.navigate(['/organization/donations/create'], {
      queryParams: { post: post.id }
    });
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

  showUsersWhoLiked(postId: number): void {
    this.loadingLikes = true;
    this.showLikesModal = true;
    this.usersWhoLiked = [];

    this.postsService.getUsersLikePost(postId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          this.usersWhoLiked = users;
          this.loadingLikes = false;
        },
        error: (err) => {
          console.error('Error loading users who liked:', err);
          this.loadingLikes = false;
          this.usersWhoLiked = [];
        }
      });
  }

  closeLikesModal(): void {
    this.showLikesModal = false;
    this.usersWhoLiked = [];
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

  navigateToProfile(userId: number, event: Event): void {
    event.stopPropagation(); // Prevenir que se abra el detalle del post
    this.router.navigate(['/profile', userId]);
  }
}
