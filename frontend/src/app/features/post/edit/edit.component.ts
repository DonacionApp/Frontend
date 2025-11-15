import { Component, OnInit, OnDestroy, Pipe, PipeTransform } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of, firstValueFrom } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import { PostsService, Tag } from '../../../core/services/posts.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';

interface ExistingImage {
  id: number;
  url: string;
}

@Pipe({ name: 'safeUrl' })
export class SafeUrlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}
  transform(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}

@Component({
  selector: 'app-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, SpinnerComponent, ButtonComponent, SafeUrlPipe],
  templateUrl: './edit.component.html',
  styleUrls: ['./edit.component.scss']
})
export class EditComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  postId?: number;
  isLoading = false;
  // Helpers para tipo de archivo (igual que en list.component.ts)
  isImageFile(url: string): boolean {
    if (!url) return false;
    return /\.(jpeg|jpg|png|gif|bmp|webp)$/i.test(url);
  }
  isVideoFile(url: string): boolean {
    if (!url) return false;
    const u = url.toLowerCase();
    return u.endsWith('.mp4') || u.endsWith('.webm') || u.endsWith('.ogg');
  }
  isAudioFile(url: string): boolean {
    if (!url) return false;
    const u = url.toLowerCase();
    return u.endsWith('.mp3') || u.endsWith('.wav') || u.endsWith('.ogg');
  }
  isPdfFile(url: string): boolean {
    if (!url) return false;
    const u = url.toLowerCase();
    return u.endsWith('.pdf') || u.includes('.pdf?') || u.startsWith('data:application/pdf');
  }

  // Modal navegable para archivos
  showFileModal = false;
  currentFiles: { url: string, type: 'image' | 'video' | 'audio' | 'pdf' | 'doc' }[] = [];
  currentFileIndex = 0;

  openFileModal(files: ExistingImage[], index: number): void {
    this.currentFiles = files.map(f => {
      const url = f.url;
      if (this.isImageFile(url)) return { url, type: 'image' as const };
      if (this.isVideoFile(url)) return { url, type: 'video' as const };
      if (this.isAudioFile(url)) return { url, type: 'audio' as const };
      if (this.isPdfFile(url)) return { url, type: 'pdf' as const };
      return { url, type: 'doc' as const };
    });
    this.currentFileIndex = index;
    this.showFileModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeFileModal(): void {
    this.showFileModal = false;
    document.body.style.overflow = 'auto';
  }

  nextFile(): void {
    if (this.currentFiles && this.currentFileIndex < this.currentFiles.length - 1) {
      this.currentFileIndex++;
    }
  }

  previousFile(): void {
    if (this.currentFiles && this.currentFileIndex > 0) {
      this.currentFileIndex--;
    }
  }

  errorMessage = '';
  successMessage = '';

  title = '';
  message = '';
  
  tags: string[] = [];
  originalTags: string[] = [];
  tagInput = '';
  tagSuggestions: Tag[] = [];
  showTagSuggestions = false;
  private tagQuery$ = new Subject<string>();

  existingImages: ExistingImage[] = [];
  newImageFiles: File[] = [];
  newImagePreviews: string[] = [];
  maxNewImages = 5;
  
  postType: string = '';
  postArticles: string[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private postsService: PostsService
  ) {}

  ngOnInit(): void {
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        if (params['id']) {
          this.postId = +params['id'];
          this.loadPostData(this.postId);
        } else {
          this.errorMessage = 'ID de publicación no válido';
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
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.newImagePreviews.forEach(url => URL.revokeObjectURL(url));
  }

  loadPostData(id: number): void {
    this.isLoading = true;
    this.postsService.getPostById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (post) => {
          this.title = post.title;
          this.message = post.message;
          
          this.tags = post.tags.map(pt => pt.tag.tag);
          this.originalTags = [...this.tags];

          this.existingImages = post.imagePost.map(im => ({
            id: im.id,
            url: im.image
          }));

          this.postType = post.typePost?.type || 'Sin tipo';
          this.postArticles = (post.postArticle || []).map(pa => 
            `${pa.article.name} (${pa.quantity})`
          );
          
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading post:', err);
          this.errorMessage = 'Error al cargar la publicación';
          this.isLoading = false;
        }
      });
  }

  onTagInputChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.tagInput = value;
    this.tagQuery$.next(value);

    if (/[ ,]$/.test(value)) {
      this.finalizeCurrentTag();
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

  addTag(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
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

  removeExistingImage(index: number): void {
    const img = this.existingImages[index];
    if (!img || !this.postId) return;

    if (!confirm('¿Seguro que deseas eliminar esta imagen?')) return;

    this.isLoading = true;
    this.postsService.deleteImageFromPost(img.id, this.postId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.existingImages.splice(index, 1);
          this.successMessage = 'Imagen eliminada';
          setTimeout(() => this.successMessage = '', 2000);
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error eliminando imagen:', err);
          this.errorMessage = 'No se pudo eliminar la imagen';
          this.isLoading = false;
        }
      });
  }

  onNewImageSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    const files = Array.from(input.files);
    const remainingSlots = this.maxNewImages - this.newImageFiles.length;

    if (remainingSlots <= 0) {
      this.errorMessage = `Solo puedes agregar máximo ${this.maxNewImages} imágenes nuevas`;
      input.value = '';
      return;
    }

    const filesToAdd = files.slice(0, remainingSlots);
    
    filesToAdd.forEach(file => {
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        this.newImageFiles.push(file);
        const url = URL.createObjectURL(file);
        this.newImagePreviews.push(url);
      }
    });

    if (files.length > remainingSlots) {
      this.errorMessage = `Solo se agregaron ${remainingSlots} de ${files.length} archivos`;
    }

    input.value = '';
  }

  removeNewImage(index: number): void {
    URL.revokeObjectURL(this.newImagePreviews[index]);
    this.newImageFiles.splice(index, 1);
    this.newImagePreviews.splice(index, 1);
    this.errorMessage = '';
  }

  async onSubmit(): Promise<void> {
    if (!this.validateForm()) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      if (!this.postId) {
        this.errorMessage = 'ID de publicación no válido';
        this.isLoading = false;
        return;
      }

      await firstValueFrom(this.postsService.updatePost(this.postId, {
        title: this.title,
        message: this.message
      }));

      await this.syncTags();

      if (this.newImageFiles.length > 0) {
        const fd = new FormData();
        this.newImageFiles.forEach(file => fd.append('files', file));
        await firstValueFrom(this.postsService.addImageToPost(this.postId, fd));
      }

      this.successMessage = 'Publicación actualizada exitosamente';
      setTimeout(() => {
        this.router.navigate(['/post', this.postId]);
      }, 1200);
    } catch (err: any) {
      console.error('Error durante la edición:', err);
      this.errorMessage = err.error?.message || 'Error al editar la publicación';
    } finally {
      this.isLoading = false;
    }
  }

  private async syncTags(): Promise<void> {
    if (!this.postId) return;

    const current = this.tags;
    const removed = this.originalTags.filter(o => !current.some(c => c.toLowerCase() === o.toLowerCase()));
    const added = current.filter(c => !this.originalTags.some(o => o.toLowerCase() === c.toLowerCase()));

    for (const tagName of added) {
      try {
        let tag: Tag;
        try {
          tag = await firstValueFrom(this.postsService.getTagByName(tagName));
        } catch {
          tag = await firstValueFrom(this.postsService.createTag(tagName));
        }
        await firstValueFrom(this.postsService.addTagToPost(tag.id, this.postId!));
      } catch (err) {
        console.error('Error adding tag', tagName, err);
      }
    }

    for (const tagName of removed) {
      try {
        const tag = await firstValueFrom(this.postsService.getTagByName(tagName));
        await firstValueFrom(this.postsService.removeTagFromPost(tag.id, this.postId!));
      } catch (err) {
        console.warn('Error removing tag', tagName, err);
      }
    }

    this.originalTags = [...current];
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
    return true;
  }

  cancel(): void {
    if (this.postId) {
      this.router.navigate(['/post', this.postId]);
    } else {
      this.router.navigate(['/post']);
    }
  }
}
