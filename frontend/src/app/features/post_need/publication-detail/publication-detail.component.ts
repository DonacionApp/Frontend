import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
 
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Services
import { DonationService, Donation } from '../../../core/services/post.service';
import { AuthService } from '../../../core/services/auth.service';

// Shared Components
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { ErrorMessageComponent } from '../../../shared/components/error-message/error-message.component';
import { BackButtonComponent } from '../../../shared/components/back-button/back-button.component';

// Publication Components
import { PublicationHeaderComponent } from './components/publication-header.component';
import { ImageGalleryComponent } from './components/image-gallery.component';
import { PublicationDescriptionComponent } from './components/publication-description.component';
import { ArticlesListComponent } from './components/articles-list.component';
import { CommentsSectionComponent } from './components/comments-section.component';
import { VideosSectionComponent } from './components/videos-section.component';
import { PdfsSectionComponent } from './components/pdfs-section.component';
import { PublicationFooterComponent } from './components/publication-footer.component';

@Component({
  selector: 'app-publication-detail',
  standalone: true,
  imports: [
    CommonModule,
    SpinnerComponent,
    ErrorMessageComponent,
    BackButtonComponent,
    PublicationHeaderComponent,
    ImageGalleryComponent,
    PublicationDescriptionComponent,
    ArticlesListComponent,
    CommentsSectionComponent,
    VideosSectionComponent,
    PdfsSectionComponent,
    PublicationFooterComponent
  ],
  templateUrl: './publication-detail.component.html',
  styleUrls: ['./publication-detail.component.scss']
})
export class PublicationDetailComponent implements OnInit, OnDestroy {
  // State
  donation: Donation | null = null;
  loading = true;
  errorMessage = '';
  selectedImage: string | null = null;
  imageGalleryItems: Array<{ url: string; name: string }> = [];
  
  // Computed properties
  daysRemaining = 0;
  urgencyClass = '';
  
