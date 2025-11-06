import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PostsService, TypePost } from '../../../core/services/posts.service';
import { ArticlesService, Article } from '../../../core/services/articles.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';

interface SelectedArticle {
  articleId: number;
  articleName: string;
  quantity: number;
}

interface ImagePreview {
  file: File;
  url: string;
}

@Component({
  selector: 'app-create-edit',
  imports: [CommonModule, FormsModule, ButtonComponent],
  templateUrl: './create-edit.component.html',
  styleUrl: './create-edit.component.scss'
})
export class CreateEditComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  isEditMode = false;
  postId: number | null = null;
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  title = '';
  message = '';
  selectedTypeId: number | null = null;
  
  typesPosts: TypePost[] = [];
  availableArticles: Article[] = [];
  selectedArticles: SelectedArticle[] = [];
  
  imagePreviews: ImagePreview[] = [];
  maxImages = 5;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private postsService: PostsService,
    private articlesService: ArticlesService
  ) {}

  ngOnInit(): void {
    this.loadTypePosts();
    this.loadArticles();
    
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        if (params['id']) {
          this.isEditMode = true;
          this.postId = +params['id'];
          this.loadPostData(this.postId);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.imagePreviews.forEach(preview => URL.revokeObjectURL(preview.url));
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
          this.errorMessage = 'Error al cargar los tipos de publicación';
        }
      });
  }

  loadArticles(): void {
    this.articlesService.getAllArticles({ orderBy: 'ASC' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (articles) => {
          this.availableArticles = articles;
        },
        error: (err) => {
          console.error('Error loading articles:', err);
          this.errorMessage = 'Error al cargar los artículos';
        }
      });
  }

  loadPostData(id: number): void {
    this.isLoading = true;
    this.postsService.getPostById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (post) => {
          this.title = post.title;
          this.message = post.message;
          this.selectedTypeId = post.typePost?.id || null;
          
          if (post.postArticle && post.postArticle.length > 0) {
            this.selectedArticles = post.postArticle.map(pa => ({
              articleId: pa.article.id,
              articleName: pa.article.name,
              quantity: Number(pa.quantity)
            }));
          }
          
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading post:', err);
          this.errorMessage = 'Error al cargar la publicación';
          this.isLoading = false;
        }
      });
  }

  get selectedType(): TypePost | undefined {
    return this.typesPosts.find(t => t.id === this.selectedTypeId);
  }

  get requiresArticles(): boolean {
    const typeName = this.selectedType?.type.toLowerCase() || '';
    return typeName.includes('solicitud de donacion') || 
           typeName.includes('articulos para donar');
  }

  onTypeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedTypeId = select.value ? +select.value : null;
    
    if (!this.requiresArticles) {
      this.selectedArticles = [];
    }
  }

  onImageSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    const files = Array.from(input.files);
    const remainingSlots = this.maxImages - this.imagePreviews.length;
    
    if (remainingSlots <= 0) {
      this.errorMessage = `Solo puedes agregar máximo ${this.maxImages} imágenes`;
      return;
    }

    const filesToAdd = files.slice(0, remainingSlots);
    
    filesToAdd.forEach(file => {
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file);
        this.imagePreviews.push({ file, url });
      }
    });

    if (files.length > remainingSlots) {
      this.errorMessage = `Solo se agregaron ${remainingSlots} de ${files.length} archivos (máximo ${this.maxImages})`;
    }
    
    input.value = '';
  }

  removeImage(index: number): void {
    URL.revokeObjectURL(this.imagePreviews[index].url);
    this.imagePreviews.splice(index, 1);
    this.errorMessage = '';
  }

  addArticle(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const articleId = +select.value;
    
    if (!articleId) return;
    
    const article = this.availableArticles.find(a => a.id === articleId);
    if (!article) return;
    
    const alreadySelected = this.selectedArticles.find(a => a.articleId === articleId);
    if (alreadySelected) {
      this.errorMessage = 'Este artículo ya está agregado';
      return;
    }
    
    this.selectedArticles.push({
      articleId: article.id,
      articleName: article.name,
      quantity: 1
    });
    
    select.value = '';
    this.errorMessage = '';
  }

  updateArticleQuantity(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const quantity = +input.value;
    
    if (quantity > 0) {
      this.selectedArticles[index].quantity = quantity;
    }
  }

  removeArticle(index: number): void {
    this.selectedArticles.splice(index, 1);
  }

  async onSubmit(): Promise<void> {
    if (!this.validateForm()) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const formData = new FormData();
      
      formData.append('title', this.title);
      formData.append('message', this.message);
      
      if (this.selectedTypeId) {
        formData.append('typePostId', this.selectedTypeId.toString());
      }
      
      this.imagePreviews.forEach((preview) => {
        formData.append('images', preview.file);
      });
      
      if (this.requiresArticles && this.selectedArticles.length > 0) {
        const articles = this.selectedArticles.map(a => ({
          articleId: a.articleId,
          quantity: a.quantity
        }));
        formData.append('articles', JSON.stringify(articles));
      }

      if (this.isEditMode && this.postId) {
        const updateData = {
          title: this.title,
          message: this.message
        };
        
        this.postsService.updatePost(this.postId, updateData)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (response) => {
              this.successMessage = 'Publicación actualizada exitosamente';
              setTimeout(() => {
                this.router.navigate(['/post', this.postId]);
              }, 1500);
            },
            error: (err) => {
              console.error('Error updating post:', err);
              this.errorMessage = err.error?.message || 'Error al actualizar la publicación';
              this.isLoading = false;
            }
          });
      } else {
        this.postsService.createPost(formData)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (post) => {
              this.successMessage = 'Publicación creada exitosamente';
              setTimeout(() => {
                this.router.navigate(['/post', post.id]);
              }, 1500);
            },
            error: (err) => {
              console.error('Error creating post:', err);
              this.errorMessage = err.error?.message || 'Error al crear la publicación';
              this.isLoading = false;
            }
          });
      }
    } catch (err) {
      console.error('Error preparing form:', err);
      this.errorMessage = 'Error al preparar el formulario';
      this.isLoading = false;
    }
  }

  validateForm(): boolean {
    if (!this.title.trim()) {
      this.errorMessage = 'El título es obligatorio';
      return false;
    }
    
    if (!this.message.trim()) {
      this.errorMessage = 'El mensaje es obligatorio';
      return false;
    }
    
    if (!this.selectedTypeId) {
      this.errorMessage = 'Debes seleccionar un tipo de publicación';
      return false;
    }
    
    if (this.requiresArticles && this.selectedArticles.length === 0) {
      this.errorMessage = 'Debes agregar al menos un artículo';
      return false;
    }
    
    return true;
  }

  cancel(): void {
    this.router.navigate(['/post']);
  }
}
