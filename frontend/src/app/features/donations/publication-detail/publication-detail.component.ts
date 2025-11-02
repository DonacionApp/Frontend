import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { DonationService, Donation, DonationFile } from '../../../core/services/donation.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-publication-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './publication-detail.component.html',
  styleUrls: ['./publication-detail.component.scss']
})
export class PublicationDetailComponent implements OnInit, OnDestroy {
  donation: Donation | null = null;
  loading = false;
  errorMessage = '';
  currentUserId: string | null = null;
  selectedImage: string | null = null;
  
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private donationService: DonationService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Obtener usuario actual
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.currentUserId = user?.id || null;
    });

    // Obtener ID de la donación desde la URL
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadDonation(id);
    } else {
      this.errorMessage = 'ID de donación no válido';
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDonation(id: string): void {
    this.loading = true;
    this.errorMessage = '';

    this.donationService.getDonationById(id).subscribe({
      next: (donation) => {
        this.donation = donation;
        this.loading = false;
        
        // Establecer la primera imagen como seleccionada
        const firstImage = this.getImages()[0];
        if (firstImage) {
          this.selectedImage = firstImage.url;
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('Error al cargar donación:', error);
        
        if (error.status === 404) {
          this.errorMessage = 'Donación no encontrada';
        } else {
          this.errorMessage = 'Error al cargar la donación. Por favor intenta nuevamente.';
        }
      }
    });
  }

  get isOwner(): boolean {
    return this.currentUserId === this.donation?.userId;
  }

  get profilePhotoUrl(): string {
    return this.donation?.user?.profilePhoto || 'assets/default-avatar.svg';
  }

  get username(): string {
    return this.donation?.user?.username || 'Usuario';
  }

  get daysRemaining(): number {
    if (!this.donation?.fechaMaximaEntrega) return 0;
    const today = new Date();
    const maxDate = new Date(this.donation.fechaMaximaEntrega);
    const diff = maxDate.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  get urgencyClass(): string {
    const days = this.daysRemaining;
    if (days < 0) return 'text-red-700 bg-red-100';
    if (days <= 3) return 'text-orange-700 bg-orange-100';
    if (days <= 7) return 'text-yellow-700 bg-yellow-100';
    return 'text-green-700 bg-green-100';
  }

  getImages(): DonationFile[] {
    return this.donation?.files?.filter(f => f.type === 'image') || [];
  }

  getVideos(): DonationFile[] {
    return this.donation?.files?.filter(f => f.type === 'video') || [];
  }

  getPdfs(): DonationFile[] {
    return this.donation?.files?.filter(f => f.type === 'pdf') || [];
  }

  onImageSelect(imageUrl: string): void {
    this.selectedImage = imageUrl;
  }

  onLikeToggle(): void {
    if (!this.currentUserId) {
      this.router.navigate(['/auth/login'], { 
        queryParams: { returnUrl: this.router.url } 
      });
      return;
    }

    if (!this.donation) return;

    const isLiked = this.donation.isLikedByCurrentUser || false;
    
    this.donationService.toggleLike(this.donation.id, isLiked).subscribe({
      next: (updatedDonation) => {
        this.donation = updatedDonation;
      },
      error: (error) => {
        console.error('Error al actualizar like:', error);
      }
    });
  }

  onBack(): void {
    this.router.navigate(['/donations/feed']);
  }

  onEdit(): void {
    if (this.donation && this.isOwner) {
      this.router.navigate(['/organization/donations', this.donation.id, 'edit']);
    }
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'No especificado';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  formatTimeAgo(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} minutos`;
    if (diffHours < 24) return `Hace ${diffHours} horas`;
    if (diffDays < 30) return `Hace ${diffDays} días`;
    return this.formatDate(dateString);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
}

