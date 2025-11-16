import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DataTableComponent, TableColumn, TableAction, BatchAction } from '../../../shared/components/data-table/data-table.component';
import { PostsService, Post, Tag, ImagePost, UpdatePostDTO } from '../../../core/services/posts.service';
import { ToastService } from '../../../core/services/toast.service';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { MessageModalComponent } from '../../../shared/components/message-modal/message-modal.component';

@Component({
  selector: 'app-posts',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DataTableComponent, ModalComponent, ConfirmModalComponent, MessageModalComponent],
  templateUrl: './posts.component.html',
  styleUrls: ['./posts.component.scss']
})
export class PostsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  posts: Post[] = [];
  loading = false;
  errorMessage = '';

  // Modal de edición de post
  showEditPostModal = false;
  editPostForm!: FormGroup;
  editingPost: Post | null = null;
  updatingPost = false;

  // Modal de gestión de imágenes
  showImagesModal = false;
  currentPostImages: ImagePost[] = [];
  currentPostId: number | null = null;
  uploadingImages = false;
  selectedFiles: File[] = [];

  // Modal de gestión de tags
  showTagsModal = false;
  currentPostTags: any[] = [];
  availableTags: Tag[] = [];
  selectedTagId: number | null = null;
  addingTag = false;

  // Modales
  showConfirmModal = false;
  showMessageModal = false;
  confirmModalConfig: {
    title: string;
    message: string;
    type: 'warning' | 'danger' | 'info';
    onConfirm: () => void;
  } | null = null;
  messageModalConfig: {
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  } | null = null;
  selectedPostForAction: Post | null = null;

  // Table configuration
  columns: TableColumn[] = [
    { key: 'id', label: 'ID', sortable: true, width: '80px' },
    { 
      key: 'title', 
      label: 'Título', 
      sortable: true 
    },
    { 
      key: 'message', 
      label: 'Mensaje', 
      sortable: false,
      render: (value) => value ? (value.length > 50 ? value.substring(0, 50) + '...' : value) : '-'
    },
    { 
      key: 'user', 
      label: 'Usuario', 
      sortable: false,
      render: (value) => value?.username || '-'
    },
    { 
      key: 'tags', 
      label: 'Tags', 
      sortable: false,
      render: (value) => value && Array.isArray(value) ? value.length : 0
    },
    { 
      key: 'imagePost', 
      label: 'Imágenes', 
      sortable: false,
      render: (value) => value && Array.isArray(value) ? value.length : 0
    },
    { 
      key: 'likesCount', 
      label: 'Likes', 
      sortable: true 
    },
    { 
      key: 'createdAt', 
      label: 'Fecha de Creación', 
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('es-ES') : '-'
    }
  ];

  actions: TableAction[] = [
    {
      label: 'Editar',
      icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
      action: (row) => this.openEditPostModal(row),
      variant: 'primary'
    },
    {
      label: 'Imágenes',
      icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
      action: (row) => this.openImagesModal(row),
      variant: 'secondary'
    },
    {
      label: 'Tags',
      icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
      action: (row) => this.openTagsModal(row),
      variant: 'secondary'
    },
    {
      label: 'Eliminar',
      icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
      action: (row) => this.deletePost(row),
      variant: 'danger'
    }
  ];

  batchActions: BatchAction[] = [
    {
      label: 'Eliminar seleccionados',
      icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
      action: (rows) => this.deleteBatch(rows),
      variant: 'danger',
      confirmMessage: '¿Estás seguro de eliminar los posts seleccionados?'
    }
  ];

  constructor(
    private postsService: PostsService,
    private fb: FormBuilder,
    private toastService: ToastService
  ) {
    this.initForms();
  }

  ngOnInit(): void {
    this.loadPosts();
    this.loadAvailableTags();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initForms(): void {
    this.editPostForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      message: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  loadPosts(): void {
    this.loading = true;
    this.errorMessage = '';
    
    this.postsService.getAllPosts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (posts) => {
          this.posts = posts;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading posts:', error);
          this.errorMessage = 'Error al cargar los posts';
          this.loading = false;
          this.toastService.show({
            title: 'Error',
            message: 'No se pudieron cargar los posts',
            type: 'error'
          });
        }
      });
  }

  loadAvailableTags(): void {
    this.postsService.getAllTags()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tags) => {
          this.availableTags = tags;
        },
        error: (error) => {
          console.error('Error loading tags:', error);
        }
      });
  }

  // Modal de edición de post
  openEditPostModal(post: Post): void {
    this.editingPost = post;
    this.editPostForm.patchValue({
      title: post.title,
      message: post.message
    });
    this.showEditPostModal = true;
  }

  closeEditPostModal(): void {
    this.showEditPostModal = false;
    this.editingPost = null;
    this.editPostForm.reset();
  }

  savePost(): void {
    if (this.editPostForm.invalid || !this.editingPost) {
      this.editPostForm.markAllAsTouched();
      return;
    }

    this.updatingPost = true;
    const formValue = this.editPostForm.value;
    const updateData: UpdatePostDTO = {
      title: formValue.title,
      message: formValue.message
    };

    this.postsService.updatePostAdmin(this.editingPost.id, updateData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedPost) => {
          this.toastService.show({
            title: 'Éxito',
            message: 'Post actualizado correctamente',
            type: 'success'
          });
          this.closeEditPostModal();
          this.loadPosts();
        },
        error: (error) => {
          console.error('Error updating post:', error);
          const errorMessage = error?.error?.message || 'No se pudo actualizar el post';
          this.toastService.show({
            title: 'Error',
            message: errorMessage,
            type: 'error'
          });
          this.updatingPost = false;
        }
      });
  }

  // Modal de gestión de imágenes
  openImagesModal(post: Post): void {
    this.currentPostId = post.id;
    this.currentPostImages = post.imagePost || [];
    this.selectedFiles = [];
    this.showImagesModal = true;
  }

  closeImagesModal(): void {
    this.showImagesModal = false;
    this.currentPostId = null;
    this.currentPostImages = [];
    this.selectedFiles = [];
  }

  onFileSelected(event: any): void {
    const files = Array.from(event.target.files) as File[];
    this.selectedFiles = [...this.selectedFiles, ...files];
  }

  removeSelectedFile(index: number): void {
    this.selectedFiles.splice(index, 1);
  }

  uploadImages(): void {
    if (!this.currentPostId || this.selectedFiles.length === 0) {
      return;
    }

    this.uploadingImages = true;
    const formData = new FormData();
    this.selectedFiles.forEach(file => {
      formData.append('files', file);
    });

    this.postsService.addImageToPostAdmin(this.currentPostId, formData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: 'Imágenes agregadas correctamente',
            type: 'success'
          });
          this.selectedFiles = [];
          this.loadPosts();
          // Recargar imágenes del post actual
          if (this.currentPostId) {
            const post = this.posts.find(p => p.id === this.currentPostId);
            if (post) {
              this.currentPostImages = post.imagePost || [];
            }
          }
          this.uploadingImages = false;
        },
        error: (error) => {
          console.error('Error uploading images:', error);
          this.toastService.show({
            title: 'Error',
            message: 'No se pudieron agregar las imágenes',
            type: 'error'
          });
          this.uploadingImages = false;
        }
      });
  }

  deleteImage(imageId: number): void {
    if (!this.currentPostId) {
      return;
    }

    if (!confirm('¿Estás seguro de eliminar esta imagen?')) {
      return;
    }

    this.postsService.deleteImageFromPostAdmin(imageId, this.currentPostId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: 'Imagen eliminada correctamente',
            type: 'success'
          });
          this.loadPosts();
          // Actualizar lista de imágenes
          this.currentPostImages = this.currentPostImages.filter(img => img.id !== imageId);
        },
        error: (error) => {
          console.error('Error deleting image:', error);
          this.toastService.show({
            title: 'Error',
            message: 'No se pudo eliminar la imagen',
            type: 'error'
          });
        }
      });
  }

  // Modal de gestión de tags
  openTagsModal(post: Post): void {
    this.currentPostId = post.id;
    this.currentPostTags = post.tags || [];
    this.selectedTagId = null;
    this.showTagsModal = true;
  }

  closeTagsModal(): void {
    this.showTagsModal = false;
    this.currentPostId = null;
    this.currentPostTags = [];
    this.selectedTagId = null;
  }

  addTagToPost(): void {
    if (!this.currentPostId || !this.selectedTagId) {
      return;
    }

    // Verificar si el tag ya está agregado
    const existingTag = this.currentPostTags.find(pt => pt.tag?.id === this.selectedTagId);
    if (existingTag) {
      this.toastService.show({
        title: 'Advertencia',
        message: 'Este tag ya está agregado al post',
        type: 'error'
      });
      return;
    }

    this.addingTag = true;
    this.postsService.addTagToPostAdmin(this.selectedTagId, this.currentPostId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: 'Tag agregado correctamente',
            type: 'success'
          });
          this.selectedTagId = null;
          this.loadPosts();
          // Actualizar lista de tags
          if (this.currentPostId) {
            const post = this.posts.find(p => p.id === this.currentPostId);
            if (post) {
              this.currentPostTags = post.tags || [];
            }
          }
          this.addingTag = false;
        },
        error: (error) => {
          console.error('Error adding tag:', error);
          this.toastService.show({
            title: 'Error',
            message: 'No se pudo agregar el tag',
            type: 'error'
          });
          this.addingTag = false;
        }
      });
  }

  removeTagFromPost(tagId: number): void {
    if (!this.currentPostId) {
      return;
    }

    if (!confirm('¿Estás seguro de eliminar este tag del post?')) {
      return;
    }

    this.postsService.removeTagFromPostAdmin(tagId, this.currentPostId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: 'Tag eliminado correctamente',
            type: 'success'
          });
          this.loadPosts();
          // Actualizar lista de tags
          this.currentPostTags = this.currentPostTags.filter(pt => pt.tag?.id !== tagId);
        },
        error: (error) => {
          console.error('Error removing tag:', error);
          this.toastService.show({
            title: 'Error',
            message: 'No se pudo eliminar el tag',
            type: 'error'
          });
        }
      });
  }

  // Eliminar post
  deletePost(post: Post): void {
    this.selectedPostForAction = post;
    this.confirmModalConfig = {
      title: 'Eliminar Post',
      message: `¿Estás seguro de eliminar el post "${post.title}"?`,
      type: 'warning',
      onConfirm: () => this.executeDeletePost(post.id)
    };
    this.showConfirmModal = true;
  }

  executeDeletePost(postId: number): void {
    this.showConfirmModal = false;
    this.postsService.deletePostAdmin(postId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Éxito',
            message: 'Post eliminado correctamente',
            type: 'success'
          };
          this.loadPosts();
        },
        error: (error) => {
          console.error('Error deleting post:', error);
          const errorMessage = error?.error?.message || error?.message || 'No se pudo eliminar el post';
          this.showMessageModal = true;
          this.messageModalConfig = {
            title: 'Error',
            message: errorMessage,
            type: 'error'
          };
        }
      });
  }

  closeConfirmModal(): void {
    this.showConfirmModal = false;
    this.confirmModalConfig = null;
    this.selectedPostForAction = null;
  }

  closeMessageModal(): void {
    this.showMessageModal = false;
    this.messageModalConfig = null;
  }

  handleConfirm(): void {
    if (this.confirmModalConfig?.onConfirm) {
      this.confirmModalConfig.onConfirm();
    }
  }

  deleteBatch(rows: Post[]): void {
    const deleteObservables = rows.map(post => 
      this.postsService.deletePostAdmin(post.id).pipe(
        catchError(error => {
          console.error(`Error deleting post ${post.id}:`, error);
          return of(null); // Continuar aunque falle uno
        })
      )
    );

    forkJoin(deleteObservables)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Éxito',
            message: `${rows.length} post(s) eliminado(s) correctamente`,
            type: 'success'
          });
          this.loadPosts();
        },
        error: (error) => {
          console.error('Error deleting posts:', error);
          this.toastService.show({
            title: 'Error',
            message: 'No se pudieron eliminar algunos posts',
            type: 'error'
          });
          this.loadPosts();
        }
      });
  }

  onBatchActionExecuted(event: { action: BatchAction; rows: any[] }): void {
    // La acción ya se ejecutó
  }
}

