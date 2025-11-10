import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BehaviorSubject, Subject, takeUntil } from 'rxjs';
import { DonationService, OrganizationStats, Donation, DonationArticle } from '../../../core/services/donation.service';
import { AuthService, User } from '../../../core/services/auth.service';

type TabType = 'resumen' | 'mis-donaciones' | 'solicitudes';

@Component({
  selector: 'app-organization-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  filteredDonations: Donation[] = [];
  recentDonations: Donation[] = [];
  loading = true;
  loadingDonations = false;
  errorMessage = '';

  // Filtros (cliente)
  filters: {
    search: string;
    status: string; // usa el texto normalizado de getStatusBadge (e.g., 'Pendiente', 'Entregada') o 'all'
    location: string; // lugar de recogida o donación
    article: string; // nombre de artículo
    dateFrom: string | null; // 'YYYY-MM-DD'
    dateTo: string | null;   // 'YYYY-MM-DD'
  } = {
    search: '',
    status: 'all',
    location: 'all',
    article: 'all',
    dateFrom: null,
    dateTo: null,
  };

  // Opciones derivadas
  statusOptions: string[] = [];
  locationOptions: string[] = [];
  articleOptions: string[] = [];

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
          // Construir opciones y aplicar filtros
          this.buildFilterOptions();
          this.applyFilters();
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
  viewDonation(donationId: number): void {
    this.router.navigate(['/organization/donations', donationId]);
  }

  /**
   * Limpiar mensaje de error
   */
  clearError(): void {
    this.errorMessage = '';
  }

  /**
   * Construir opciones de filtros a partir de las donaciones cargadas
   */
  private buildFilterOptions(): void {
    const statusSet = new Set<string>();
    const locationSet = new Set<string>();
    const articleSet = new Set<string>();

    for (const d of this.donations) {
      // Status normalizado a como se muestra en badge
      const badge = this.getStatusBadge(d.statusDonation);
      if (badge?.text) statusSet.add(badge.text);

      // Lugares
      if (d.lugarRecogida) locationSet.add(d.lugarRecogida.trim());
      if ((d as any).lugarDonacion) {
        const ld = (d as any).lugarDonacion;
        if (ld) locationSet.add(String(ld).trim());
      }

      // Artículos
      if (d.articles && d.articles.length > 0) {
        for (const a of d.articles) {
          if (a?.article?.name) articleSet.add(a.article.name.trim());
        }
      }
    }

    this.statusOptions = Array.from(statusSet).sort();
    this.locationOptions = Array.from(locationSet).sort();
    this.articleOptions = Array.from(articleSet).sort();
  }

  /**
   * Aplicar filtros en cliente
   */
  applyFilters(): void {
    const search = this.filters.search.trim().toLowerCase();
    const statusSel = this.filters.status;
    const locSel = this.filters.location;
    const artSel = this.filters.article;
    const from = this.filters.dateFrom ? new Date(this.filters.dateFrom + 'T00:00:00') : null;
    const to = this.filters.dateTo ? new Date(this.filters.dateTo + 'T23:59:59') : null;

    this.filteredDonations = this.donations.filter(d => {
      // Status
      if (statusSel !== 'all') {
        const badge = this.getStatusBadge(d.statusDonation);
        if (badge.text !== statusSel) return false;
      }

      // Location
      if (locSel !== 'all') {
        const lr = (d.lugarRecogida || '').toString().trim();
        const ld = ((d as any).lugarDonacion || '').toString().trim();
        if (lr !== locSel && ld !== locSel) return false;
      }

      // Article name
      if (artSel !== 'all') {
        const names = (d.articles || []).map(a => a?.article?.name?.trim()).filter(Boolean);
        if (!names.includes(artSel)) return false;
      }

      // Date range (createdAt)
      if (from || to) {
        const created = new Date(d.createdAt);
        if (from && created < from) return false;
        if (to && created > to) return false;
      }

      // Search across title, locations, articles
      if (search) {
        const title = (d.post?.title || '').toString().toLowerCase();
        const lr = (d.lugarRecogida || '').toString().toLowerCase();
        const ld = ((d as any).lugarDonacion || '').toString().toLowerCase();
        const arts = (d.articles || []).map(a => a?.article?.name?.toLowerCase()).filter(Boolean).join(' ');
        const creator = (d.user?.username || '').toLowerCase();
        const beneficiary = (d.beneficiary?.username || '').toLowerCase();
        const donator = (d.donator?.username || '').toLowerCase();
        const haystack = `${title} ${lr} ${ld} ${arts} ${creator} ${beneficiary} ${donator}`;
        if (!haystack.includes(search)) return false;
      }

      return true;
    });
  }

  /**
   * Limpiar filtros
   */
  clearFilters(): void {
    this.filters = {
      search: '',
      status: 'all',
      location: 'all',
      article: 'all',
      dateFrom: null,
      dateTo: null,
    };
    this.applyFilters();
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
  getStatusBadge(statusDonation: any): { text: string; class: string } {
    // Si es null o undefined
    if (!statusDonation) {
      return { text: 'Disponible', class: 'bg-green-100 text-green-800' };
    }
    
    // Si es un objeto con propiedad status (respuesta del backend)
    if (typeof statusDonation === 'object' && statusDonation.status) {
      const status = statusDonation.status.toLowerCase();
      switch (status) {
        case 'pendiente':
          return { text: 'Pendiente', class: 'bg-yellow-100 text-yellow-800' };
        case 'aceptada':
          return { text: 'Aceptada', class: 'bg-green-100 text-green-800' };
        case 'rechazada':
          return { text: 'Rechazada', class: 'bg-red-100 text-red-800' };
        case 'entregada':
          return { text: 'Entregada', class: 'bg-blue-100 text-blue-800' };
        default:
          return { text: statusDonation.status, class: 'bg-gray-100 text-gray-800' };
      }
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
        case 4:
          return { text: 'Entregada', class: 'bg-blue-100 text-blue-800' };
        default:
          return { text: `Estado ${statusDonation}`, class: 'bg-gray-100 text-gray-800' };
      }
    }
    
    // Si es string
    const statusStr = String(statusDonation);
    const status = statusStr.toLowerCase();
    
    switch (status) {
      case 'pendiente':
        return { text: 'Pendiente', class: 'bg-yellow-100 text-yellow-800' };
      case 'aceptada':
      case 'disponible':
        return { text: 'Disponible', class: 'bg-green-100 text-green-800' };
      case 'rechazada':
        return { text: 'Rechazada', class: 'bg-red-100 text-red-800' };
      case 'entregada':
      case 'completada':
        return { text: 'Entregada', class: 'bg-blue-100 text-blue-800' };
      default:
        return { text: statusStr, class: 'bg-gray-100 text-gray-800' };
    }
  }

  /**
   * Obtener resumen de artículos
   */
  getArticlesSummary(articles: DonationArticle[]): string {
    if (!articles || articles.length === 0) {
      return 'Sin artículos';
    }
    
    const totalItems = articles.reduce((sum, article) => sum + parseInt(article.quantity), 0);
    const articleNames = articles.slice(0, 2).map(a => a.article.name).join(', ');
    
    if (articles.length > 2) {
      return `${articleNames} y ${articles.length - 2} más (${totalItems} artículos)`;
    }
    
    return `${articleNames} (${totalItems} artículos)`;
  }
}
