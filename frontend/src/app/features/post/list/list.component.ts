import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PostsService, Post, TypePost, FilterPostDTO } from '../../../core/services/posts.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';

@Component({
  selector: 'app-list',
  imports: [CommonModule, RouterModule, ButtonComponent],
  templateUrl: './list.component.html',
  styleUrl: './list.component.scss'
})
export class ListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  posts: Post[] = [];
  typesPosts: TypePost[] = [];
  isLoading = false;
  errorMessage = '';
  
  selectedTypeId: number | null = null;
  searchTerm = '';
  
  cursor: number | null = null;
  limit = 10;
  hasMore = true;

  constructor(
    private postsService: PostsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadTypePosts();
    this.loadPosts();
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
        },
        error: (err) => {
          this.errorMessage = 'Error al cargar las publicaciones';
          this.isLoading = false;
          console.error('Error loading posts:', err);
        }
      });
  }

  filterPosts(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cursor = null;

    const filters: FilterPostDTO = {
      search: this.searchTerm || undefined,
      typePost: this.selectedTypeId || undefined,
      orderBy: 'createdAt',
      orderDirection: 'DESC'
    };

    this.postsService.getPostsWithFilters(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (posts) => {
          this.posts = posts;
          this.isLoading = false;
          this.hasMore = false;
        },
        error: (err) => {
          this.errorMessage = 'Error al filtrar las publicaciones';
          this.isLoading = false;
          console.error('Error filtering posts:', err);
        }
      });
  }

  onTypeFilterChange(typeId: number | null): void {
    this.selectedTypeId = typeId;
    if (typeId === null) {
      this.loadPosts();
    } else {
      this.filterPosts();
    }
  }

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm = input.value;
    
    if (this.searchTerm.length >= 3 || this.searchTerm.length === 0) {
      this.filterPosts();
    }
  }

  loadMore(): void {
    if (!this.isLoading && this.hasMore) {
      this.loadPosts(true);
    }
  }

  goToCreate(): void {
    this.router.navigate(['/post/create']);
  }

  goToEdit(postId: number): void {
    this.router.navigate(['/post/edit', postId]);
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

  getTypeColor(typeId: number): string {
    const typeColors: { [key: number]: string } = {
      1: 'bg-blue-100 text-blue-800',        // donacion
      2: 'bg-purple-100 text-purple-800',    // publicacion
      6: 'bg-green-100 text-green-800',      // donacion completada
      7: 'bg-orange-100 text-orange-800',    // solicitud de donacion
      8: 'bg-pink-100 text-pink-800'         // articulos para donar
    };
    return typeColors[typeId] || 'bg-gray-100 text-gray-800';
  }
}
