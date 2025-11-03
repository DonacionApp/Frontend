import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
 
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Services
import { DonationService, Donation, DonationFile } from '../../../core/services/donation.service';
import { AuthService } from '../../../core/services/auth.service';

// Shared Components
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { ErrorMessageComponent } from '../../../shared/components/error-message/error-message.component';
import { BackButtonComponent } from '../../../shared/components/back-button/back-button.component';

// Publication Components
import { PublicationHeaderComponent } from './components/publication-header.component';
import { ImageGalleryComponent } from './components/image-gallery.component';
import { PublicationDescriptionComponent } from './components/publication-description.component';
import { LocationInfoComponent } from './components/location-info.component';
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
    LocationInfoComponent,
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
  
  // Computed properties
  daysRemaining = 0;
  urgencyClass = '';
  
  // Destroy subject for cleanup
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private donationService: DonationService,
    private authService: AuthService
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
    
    // Establecer la primera imagen como seleccionada
    const firstImage = this.getImages()[0];
    if (firstImage) {
      this.selectedImage = firstImage.url;
    }
    
    this.loading = false;
  }

  /**
   * Handle error
   */
  private handleError(message: string): void {
    this.errorMessage = message;
    this.loading = false;
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

  // ===== File Getters =====

  getImages(): Array<{ url: string; name: string }> {
    return this.donation?.files?.filter(f => f.type === 'image').map(f => ({
      url: f.url,
      name: f.name
    })) || [];
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

  onEdit(): void {
    if (this.donation?.id) {
      this.router.navigate(['/donations/manage', this.donation.id, 'edit']);
    }
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

    const isLiked = this.donation.isLikedByCurrentUser || false;
    const previousState = {
      isLiked: this.donation.isLikedByCurrentUser || false,
      likesCount: this.donation.likesCount || 0
    };

    // Actualización optimista: actualizar inmediatamente en la UI
    if (isLiked) {
      // Quitar like
      this.donation.isLikedByCurrentUser = false;
      this.donation.likesCount = Math.max((this.donation.likesCount || 0) - 1, 0);
    } else {
      // Agregar like
      this.donation.isLikedByCurrentUser = true;
      this.donation.likesCount = (this.donation.likesCount || 0) + 1;
    }

    // Llamar al servicio para sincronizar con el backend
    this.donationService.toggleLike(this.donation.id, isLiked)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedDonation) => {
          // Sincronizar con la respuesta del servidor preservando datos existentes
          if (updatedDonation && this.donation) {
            // Solo actualizar campos relacionados con likes, preservar el resto
            this.donation.likes = updatedDonation.likes || this.donation.likes;
            this.donation.likesCount = updatedDonation.likesCount ?? this.donation.likesCount ?? 0;
            this.donation.isLikedByCurrentUser = updatedDonation.isLikedByCurrentUser ?? this.donation.isLikedByCurrentUser ?? false;
            this.donation.updatedAt = updatedDonation.updatedAt || this.donation.updatedAt;
          } else if (updatedDonation) {
            this.donation = updatedDonation;
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

          // Si es error 400, mostrar mensaje más específico
          if (error.status === 400) {
            const errorMessage = error.error?.message || 'El backend rechazó la petición';
            console.warn('⚠️ Error 400 - Posibles causas:', errorMessage);
            
            // Si el mensaje indica que ya existe el like, sincronizar el estado
            if (errorMessage.toLowerCase().includes('ya le ha dado like') ||
                errorMessage.toLowerCase().includes('already') || 
                errorMessage.toLowerCase().includes('ya existe') ||
                errorMessage.toLowerCase().includes('duplicate')) {
              console.warn('⚠️ El like ya existe. Sincronizando estado con el backend...');
              if (this.donation) {
                // Recargar los datos del servidor para sincronizar correctamente
                this.donationService.getDonationById(this.donation.id)
                  .pipe(takeUntil(this.destroy$))
                  .subscribe(updatedDonation => {
                    if (this.donation) {
                      // Preservar datos existentes y solo actualizar likes
                      this.donation.likes = updatedDonation.likes || this.donation.likes;
                      this.donation.likesCount = updatedDonation.likesCount ?? this.donation.likesCount ?? 0;
                      this.donation.isLikedByCurrentUser = updatedDonation.isLikedByCurrentUser ?? this.donation.isLikedByCurrentUser ?? false;
                      this.donation.updatedAt = updatedDonation.updatedAt || this.donation.updatedAt;
                    } else {
                      this.donation = updatedDonation;
                    }
                    console.log('✅ Estado sincronizado correctamente preservando datos');
                  });
              }
              return; // No revertir en este caso
            }
          }

          // Revertir la actualización optimista en caso de error
          if (this.donation) {
            this.donation.isLikedByCurrentUser = previousState.isLiked;
            this.donation.likesCount = previousState.likesCount;
          }
        }
      });
  }
}

