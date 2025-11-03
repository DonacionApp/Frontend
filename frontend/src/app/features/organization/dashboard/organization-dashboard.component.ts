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
   * Limpiar mensaje de error
   */
  clearError(): void {
    this.errorMessage = '';
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
  getStatusBadge(statusDonation: string | number | null | undefined): { text: string; class: string } {
    // Si es null, undefined o 0
    if (!statusDonation) {
      return { text: 'Disponible', class: 'bg-green-100 text-green-800' };
    }
    
    // Si es un número, convertir a texto
    if (typeof statusDonation === 'number') {
      switch (statusDonation) {
        case 1:
          return { text: 'Pendiente', class: 'bg-yellow-100 text-yellow-800' };
        case 2:
          return { text: 'Aceptada', class: 'bg-green-100 text-green-800' };
        case 3:
          return { text: 'Rechazada', class: 'bg-red-100 text-red-800' };
        default:
          return { text: `Estado ${statusDonation}`, class: 'bg-gray-100 text-gray-800' };
      }
    }
    
    // Aquí TypeScript ya sabe que es string (no puede ser number porque se manejó arriba)
    // Pero para estar seguros, convertimos a string
    const statusStr = String(statusDonation);
    const status = statusStr.toLowerCase();
    
    switch (status) {
      case 'disponible':
      case 'pendiente':
        return { text: 'Disponible', class: 'bg-green-100 text-green-800' };
      case 'recogida':
      case 'en-progreso':
        return { text: 'Recogida', class: 'bg-blue-100 text-blue-800' };
      case 'completada':
        return { text: 'Completada', class: 'bg-gray-100 text-gray-800' };
      default:
        return { text: statusStr, class: 'bg-gray-100 text-gray-800' };
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
}
