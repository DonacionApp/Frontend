import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { DonationService, Donation } from '../../../core/services/donation.service';
import { AuthService } from '../../../core/services/auth.service';
import { DonationCardComponent } from '../../../shared/components/donation-card/donation-card.component';

@Component({
  selector: 'app-publications-feed',
  standalone: true,
  imports: [CommonModule, DonationCardComponent],
  templateUrl: './publications-feed.component.html',
  styleUrls: ['./publications-feed.component.scss']
})
export class PublicationsFeedComponent implements OnInit, OnDestroy {
  donations: Donation[] = [];
  loading = false;
  errorMessage = '';
  currentUserId: string | null = null;
  currentUserRole: string | null = null;
  
  private destroy$ = new Subject<void>();

  constructor(
    private donationService: DonationService,
    private authService: AuthService,
    private router: Router
  ) {}

  // Getters para estadísticas
  get totalLikes(): number {
    return this.donations.reduce((total, donation) => total + (donation.likesCount || 0), 0);
  }

  get activeCount(): number {
    const today = new Date();
    return this.donations.filter(donation => {
      if (!donation.fechaMaximaEntrega) return false;
      const maxDate = new Date(donation.fechaMaximaEntrega);
      return maxDate >= today;
    }).length;
  }

  ngOnInit(): void {
    // Obtener usuario actual
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.currentUserId = user?.id || null;
      this.currentUserRole = user?.role || null;
      console.log('👤 Usuario actual:', { id: this.currentUserId, role: this.currentUserRole });
    });

    // Cargar publicaciones
    this.loadPublications();
  }

  // Getter para verificar si el usuario es organización
  get isOrganization(): boolean {
    return this.currentUserRole === 'organization';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPublications(): void {
    this.loading = true;
    this.errorMessage = '';

    this.donationService.getAllPublicDonations().subscribe({
      next: (donations) => {
        this.donations = donations;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        console.error('Error al cargar publicaciones:', error);
        this.errorMessage = 'Error al cargar las publicaciones. Por favor intenta nuevamente.';
        
        // 🎨 DEMO: Cargar datos de prueba para visualizar la UI
        this.loadMockData();
      }
    });
  }

  // Método temporal para demostración visual
  private loadMockData(): void {
    console.log('🎨 Cargando datos de demostración...');
    const today = new Date();
    
    this.donations = [
      {
        id: 'demo-1',
        userId: 'user-1',
        user: {
          id: 'user-1',
          username: 'Fundación Ayuda Verde',
          email: 'contacto@ayudaverde.org',
          verified: true,
          profilePhoto: 'https://ui-avatars.com/api/?name=Ayuda+Verde&background=10b981&color=fff&size=128',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        donationType: {
          id: 'type-1',
          name: 'Ropa y Calzado',
          description: 'Donaciones de vestimenta'
        },
        comunity: 'Centro de la Ciudad',
        lugarRecogida: 'Calle Principal 123',
        lugarDonacion: 'Refugio Esperanza',
        fechaMaximaEntrega: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Necesitamos urgentemente ropa de invierno para familias en situación vulnerable. Aceptamos abrigos, bufandas, gorros y calzado en buen estado.',
        articles: [
          { name: 'Abrigos', quantity: 20 },
          { name: 'Bufandas', quantity: 30 },
          { name: 'Zapatos', quantity: 15 },
          { name: 'Guantes', quantity: 25 }
        ],
        comments: [],
        files: [
          {
            id: 'file-1',
            name: 'imagen1.jpg',
            url: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=800',
            type: 'image' as const,
            size: 524288
          }
        ],
        likes: [],
        likesCount: 42,
        isLikedByCurrentUser: false,
        createdAt: new Date(today.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'demo-2',
        userId: 'user-2',
        user: {
          id: 'user-2',
          username: 'Comedor Solidario',
          email: 'info@comedorsolidario.org',
          verified: true,
          profilePhoto: 'https://ui-avatars.com/api/?name=Comedor+Solidario&background=3b82f6&color=fff&size=128',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        donationType: {
          id: 'type-2',
          name: 'Alimentos',
          description: 'Donaciones de comida'
        },
        comunity: 'Barrio Norte',
        lugarRecogida: 'Mercado Central',
        lugarDonacion: 'Comedor La Esperanza',
        fechaMaximaEntrega: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        description: '¡Ayúdanos a alimentar a más familias! Necesitamos alimentos no perecederos para nuestro comedor comunitario que atiende a 200 personas diarias.',
        articles: [
          { name: 'Arroz', quantity: 50 },
          { name: 'Fideos', quantity: 40 },
          { name: 'Aceite', quantity: 20 },
          { name: 'Conservas', quantity: 60 },
          { name: 'Legumbres', quantity: 30 }
        ],
        comments: [],
        files: [
          {
            id: 'file-2',
            name: 'comedor.jpg',
            url: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800',
            type: 'image' as const,
            size: 612352
          }
        ],
        likes: [],
        likesCount: 87,
        isLikedByCurrentUser: true,
        createdAt: new Date(today.getTime() - 5 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'demo-3',
        userId: 'user-3',
        user: {
          id: 'user-3',
          username: 'Biblioteca Comunitaria',
          email: 'biblioteca@comunidad.org',
          verified: false,
          profilePhoto: 'https://ui-avatars.com/api/?name=Biblioteca&background=8b5cf6&color=fff&size=128',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        donationType: {
          id: 'type-3',
          name: 'Libros y Material Educativo',
          description: 'Donaciones educativas'
        },
        comunity: 'Zona Sur',
        lugarRecogida: 'Biblioteca Municipal',
        lugarDonacion: 'Centro Cultural Barrio',
        fechaMaximaEntrega: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Estamos armando una biblioteca comunitaria gratuita. Necesitamos libros de todos los géneros, especialmente literatura infantil y juvenil.',
        articles: [
          { name: 'Libros infantiles', quantity: 100 },
          { name: 'Novelas', quantity: 80 },
          { name: 'Libros de texto', quantity: 50 }
        ],
        comments: [],
        files: [
          {
            id: 'file-3',
            name: 'biblioteca.jpg',
            url: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800',
            type: 'image' as const,
            size: 458752
          }
        ],
        likes: [],
        likesCount: 23,
        isLikedByCurrentUser: false,
        createdAt: new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    
    console.log('✅ Datos de demostración cargados:', this.donations.length, 'publicaciones');
  }

  onLikeToggled(event: { donationId: string; isLiked: boolean }): void {
    if (!this.currentUserId) {
      // Redirigir a login si no está autenticado
      this.router.navigate(['/auth/login'], { 
        queryParams: { returnUrl: '/donations/feed' } 
      });
      return;
    }

    this.donationService.toggleLike(event.donationId, event.isLiked).subscribe({
      next: (updatedDonation) => {
        // Actualizar la donación en la lista local
        const index = this.donations.findIndex(d => d.id === event.donationId);
        if (index !== -1) {
          this.donations[index] = updatedDonation;
        }
      },
      error: (error) => {
        console.error('Error al actualizar like:', error);
      }
    });
  }

  onDonationClicked(donationId: string): void {
    this.router.navigate(['/donations', donationId]);
  }

  onCreateNewDonation(): void {
    if (!this.currentUserId) {
      this.router.navigate(['/auth/login'], { 
        queryParams: { returnUrl: '/organization/donations/create' } 
      });
      return;
    }

    this.router.navigate(['/organization/donations/create']);
  }

  onRefresh(): void {
    this.loadPublications();
  }

  trackByDonationId(index: number, donation: Donation): string {
    return donation.id;
  }
}