  // Destroy subject for cleanup
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private donationService: DonationService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadDonation();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load donation data
   */
  private loadDonation(): void {
    const id = this.route.snapshot.paramMap.get('id');
    
    if (!id) {
      this.handleError('ID de donación no válido');
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.imageGalleryItems = [];
    this.selectedImage = null;
    
    this.donationService.getDonationById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (donation) => {
          this.handleDonationLoaded(donation);
        },
        error: (error) => {
          if (error.status === 404) {
            this.handleError('Donación no encontrada');
          } else {
            this.handleError('Error al cargar la donación. Por favor intenta nuevamente.');
          }
        }
      });
  }

  /**
   * Handle successful donation load
   */
  private handleDonationLoaded(donation: Donation): void {
    this.donation = donation;
    this.calculateDaysRemaining();
    this.setUrgencyClass();
    
    // Log para verificar tags
    console.log('🏷️ Publication Detail - Tags recibidos:', {
      publicationId: donation.id,
      hasTags: !!donation.tags,
      tagsCount: donation.tags?.length || 0,
      tags: donation.tags?.map(t => ({ id: t.id, tag: t.tag || t.name })) || []
    });
    
    // Obtener imágenes y establecer la primera como seleccionada
    this.imageGalleryItems = this.getImages();
    
    // Establecer la primera imagen como seleccionada solo si es válida
    const firstImage = this.imageGalleryItems[0];
    if (firstImage && firstImage.url && firstImage.url.trim() !== '') {
      this.selectedImage = firstImage.url;
    } else {
      this.selectedImage = null;
    }
    
    this.loading = false;
  }

  /**
   * Handle error
   */
  private handleError(message: string): void {
    this.errorMessage = message;
    this.loading = false;
    this.imageGalleryItems = [];
    this.selectedImage = null;
  }

  /**
   * Calculate days remaining until deadline
   */
  private calculateDaysRemaining(): void {
    if (!this.donation?.fechaMaximaEntrega) {
      this.daysRemaining = 0;
      return;
    }

    const deadline = new Date(this.donation.fechaMaximaEntrega);
    const today = new Date();
    const diffTime = deadline.getTime() - today.getTime();
    this.daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Set urgency class based on days remaining
   */
  private setUrgencyClass(): void {
    if (this.daysRemaining < 0) {
      this.urgencyClass = 'bg-red-100 text-red-700';
    } else if (this.daysRemaining <= 3) {
      this.urgencyClass = 'bg-orange-100 text-orange-700';
    } else if (this.daysRemaining <= 7) {
      this.urgencyClass = 'bg-yellow-100 text-yellow-700';
    } else {
      this.urgencyClass = 'bg-green-100 text-green-700';
    }
  }

  // ===== Getters =====

  get profilePhotoUrl(): string {
    return this.donation?.user?.profilePhoto || this.getDefaultAvatar();
  }

  private getDefaultAvatar(): string {
    // SVG inline como data URI para evitar problemas de carga
    return 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <circle cx="50" cy="50" r="50" fill="#e5e7eb"/>
        <g fill="#9ca3af">
          <circle cx="50" cy="35" r="15"/>
          <path d="M 25 70 Q 25 55 35 52 L 65 52 Q 75 55 75 70 L 75 85 Q 75 90 70 90 L 30 90 Q 25 90 25 85 Z"/>
        </g>
      </svg>
    `);
  }

  get username(): string {
    return this.donation?.user?.username || 'Usuario desconocido';
  }

  get isOwner(): boolean {
    const currentUser = this.authService.currentUserValue;
    return this.donation?.userId === currentUser?.id;
  }
  
  /**
   * Navega a la página de edición de la publicación
   */
  onEdit(): void {
    if (!this.donation?.id) return;
    const donationId = String(this.donation.id);
    this.router.navigate(['/donations', donationId, 'edit']);
  }

  // ===== File Getters =====

  getImages(): Array<{ url: string; name: string }> {
    const normalize = (url: string | undefined): string => {
      if (!url || typeof url !== 'string' || url.trim() === '') return '';
      // Si ya es una URL completa, retornarla tal cual
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url.trim();
      }
      // Normalizar URL relativa
      const base = environment.apiBackendUrl.replace(/\/$/, '');
      const path = url.startsWith('/') ? url.trim() : `/${url.trim()}`;
      return `${base}${path}`;
    };

    // PRIORIDAD 1: imagePost (imágenes realmente subidas por el usuario)
    const imagePostArr: Array<any> = Array.isArray((this.donation as any)?.imagePost) ? (this.donation as any).imagePost : [];
    const fromImagePost = imagePostArr
      .map((img: any, idx: number) => {
        const url = normalize(img?.image || img?.url || img?.path);
        return url ? { url, name: `imagen-${idx + 1}` } : null;
      })
      .filter((x): x is { url: string; name: string } => !!x);

    // Si hay imágenes en imagePost, devolver solo esas (no duplicar con otras fuentes)
    if (fromImagePost.length > 0) {
      return fromImagePost;
    }

    // PRIORIDAD 2: files (como fallback)
    const fromFiles = this.donation?.files?.filter(f => f.type === 'image').map(f => {
      const normalizedUrl = normalize(f.url);
      if (!normalizedUrl) return null;
      return {
        url: normalizedUrl,
        name: f.name || 'imagen'
      };
    }).filter((x): x is { url: string; name: string } => !!x) || [];

    if (fromFiles.length > 0) {
      return fromFiles;
    }

    // PRIORIDAD 3: imageUrl
    const fromImageUrl = this.donation?.imageUrl ? (() => {
      const normalizedUrl = normalize(this.donation.imageUrl);
      return normalizedUrl ? [{
        url: normalizedUrl,
        name: 'imagen-principal'
      }] : [];
    })() : [];

    if (fromImageUrl.length > 0) {
      return fromImageUrl;
    }

    // PRIORIDAD 4: images array (como último recurso)
    const rawImages: Array<any> = Array.isArray(this.donation?.images) ? (this.donation as any).images : [];
    const fromStringArray = rawImages
      .map((img: any, idx: number) => {
        const raw = typeof img === 'string' ? img : (img?.url || img?.path || img?.imageUrl || img?.location || img?.fileUrl || img?.image);
        const url = normalize(raw);
        return url ? { url, name: `imagen-${idx + 1}` } : null;
      })
      .filter((x): x is { url: string; name: string } => !!x);

    return fromStringArray;
  }

  getVideos(): Array<{ url: string; name: string }> {
    return this.donation?.files?.filter(f => f.type === 'video').map(f => ({
      url: f.url,
      name: f.name
    })) || [];
  }

  getPdfs(): Array<{ url: string; name: string; size: number }> {
    return this.donation?.files?.filter(f => f.type === 'pdf').map(f => ({
      url: f.url,
      name: f.name,
      size: f.size || 0
    })) || [];
  }

  // ===== Event Handlers =====

  onBack(): void {
    this.router.navigate(['/donations/feed']);
  }

  onImageSelect(imageUrl: string): void {
    this.selectedImage = imageUrl;
  }

  onLikeToggle(): void {
    if (!this.donation?.id) return;

    const currentUser = this.authService.currentUserValue;
    if (!currentUser) {
      this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: this.router.url }
      });
      return;
    }

    // Prevenir múltiples clics si ya está en proceso
    if (this.donationService.isLikeInProgress(this.donation.id)) {
      return;
    }

    if (!this.donation) return;

    const isLiked = this.donation.isLikedByCurrentUser || false;
    const newLikeState = !isLiked;

    // Actualización optimista INMEDIATA: cambiar estado local
    this.donation = {
      ...this.donation,
      isLikedByCurrentUser: newLikeState,
      likesCount: Math.max(0, (this.donation.likesCount || 0) + (newLikeState ? 1 : -1))
    } as Donation;

    // Forzar detección de cambios para actualizar vista inmediatamente
    this.cdr.markForCheck();

    // Llamar al servicio para sincronizar con el backend
    this.donationService.toggleLike(this.donation.id, isLiked)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedDonation) => {
          if (updatedDonation && this.donation) {
            // Sincronizar con respuesta del servidor
            this.donation = {
              ...this.donation,
              likes: updatedDonation.likes || this.donation.likes,
              likesCount: updatedDonation.likesCount ?? this.donation.likesCount ?? 0,
              isLikedByCurrentUser: updatedDonation.isLikedByCurrentUser ?? this.donation.isLikedByCurrentUser ?? false,
              updatedAt: updatedDonation.updatedAt || this.donation.updatedAt
            } as Donation;
            this.cdr.markForCheck();
          } else if (updatedDonation) {
            this.donation = updatedDonation;
            this.cdr.markForCheck();
          }
        },
        error: (error) => {
          console.error('❌ Error al cambiar el like:', error);
          console.error('📋 Detalles completos del error:', {
            status: error.status,
            statusText: error.statusText,
            url: error.url,
            errorBody: error.error,
            message: error.error?.message || error.message
          });

          // Revertir cambio optimista en caso de error
          if (this.donation) {
            this.donation = {
              ...this.donation,
              isLikedByCurrentUser: isLiked,
              likesCount: Math.max(0, (this.donation.likesCount || 0) - (newLikeState ? 1 : -1))
            } as Donation;
            this.cdr.markForCheck();
          }

          // Si es error 400, mostrar mensaje más específico
          if (error.status === 400) {
            const errorMessage = error.error?.message || 'El backend rechazó la petición';
            console.warn('⚠️ Error 400 - Posibles causas:', errorMessage);

            // Si el mensaje indica que ya existe el like, simplemente actualizar estado local
            if (errorMessage.toLowerCase().includes('ya le ha dado like') ||
                errorMessage.toLowerCase().includes('already') ||
                errorMessage.toLowerCase().includes('ya existe') ||
                errorMessage.toLowerCase().includes('duplicate')) {
              console.warn('✅ El like ya existe en el backend. Estado local ya está correcto.');
              // El estado local ya fue actualizado optimistamente correctamente
              // No necesitamos hacer nada más - no revertir ni recargar
              // El like ya está en el backend, solo estamos viendo que ya existía
              if (this.donation) {
                // Asegurar que el estado local refleje que el like está activo
                this.donation.isLikedByCurrentUser = !isLiked;
                this.cdr.markForCheck();
              }
              return; // No revertir en este caso
            }
          }

          // Mantener estado previo; el servicio ya sincroniza tras errores
        }
      });
  }
}

