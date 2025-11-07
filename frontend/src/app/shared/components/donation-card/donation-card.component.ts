import { Component, Input, Output, EventEmitter, Inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Donation, DonationService } from '../../../core/services/post.service';
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
  @Input() showDelete: boolean = false;
  
  @Output() likeToggled = new EventEmitter<{ donationId: string; isLiked: boolean }>();
  @Output() donationClicked = new EventEmitter<string>();
  @Output() donateClicked = new EventEmitter<string>();
  @Output() userClicked = new EventEmitter<string>();
  @Output() deleteClicked = new EventEmitter<string>();
  @Output() editClicked = new EventEmitter<string>();

  showLikesModal = false;
  isLikeLoading = false;
  duplicateLikeMessage: string | null = null;

  private readonly tagColorClasses: string[] = [
    'bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border border-emerald-100',
    'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-100',
    'bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 border border-purple-100',
    'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border border-amber-100',
    'bg-gradient-to-r from-rose-50 to-red-50 text-rose-700 border border-rose-100',
    'bg-gradient-to-r from-lime-50 to-green-50 text-lime-700 border border-lime-100',
    'bg-gradient-to-r from-sky-50 to-cyan-50 text-sky-700 border border-sky-100',
    'bg-gradient-to-r from-violet-50 to-purple-50 text-violet-700 border border-violet-100'
  ];

  private readonly tagEmojis: string[] = ['🏷️', '💡', '🎯', '🌟', '🚀', '✨', '🎁', '📌'];

  constructor(
    @Inject(DonationService) private donationService: DonationService,
    private router: Router
  ) {}

  get isLikeInProgress(): boolean {
    return this.donationService.isLikeInProgress(this.donation.id);
  }

  get isOwner(): boolean {
    const current = this.currentUserId != null ? String(this.currentUserId) : '';
    const ownerA = this.donation.userId != null ? String(this.donation.userId) : '';
    const ownerB = this.donation.user?.id != null ? String(this.donation.user.id) : '';
    return current !== '' && (current === ownerA || current === ownerB);
  }

  get isDonor(): boolean {
    return this.currentUserRole === 'donor';
  }

  get canDonate(): boolean {
    // Solo donadores pueden donar, y no pueden donar a sus propias publicaciones
    return this.isDonor && !this.isOwner;
  }

  get canDelete(): boolean {
    // Permitir forzar visibilidad desde el padre
    if (this.showDelete) return true;
    // Solo organizaciones y sobre sus propias publicaciones
    return this.currentUserRole === 'organization' && this.isOwner;
  }

  get canEdit(): boolean {
    // Solo organizaciones pueden editar sus propias publicaciones
    return this.currentUserRole === 'organization' && this.isOwner;
  }

  get isOrganization(): boolean {
    return this.currentUserRole === 'organization';
  }

  get profilePhotoUrl(): string {
    // PRIORIDAD 1: Usar profilePhoto si existe
    if (this.donation.user?.profilePhoto) {
      return this.donation.user.profilePhoto;
    }

    // PRIORIDAD 2: Intentar obtener de alternativas
    const anyUser: any = this.donation.user;
    if (anyUser) {
      // Buscar en múltiples posibles nombres de campo
      const candidates = [
        anyUser.photo,
        anyUser.avatar,
        anyUser.fotoPerfil,
        anyUser.profile_photo,
        anyUser.profile_picture,
        anyUser.picture,
        anyUser.image,
        anyUser.profilePicture
      ];

      for (const candidate of candidates) {
        if (candidate && typeof candidate === 'string' && candidate.trim()) {
          return candidate;
        }
      }
    }

    // FALLBACK: Avatar por defecto
    return this.getDefaultAvatar();
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

  get tags(): Array<{ id: number; tag?: string; name?: string }> {
    const tags = this.donation?.tags || [];
    return tags;
  }

  getTagBadgeClass(index: number): string {
    return this.tagColorClasses[index % this.tagColorClasses.length];
  }

  getTagEmoji(index: number): string {
    return this.tagEmojis[index % this.tagEmojis.length];
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
    const donationAny: any = this.donation;
    
    const extractRawUrl = (value: any): string | null => {
      if (!value) return null;

      if (typeof value === 'string') {
        return value;
      }

      if (typeof value === 'object') {
        const candidates = [
          value.url,
          value.path,
          value.ruta,
          value.imageUrl,
          value.location,
          value.fileUrl,
          value.src,
          value.image
        ];

        for (const candidate of candidates) {
          if (!candidate) continue;
          if (typeof candidate === 'string') {
            return candidate;
          }

          // Algunos backends anidan información de imagen en otro objeto
          if (typeof candidate === 'object') {
            const nested = extractRawUrl(candidate);
            if (nested) return nested;
          }
        }
      }

      return null;
    };

    // Función auxiliar para normalizar y validar URL
    const normalizeAndValidate = (rawValue: any): string | null => {
      const rawUrl = extractRawUrl(rawValue);
      if (!rawUrl || typeof rawUrl !== 'string') return null;
      
      const trimmed = rawUrl.trim();
      if (!trimmed) return null;
      
      // Si ya es una URL completa, validarla
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
      }
      
      // Si es data URI, retornarla
      if (trimmed.startsWith('data:')) {
        return trimmed;
      }
      
      // Normalizar URL relativa
      const url = this.normalizeUrl(trimmed);
      return url && url.trim() !== '' ? url : null;
    };
    
    // ESTRATEGIA 1: Buscar en files (archivos mapeados por el servicio) - PRIORIDAD MÁXIMA
    if (this.donation.files && Array.isArray(this.donation.files) && this.donation.files.length > 0) {
      for (const file of this.donation.files) {
        if (file && file.type === 'image') {
          const url = normalizeAndValidate(file);
          if (url) {
            return url;
          }
        }
      }
    }
    
    // ESTRATEGIA 2: Buscar en imageUrl directo
    const imageUrl = normalizeAndValidate(this.donation.imageUrl);
    if (imageUrl) {
      return imageUrl;
    }
    
    // ESTRATEGIA 3: Buscar en el array images
    if (this.donation.images && Array.isArray(this.donation.images) && this.donation.images.length > 0) {
      for (const img of this.donation.images) {
        const url = normalizeAndValidate(img);
        if (url) {
          return url;
        }
      }
    }
    
    // ESTRATEGIA 4: Buscar en imagePost (estructura anidada del backend) - CRÍTICO
    if (donationAny.imagePost && Array.isArray(donationAny.imagePost) && donationAny.imagePost.length > 0) {
      for (const imgPost of donationAny.imagePost) {
        const url = normalizeAndValidate(imgPost);
        if (url) {
          return url;
        }
      }
    }
    
    // ESTRATEGIA 5: Buscar en el campo 'image' del nivel superior (estructura anidada)
    const topLevelImage = normalizeAndValidate(donationAny.image);
    if (topLevelImage) {
      return topLevelImage;
    }
    
    // ESTRATEGIA 6: Buscar en post.image (si hay estructura anidada post.post)
    if (donationAny.post && donationAny.post.image) {
      const postImage = normalizeAndValidate(donationAny.post.image);
      if (postImage) {
        return postImage;
      }
    }
    
    // ESTRATEGIA 7: Buscar recursivamente en todas las propiedades (último recurso)
    const searchInObject = (obj: any, depth: number = 0, visited: Set<any> = new Set()): string | null => {
      if (depth > 4 || !obj || typeof obj !== 'object') return null;
      
      // Evitar ciclos infinitos
      if (visited.has(obj)) return null;
      visited.add(obj);
      
      for (const key in obj) {
        if (!obj.hasOwnProperty(key)) continue;
        
        const value = obj[key];
        
        // Ignorar funciones y valores nulos
        if (typeof value === 'function' || value === null || value === undefined) continue;
        
        // Si es un string que parece URL de imagen
        if (typeof value === 'string' && value.trim()) {
          const trimmed = value.trim();
          // Buscar patrones de URL de imagen
          if (trimmed.startsWith('http') || 
              trimmed.startsWith('/') || 
              trimmed.startsWith('data:') ||
              /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(trimmed) ||
              /image/i.test(key)) {
            const url = normalizeAndValidate(trimmed);
            if (url) {
              return url;
            }
          }
        }
        
        // Si es un objeto, buscar recursivamente
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const found = searchInObject(value, depth + 1, visited);
          if (found) return found;
        }
        
        // Si es un array, buscar en cada elemento
        if (Array.isArray(value) && value.length > 0) {
          for (const item of value) {
            if (typeof item === 'string') {
              const url = normalizeAndValidate(item);
              if (url) {
                return url;
              }
            } else if (item && typeof item === 'object') {
              const found = searchInObject(item, depth + 1, visited);
              if (found) return found;
            }
          }
        }
      }
      
      return null;
    };
    
    const found = searchInObject(donationAny);
    if (found) return found;
    
    return null;
  }

  get imageThumbs(): string[] {
    const images: string[] = [];
    
    // De files
    const filesImages = (this.donation.files || [])
      .filter(f => f.type === 'image')
      .map(f => this.normalizeUrl(f.url));
    images.push(...filesImages);
    
    // De imageUrl
    if (this.donation.imageUrl && !images.includes(this.donation.imageUrl)) {
      images.push(this.normalizeUrl(this.donation.imageUrl));
    }
    
    // De images array
    if (this.donation.images && Array.isArray(this.donation.images)) {
      this.donation.images.forEach((img: string | any) => {
        const raw = typeof img === 'string' 
          ? img 
          : (img && (img.url || img.path || img.imageUrl || img.location || img.fileUrl));
        const url = raw ? this.normalizeUrl(raw) : '';
        if (url && !images.includes(url)) {
          images.push(url);
        }
      });
    }
    
    return images.slice(0, 3);
  }

  get totalImages(): number {
    let count = 0;
    
    // Contar en files
    count += (this.donation.files || []).filter(f => f.type === 'image').length;
    
    // Contar imageUrl si no está en files
    if (this.donation.imageUrl) {
      const inFiles = (this.donation.files || []).some(f => f.type === 'image' && f.url === this.donation.imageUrl);
      if (!inFiles) count++;
    }
    
    // Contar en images array
    if (this.donation.images && Array.isArray(this.donation.images)) {
      this.donation.images.forEach((img: string | any) => {
        const url = typeof img === 'string' 
          ? img 
          : (img && (img.url || img.path || img.imageUrl || img.location || img.fileUrl));
        if (url) {
          const inFiles = (this.donation.files || []).some(f => f.type === 'image' && f.url === url);
          if (!inFiles && url !== this.donation.imageUrl) count++;
        }
      });
    }
    
    return count;
  }

  private normalizeUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const base = environment.apiBackendUrl.replace(/\/$/, '');
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${base}${path}`;
  }

  onLikeToggle(): void {
    if (!this.showActions || this.isLikeInProgress) return;

    // Solo emitir el evento
    this.likeToggled.emit({
      donationId: this.donation.id,
      isLiked: this.donation.isLikedByCurrentUser || false
    });
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

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    // Intentar con una imagen placeholder
    img.src = 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
        <rect width="400" height="300" fill="#f3f4f6"/>
        <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="16" fill="#9ca3af">
          Imagen no disponible
        </text>
      </svg>
    `);
  }

  onImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'block';
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

  onDeleteClick(event: Event): void {
    event.stopPropagation();
    if (!this.showActions || !this.canDelete) return;
    this.deleteClicked.emit(this.donation.id);
  }

  onEditClick(event: Event): void {
    event.stopPropagation();
    if (!this.showActions || !this.canEdit) return;
    this.editClicked.emit(this.donation.id);
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

