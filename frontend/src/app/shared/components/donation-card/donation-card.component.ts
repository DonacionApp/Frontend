import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Donation } from '../../../core/services/donation.service';

@Component({
  selector: 'app-donation-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './donation-card.component.html',
  styleUrls: ['./donation-card.component.scss']
})
export class DonationCardComponent {
  @Input() donation!: Donation;
  @Input() showActions: boolean = true;
  @Input() currentUserId: string | null = null;
  
  @Output() likeToggled = new EventEmitter<{ donationId: string; isLiked: boolean }>();
  @Output() donationClicked = new EventEmitter<string>();

  get isOwner(): boolean {
    return this.currentUserId === this.donation.userId;
  }

  get profilePhotoUrl(): string {
    return this.donation.user?.profilePhoto || 'assets/default-avatar.svg';
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
    if (!this.showActions) return;
    this.likeToggled.emit({
      donationId: this.donation.id,
      isLiked: this.donation.isLikedByCurrentUser || false
    });
  }

  onCardClick(): void {
    this.donationClicked.emit(this.donation.id);
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

