import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, switchMap, of, catchError } from 'rxjs';
import { PostsService, TypePost } from '../../../core/services/posts.service';
import { ArticlesService, Article } from '../../../core/services/articles.service';
import { Tag } from '../../../core/services/posts.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';

interface SelectedArticle {
  articleId: number;
  articleName: string;
  quantity: number;
}

interface ArticleChecklistItem extends Article {
  isChecked: boolean;
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
  articleChecklistItems: ArticleChecklistItem[] = [];
  searchArticleText = '';
  showArticlePanel = false;
  newArticleName = '';
  newArticleDescription = '';
  showNewArticleForm = false;
  
  imagePreviews: ImagePreview[] = [];
  maxImages = 5;
  isDragging = false;

  // Tags state
  tags: string[] = [];
  tagInput = '';
  tagSuggestions: Tag[] = [];
  showTagSuggestions = false;
  private tagQuery$ = new Subject<string>();

  // AI tags
  aiTagsSuggested: string[] = [];
  isLoadingAiTags = false;
  aiTagsError = '';
  autoAddAiTags = false; // default OFF
  private aiTagsFetch$ = new Subject<void>();

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

    this.tagQuery$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => {
          const query = q.trim();
          if (query.length < 2) {
            return of([] as Tag[]);
          }
          return this.postsService.searchByNameSearc(query);
        })
      )
      .subscribe({
        next: (list) => {
          this.tagSuggestions = list;
          this.showTagSuggestions = list.length > 0;
        },
        error: () => {
          this.tagSuggestions = [];
          this.showTagSuggestions = false;
        }
      });
    this.aiTagsFetch$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(400),
        switchMap(() => {
          if (this.imagePreviews.length === 0) {
            this.aiTagsSuggested = [];
            return of<string[]>([]);
          }
          const fd = new FormData();
          let appended = 0;
          this.imagePreviews.forEach(p => {
            if (p.file.type.startsWith('image/')) {
              fd.append('files', p.file);
              appended++;
            }
          });
          if (appended === 0) {
            this.aiTagsSuggested = [];
            return of<string[]>([]);
          }
          this.isLoadingAiTags = true;
          this.aiTagsError = '';
          return this.postsService.getTagsFromImages(fd).pipe(
            catchError((err) => {
              console.error('AI tags error:', err);
              this.aiTagsError = 'No se pudieron generar etiquetas con IA';
              return of<string[]>([]);
            })
          );
        })
      )
      .subscribe((tags: string[]) => {
        this.isLoadingAiTags = false;
        if (!tags || tags.length === 0) {
          this.aiTagsSuggested = [];
          return;
        }
        const unique = (tags as Array<string | undefined | null>)
          .map((t: string | undefined | null) => (t ? t.toString().trim() : ''))
          .filter((v: string) => !!v)
          .filter((t: string, i: number, arr: string[]) => arr.findIndex((x: string) => x.toLowerCase() === t.toLowerCase()) === i)
          .filter((t: string) => !this.tags.some((ex: string) => ex.toLowerCase() === t.toLowerCase()))
          .slice(0, 15);

        if (this.autoAddAiTags) {
          unique.forEach(u => this.addTag(u));
          this.aiTagsSuggested = [];
        } else {
          this.aiTagsSuggested = unique;
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
          this.articleChecklistItems = articles.map(article => ({
            ...article,
            isChecked: false,
            quantity: 1
          }));
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
            post.postArticle.forEach(pa => {
              const item = this.articleChecklistItems.find(a => a.id === pa.article.id);
              if (item) {
                item.isChecked = true;
                item.quantity = Number(pa.quantity);
              }
            });
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

  get filteredArticles(): ArticleChecklistItem[] {
    if (!this.searchArticleText.trim()) {
      return this.articleChecklistItems;
    }
    
    const search = this.searchArticleText.toLowerCase();
    return this.articleChecklistItems.filter(article => 
      article.name.toLowerCase().includes(search) ||
      (article.descripcion && article.descripcion.toLowerCase().includes(search))
    );
  }

  get selectedArticlesCount(): number {
    return this.articleChecklistItems.filter(a => a.isChecked).length;
  }

  get selectedArticles(): SelectedArticle[] {
    return this.articleChecklistItems
      .filter(a => a.isChecked)
      .map(a => ({
        articleId: a.id,
        articleName: a.name,
        quantity: a.quantity
      }));
  }

  onTypeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedTypeId = select.value ? +select.value : null;
    
    if (!this.requiresArticles) {
      this.articleChecklistItems.forEach(item => {
        item.isChecked = false;
        item.quantity = 1;
      });
    }
  }

  toggleArticlePanel(): void {
    this.showArticlePanel = !this.showArticlePanel;
    if (!this.showArticlePanel) {
      this.searchArticleText = '';
      this.showNewArticleForm = false;
    }
  }

  toggleArticle(article: ArticleChecklistItem): void {
    article.isChecked = !article.isChecked;
    if (!article.isChecked) {
      article.quantity = 1;
    }
  }

  updateQuantity(article: ArticleChecklistItem, event: Event): void {
    const input = event.target as HTMLInputElement;
    const quantity = +input.value;
    
    if (quantity > 0) {
      article.quantity = quantity;
    } else {
      article.quantity = 1;
      input.value = '1';
    }
  }

  clearArticleSelection(): void {
    this.articleChecklistItems.forEach(item => {
      item.isChecked = false;
      item.quantity = 1;
    });
  }

  toggleNewArticleForm(): void {
    this.showNewArticleForm = !this.showNewArticleForm;
    if (!this.showNewArticleForm) {
      this.newArticleName = '';
      this.newArticleDescription = '';
    }
  }

  createNewArticle(): void {
    if (!this.newArticleName.trim()) {
      this.errorMessage = 'El nombre del artículo es obligatorio';
      return;
    }

    this.isLoading = true;
    this.articlesService.createArticle({ 
      name: this.newArticleName.trim(),
      description: this.newArticleDescription.trim() || undefined
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (newArticle) => {
          this.articleChecklistItems.push({
            ...newArticle,
            isChecked: true,
            quantity: 1
          });
          
          this.newArticleName = '';
          this.newArticleDescription = '';
          this.showNewArticleForm = false;
          this.successMessage = 'Artículo creado exitosamente';
          this.isLoading = false;
          
          setTimeout(() => {
            this.successMessage = '';
          }, 3000);
        },
        error: (err) => {
          console.error('Error creating article:', err);
          this.errorMessage = err.error?.message || 'Error al crear el artículo';
          this.isLoading = false;
        }
      });
  }

  onImageSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    this.processFiles(Array.from(input.files));
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.imagePreviews.length < this.maxImages) {
      this.isDragging = true;
    }
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    if (!event.dataTransfer?.files) return;
    if (this.isLoading || this.imagePreviews.length >= this.maxImages) return;

    this.processFiles(Array.from(event.dataTransfer.files));
  }

  private processFiles(files: File[]): void {
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
    
    // Trigger AI tags fetch after images updated
    this.queueAiTagsFetch();
  }

  removeImage(index: number): void {
    URL.revokeObjectURL(this.imagePreviews[index].url);
    this.imagePreviews.splice(index, 1);
    this.errorMessage = '';
    // Recompute AI suggestions when images change
    this.queueAiTagsFetch();
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
      
      if (this.selectedTypeId != null) {
        const typeIdNum = Number(this.selectedTypeId);
        formData.append('typePostId', typeIdNum.toString());
        // Some backends expect 'typePost' instead of 'typePostId'. Send both defensively.
        formData.append('typePost', typeIdNum.toString());
      }
      
      this.imagePreviews.forEach((preview) => {
        // Backend expects field name 'files' for create post
        formData.append('files', preview.file);
      });
      
      if (this.requiresArticles && this.selectedArticles.length > 0) {
        const articles = this.selectedArticles.map(a => ({
          idArticle: a.articleId,
          quantity: a.quantity
        }));
        formData.append('articles', JSON.stringify(articles));
      }

      // Send tags by names separated by commas if any
      if (this.tags.length > 0) {
        formData.append('tags', this.tags.join(','));
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
        // Debug: list FormData entries to verify field names
        try {
          /*console.log('FormData entries before submit:');
          for (const [k, v] of (formData as any).entries()) {
            console.log(k, v);
          }*/
        } catch {}
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

  // ===================== TAGS =====================
  onTagInputChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.tagInput = value;

    // Emit query to suggestions always while typing
    this.tagQuery$.next(value);

    // If last char is space/comma, finalize after updating suggestions
    if (/[ ,]$/.test(value)) {
      this.finalizeCurrentTag();
    }
  }

  // ===================== AI TAGS =====================
  private queueAiTagsFetch(): void {
    this.aiTagsFetch$.next();
  }

  acceptAiTag(tag: string): void {
    this.addTag(tag);
    // remove from suggestions
    this.aiTagsSuggested = this.aiTagsSuggested.filter(t => t.toLowerCase() !== tag.toLowerCase());
  }

  acceptAllAiTags(): void {
    this.aiTagsSuggested.forEach(t => this.addTag(t));
    this.aiTagsSuggested = [];
  }

  dismissAiTags(): void {
    this.aiTagsSuggested = [];
  }

  retryAiTags(): void {
    this.queueAiTagsFetch();
  }

  toggleAutoAddAiTags(): void {
    this.autoAddAiTags = !this.autoAddAiTags;
    if (this.autoAddAiTags && this.aiTagsSuggested.length > 0) {
      this.acceptAllAiTags();
    }
  }

  onTagKeydown(event: KeyboardEvent): void {
    const key = event.key;
    if (key === 'Enter') {
      event.preventDefault();
      if (this.tagInput.trim()) this.finalizeCurrentTag();
      return;
    }
    if (key === ' ' || key === ',' ) {
      // space or comma should finalize
      event.preventDefault();
      if (this.tagInput.trim()) this.finalizeCurrentTag();
      return;
    }
    if (key === 'Backspace' && !this.tagInput && this.tags.length > 0) {
      event.preventDefault();
      this.tags.pop();
      return;
    }
  }

  finalizeCurrentTag(): void {
    const raw = this.tagInput.replace(/[, ]+$/g, '');
    const tokens = raw.split(/[ ,]+/).map(t => t.trim()).filter(Boolean);
    tokens.forEach(t => this.addTag(t));
    this.tagInput = '';
    this.tagSuggestions = [];
    this.showTagSuggestions = false;
  }

  onTagEnter(event: Event): void {
    event.preventDefault();
    if (this.tagInput.trim()) {
      this.finalizeCurrentTag();
    }
  }

  onTagBackspace(event: Event): void {
    if (!this.tagInput && this.tags.length > 0) {
      event.preventDefault();
      this.tags.pop();
    }
  }

  addTag(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Avoid duplicates (case-insensitive)
    const exists = this.tags.some(t => t.toLowerCase() === trimmed.toLowerCase());
    if (!exists) this.tags.push(trimmed);
  }

  addTagFromSuggestion(s: Tag): void {
    this.addTag(s.tag);
    this.tagInput = '';
    this.tagSuggestions = [];
    this.showTagSuggestions = false;
  }

  removeTag(index: number): void {
    this.tags.splice(index, 1);
  }

  onTagBlur(): void {
    if (this.tagInput.trim()) {
      this.finalizeCurrentTag();
    }
    this.showTagSuggestions = false;
  }

  highlightMatch(text: string): string {
    const q = this.tagInput.trim();
    if (!q) return `#${text}`;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return `#${text}`;
    const before = text.substring(0, idx);
    const match = text.substring(idx, idx + q.length);
    const after = text.substring(idx + q.length);
    return `#${before}<mark class="bg-yellow-200">${match}</mark>${after}`;
  }
}
