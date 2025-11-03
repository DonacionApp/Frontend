import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Donation, DonationService } from '../../../core/services/donation.service';
import { LikesModalComponent } from '../likes-modal/likes-modal.component';

@Component({
  selector: 'app-donation-card',
  standalone: true,
  imports: [CommonModule, RouterModule, LikesModalComponent],
  templateUrl: './donation-card.component.html',
  styleUrls: ['./donation-card.component.scss']
})
export class DonationCardComponent {
  @Input() donation!: Donation;
  @Input() showActions: boolean = true;
  @Input() currentUserId: string | null = null;
  @Input() currentUserRole: string | null = null;
  
  @Output() likeToggled = new EventEmitter<{ donationId: string; isLiked: boolean }>();
  @Output() donationClicked = new EventEmitter<string>();
  @Output() donateClicked = new EventEmitter<string>();
  @Output() userClicked = new EventEmitter<string>();

  showLikesModal = false;
  isLikeLoading = false;
  duplicateLikeMessage: string | null = null;

  constructor(
    private donationService: DonationService,
    private router: Router
  ) {}

  get isLikeInProgress(): boolean {
    return this.donationService.isLikeInProgress(this.donation.id);
  }

  get isOwner(): boolean {
    return this.currentUserId === this.donation.userId;
  }

  get isDonor(): boolean {
    return this.currentUserRole === 'donor';
  }

  get canDonate(): boolean {
    // Solo donadores pueden donar, y no pueden donar a sus propias publicaciones
    return this.isDonor && !this.isOwner;
  }

  get profilePhotoUrl(): string {
    return this.donation.user?.profilePhoto || this.getDefaultAvatar();
  }

  getDefaultAvatar(): string {
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
    return this.donation.user?.username || 'Usuario';
  }

  get daysRemaining(): number {
    if (!this.donation.fechaMaximaEntrega) return 0;
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

  get firstImage(): string | null {
    const imageFile = this.donation.files?.find(f => f.type === 'image');
    return imageFile?.url || null;
  }

  onLikeToggle(): void {
    if (!this.showActions || this.isLikeInProgress) return;
    
    // Prevenir like duplicado: si ya le dio like, mostrar mensaje y no hacer nada
    if (this.donation.isLikedByCurrentUser) {
      this.showDuplicateLikeMessage();
      return;
    }
    
    this.isLikeLoading = true;
    this.duplicateLikeMessage = null; // Limpiar mensaje anterior
    const donationId = this.donation.id;
    this.likeToggled.emit({
      donationId: donationId,
      isLiked: this.donation.isLikedByCurrentUser || false
    });
    
    // Verificar periódicamente si el proceso terminó
    const checkInterval = setInterval(() => {
      if (!this.donationService.isLikeInProgress(donationId)) {
        this.isLikeLoading = false;
        clearInterval(checkInterval);
      }
    }, 100);
    
    // Timeout de seguridad (máximo 5 segundos)
    setTimeout(() => {
      clearInterval(checkInterval);
      this.isLikeLoading = false;
    }, 5000);
  }

  showDuplicateLikeMessage(): void {
    this.duplicateLikeMessage = 'Ya has dado like a esta publicación';
    // Auto-ocultar después de 3 segundos
    setTimeout(() => {
      this.duplicateLikeMessage = null;
    }, 3000);
  }

  onLikesCountClick(event: Event): void {
    event.stopPropagation(); // Evitar que se active el click de la tarjeta
    if ((this.donation.likesCount || 0) > 0) {
      this.showLikesModal = true;
    }
  }

  onCardClick(): void {
    this.donationClicked.emit(this.donation.id);
  }

  onUserClick(event: Event): void {
    event.stopPropagation(); // Evitar que se active el click de la tarjeta
    if (this.donation.userId) {
      // Navegar a las publicaciones del usuario usando query params para ocultar el userId
      this.router.navigate(['/donations/user/publications'], {
        queryParams: { userId: this.donation.userId }
      });
    }
  }

  onDonateClick(event: Event): void {
    event.stopPropagation(); // Evitar que se active el click de la tarjeta
    if (!this.showActions || !this.canDonate) return;
    this.donateClicked.emit(this.donation.id);
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'No especificado';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
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

  getFileIcon(type: string): string {
    switch (type) {
      case 'image': return '🖼️';
      case 'video': return '🎥';
      case 'pdf': return '📄';
      default: return '📎';
    }
  }
}

