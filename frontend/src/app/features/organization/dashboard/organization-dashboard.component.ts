import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BehaviorSubject, Subject, takeUntil } from 'rxjs';
import { DonationService, OrganizationStats, Donation, Article } from '../../../core/services/donation.service';
import { AuthService, User } from '../../../core/services/auth.service';

type TabType = 'resumen' | 'mis-donaciones' | 'solicitudes';

@Component({
  selector: 'app-organization-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './organization-dashboard.component.html',
  styleUrls: ['./organization-dashboard.component.scss']
})
export class OrganizationDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Estado de pestañas con BehaviorSubject
  private activeTabSubject = new BehaviorSubject<TabType>('resumen');
  public activeTab$ = this.activeTabSubject.asObservable();
  
  currentUser: User | null = null;
  stats: OrganizationStats | null = null;
  donations: Donation[] = [];
  recentDonations: Donation[] = [];
  loading = true;
  loadingDonations = false;
  errorMessage = '';

  constructor(
    private router: Router,
    private donationService: DonationService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
      });

    // Cargar datos iniciales
    this.loadStats();
    this.loadRecentDonations();

    // Suscribirse a cambios de pestaña
    this.activeTab$.pipe(takeUntil(this.destroy$)).subscribe(tab => {
      if (tab === 'mis-donaciones' && this.donations.length === 0) {
        this.loadAllDonations();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Cargar estadísticas de la organización
   */
  loadStats(): void {
    this.loading = true;
    this.errorMessage = '';

    this.donationService.getOrganizationStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.stats = stats;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error al cargar estadísticas:', error);
          this.errorMessage = 'Error al cargar las estadísticas. Por favor, intenta de nuevo.';
          this.loading = false;
        }
      });
  }

  /**
   * Cargar donaciones recientes (últimas 3)
   */
  loadRecentDonations(): void {
    this.donationService.getMyDonations()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (donations) => {
          // Ordenar por fecha de creación (más recientes primero) y tomar las últimas 3
          this.recentDonations = donations
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 3);
        },
        error: (error) => {
          console.error('Error al cargar donaciones recientes:', error);
        }
      });
  }

  /**
   * Cargar todas las donaciones
   */
  loadAllDonations(): void {
    this.loadingDonations = true;
    this.donationService.getMyDonations()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (donations) => {
          this.donations = donations.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          this.loadingDonations = false;
        },
        error: (error) => {
          console.error('Error al cargar donaciones:', error);
          this.loadingDonations = false;
        }
      });
  }

  /**
   * Cambiar pestaña activa
   */
  setActiveTab(tab: TabType): void {
    this.activeTabSubject.next(tab);
  }

  /**
   * Obtener pestaña activa actual
   */
  get activeTab(): TabType {
    return this.activeTabSubject.value;
  }

  /**
   * Navegar a crear nueva donación
   */
  onCreateDonation(): void {
    this.router.navigate(['/organization/donations/create']);
  }

  /**
   * Navegar al detalle de una donación
   */
  viewDonation(donationId: string): void {
    this.router.navigate(['/organization/donations', donationId]);
  }

  /**
   * Obtener nombre de la organización
   */
  get organizationName(): string {
    return this.currentUser?.username || 'Organización';
  }

  /**
   * Formatear fecha
   */
  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Obtener badge de estado
   */
  getStatusBadge(statusDonation: string | null | undefined): { text: string; class: string } {
    if (!statusDonation) {
      return { text: 'Disponible', class: 'bg-green-100 text-green-800' };
    }
    
    const status = statusDonation.toLowerCase();
    switch (status) {
      case 'disponible':
        return { text: 'Disponible', class: 'bg-green-100 text-green-800' };
      case 'recogida':
      case 'en-progreso':
        return { text: 'Recogida', class: 'bg-blue-100 text-blue-800' };
      case 'completada':
        return { text: 'Completada', class: 'bg-gray-100 text-gray-800' };
      default:
        return { text: statusDonation, class: 'bg-gray-100 text-gray-800' };
    }
  }

  /**
   * Obtener resumen de artículos
   */
  getArticlesSummary(articles: Article[]): string {
    if (!articles || articles.length === 0) {
      return 'Sin artículos';
    }
    
    const totalItems = articles.reduce((sum, article) => sum + article.quantity, 0);
    const articleNames = articles.slice(0, 2).map(a => a.name).join(', ');
    
    if (articles.length > 2) {
      return `${articleNames} y ${articles.length - 2} más (${totalItems} artículos)`;
    }
    
    return `${articleNames} (${totalItems} artículos)`;
  }

  /**
   * Obtener imagen de la donación (placeholder por ahora)
   */
  getDonationImage(donation: Donation): string {
    // Por ahora retornamos una imagen placeholder basada en la categoría
    // En el futuro esto podría venir del backend
    const category = donation.articles && donation.articles.length > 0 
      ? donation.articles[0].name.toLowerCase() 
      : 'default';
    
    // Mapeo de categorías a imágenes placeholder
    if (category.includes('ropa') || category.includes('vestimenta')) {
      return 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=400&h=300&fit=crop';
    } else if (category.includes('alimento') || category.includes('comida')) {
      return 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=400&h=300&fit=crop';
    } else if (category.includes('juguete') || category.includes('juego')) {
      return 'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=400&h=300&fit=crop';
    } else if (category.includes('libro') || category.includes('educación')) {
      return 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=400&h=300&fit=crop';
    } else if (category.includes('mueble') || category.includes('hogar')) {
      return 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop';
    } else if (category.includes('electrónico') || category.includes('tecnología')) {
      return 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&h=300&fit=crop';
    }
    
    // Imagen por defecto
    return 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=400&h=300&fit=crop';
  }

  /**
   * Manejar error de carga de imagen
   */
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=400&h=300&fit=crop';
  }
}
