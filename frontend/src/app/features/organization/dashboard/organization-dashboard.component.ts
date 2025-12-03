import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { BehaviorSubject, Subject, takeUntil, forkJoin } from 'rxjs';
import { DonationService, OrganizationStats, Donation, DonationArticle, StatusDonation } from '../../../core/services/donation.service';
import { AuthService, User } from '../../../core/services/auth.service';
import { OrganizationProfileService, OrganizationProfile } from '../../../core/services/organization-profile.service';
import { ToastService } from '../../../core/services/toast.service';
import { PostsService, Post } from '../../../core/services/posts.service';

type TabType = 'resumen' | 'donaciones-disponibles' | 'mis-solicitudes' | 'mis-necesidades';

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
  organizationProfile: OrganizationProfile | null = null;
  stats: OrganizationStats | null = null;
  // Keep a copy of all loaded donations so we can derive tab-specific views
  allDonations: Donation[] = [];
  donations: Donation[] = [];
  filteredDonations: Donation[] = [];
  recentDonations: Donation[] = [];
  loading = true;
  loadingDonations = false;
  loadingSolicitudes = false;
  loadingAvailableDonations = false;
  loadingMyNeeds = false;
  errorMessage = '';

  // Solicitudes donde soy donador
  solicitudes: Donation[] = [];
  
  // Donaciones disponibles para solicitar (posts de tipo "articulos para donar")
  availableDonations: Post[] = [];
  filteredAvailableDonations: Post[] = [];
  
  // Mis necesidades publicadas (posts de tipo "solicitud de donacion")
  myNeeds: Post[] = [];
  filteredMyNeeds: Post[] = [];
  
  // Métricas calculadas
  sentRequestsCount = 0;
  receivedDonationsCount = 0;
  publishedNeedsCount = 0;
  messagesCount = 0;

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
  // Catálogo de estados (backend)
  statusCatalog: StatusDonation[] = [];
  // Mapa de carga al actualizar estado
  updatingStatus: Record<number, boolean> = {};

  // Paginación
  page = 1;
  pageSize = 9;
  totalPages = 1;
  pagedDonations: Donation[] = [];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private donationService: DonationService,
    private authService: AuthService,
    private organizationProfileService: OrganizationProfileService,
    private toast: ToastService,
    private postsService: PostsService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
        // If donations already loaded, re-apply tab filtering that may depend on currentUser
        this.applyTabFilteringIfNeeded();
      });

    // Suscribirse al perfil de organización (reactivo)
    this.organizationProfileService.profile$
      .pipe(takeUntil(this.destroy$))
      .subscribe(profile => {
        if (profile) {
          this.organizationProfile = profile;
        }
      });

    // Cargar perfil de la organización (esto actualizará el observable)
    this.loadOrganizationProfile();
    // Leer query param 'section' y actualizar pestaña activa
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const section = params['section'];
      // page may be present in query params; default to 1
      const pageParam = params['page'];
      const parsedPage = parseInt(pageParam, 10);
      this.page = !isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;

      let tab: TabType = 'resumen'; // default
      if (section === 'availableDonations') tab = 'donaciones-disponibles';
      else if (section === 'myRequests') tab = 'mis-solicitudes';
      else if (section === 'myNeeds') tab = 'mis-necesidades';
      else if (section === 'overview') tab = 'resumen';

      this.activeTabSubject.next(tab);
    });

    // Cargar datos iniciales
    this.loadStats();
    this.loadStatusCatalog();
    this.loadRecentDonations();
    this.loadAllDonations();
    this.loadMyNeeds(); // Cargar necesidades para calcular métricas
    // loadMetrics() se llama automáticamente después de cargar los datos en cada método

    // Suscribirse a cambios de pestaña
    this.activeTab$.pipe(takeUntil(this.destroy$)).subscribe(tab => {
      if (tab === 'donaciones-disponibles' && this.availableDonations.length === 0) {
        this.loadAvailableDonations();
      } else if (tab === 'mis-necesidades' && this.myNeeds.length === 0) {
        this.loadMyNeeds();
      } else if (tab === 'mis-solicitudes') {
        this.computeSolicitudes();
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
          // Actualizar métricas
          this.messagesCount = stats.unreadMessages || 0;
          this.loading = false;
          // Recalcular métricas después de cargar stats
          this.loadMetrics();
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
          // Keep a full copy and apply tab-specific filtering later
          this.allDonations = donations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          // Apply tab-specific selection (may depend on currentUser)
          this.applyTabFilteringIfNeeded();
          // Construir opciones y aplicar filtros sobre the currently selected this.donations
          this.buildFilterOptions();
          this.applyFilters();
          this.loadingDonations = false;
          // Recalcular solicitudes y métricas
          this.computeSolicitudes();
          this.loadMetrics();
        },
        error: (error) => {
          console.error('Error al cargar donaciones:', error);
          this.loadingDonations = false;
        }
      });
  }

  /**
   * Apply a tab-specific filter to `this.allDonations` and populate `this.donations`.
   * This keeps the rest of the filtering/pagination logic unchanged because it
   * always operates against `this.donations`.
   */
  private applyTabFilteringIfNeeded(): void {
    // Default to showing all donations
    let list = Array.isArray(this.allDonations) ? [...this.allDonations] : [];

    // Para el tab de resumen, mostrar todas las donaciones
    if (this.activeTab === 'resumen') {
      this.donations = list;
    }
    // Para otros tabs, mantener la lista completa
    else {
      this.donations = list;
    }
  }

  /**
   * Calcular solicitudes donde el usuario autenticado es el donador
   */
  private computeSolicitudes(): void {
    if (!this.currentUser) { 
      this.solicitudes = []; 
      this.sentRequestsCount = 0;
      return; 
    }
    this.loadingSolicitudes = true;
    const myId = (this.currentUser.id || '').toString();
    this.solicitudes = (this.allDonations || []).filter(d => (d.donator?.id || '').toString() === myId);
    this.sentRequestsCount = this.solicitudes.length;
    this.loadingSolicitudes = false;
  }

  /**
   * Cargar catálogo de estados desde backend
   */
  private loadStatusCatalog(): void {
    this.donationService.getAllDonationStatuses()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (statuses) => {
          this.statusCatalog = statuses;
          // Mapear a textos normalizados (coinciden con getStatusBadge)
          const texts = statuses.map(s => this.getStatusBadge({ status: s.status }).text);
          this.statusOptions = Array.from(new Set(texts)).sort();
        },
        error: (err) => {
          console.error('Error al obtener estados de donación:', err);
        }
      });
  }

  /**
   * Cambiar pestaña activa
   */
  setActiveTab(tab: TabType): void {
    this.activeTabSubject.next(tab);
    // Actualizar query param según la pestaña
    let sectionParam = 'overview';
    if (tab === 'donaciones-disponibles') sectionParam = 'availableDonations';
    else if (tab === 'mis-solicitudes') sectionParam = 'myRequests';
    else if (tab === 'mis-necesidades') sectionParam = 'myNeeds';
    // Reset page to 1 when switching tabs for a consistent starting point
    this.page = 1;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { section: sectionParam, page: this.page },
      queryParamsHandling: 'merge'
    });
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
   * Navegar a publicar necesidad
   */
  onPublishNeed(): void {
    this.router.navigate(['/post/create']);
  }

  /**
   * Buscar donaciones (búsqueda avanzada)
   */
  onSearchDonations(): void {
    this.setActiveTab('donaciones-disponibles');
  }

  goToReceivedDonations(): void {
    this.router.navigate(['/organization/donations/received']);
  }
  
  /**
   * Cargar donaciones disponibles para solicitar (posts de tipo "articulos para donar")
   */
  loadAvailableDonations(): void {
    this.loadingAvailableDonations = true;
    // Cargar todos los posts y filtrar
    this.postsService.getAllPosts().pipe(takeUntil(this.destroy$)).subscribe({
      next: (allPosts) => {
        // Filtrar posts de tipo "articulos para donar" que no sean del usuario actual
        this.availableDonations = allPosts.filter(post => {
          const isDonationType = post.typePost?.type === 'articulos para donar';
          const isNotMine = post.user?.id?.toString() !== this.currentUser?.id?.toString();
          return isDonationType && isNotMine;
        });
        // Ordenar por fecha más reciente
        this.availableDonations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        this.filteredAvailableDonations = [...this.availableDonations];
        this.loadingAvailableDonations = false;
      },
      error: (error) => {
        console.error('Error al cargar donaciones disponibles:', error);
        this.loadingAvailableDonations = false;
        this.toast.error('Error', 'No se pudieron cargar las donaciones disponibles');
      }
    });
  }
  
  /**
   * Cargar mis necesidades publicadas (posts de tipo "solicitud de donacion")
   */
  loadMyNeeds(): void {
    this.loadingMyNeeds = true;
    this.postsService.getMyPosts().pipe(takeUntil(this.destroy$)).subscribe({
      next: (myPosts) => {
        // Filtrar solo posts de tipo "solicitud de donacion"
        this.myNeeds = myPosts.filter(post => post.typePost?.type === 'solicitud de donacion');
        this.filteredMyNeeds = [...this.myNeeds];
        this.loadingMyNeeds = false;
        // Actualizar métrica
        this.publishedNeedsCount = this.myNeeds.length;
        // Recalcular métricas después de cargar necesidades
        this.loadMetrics();
      },
      error: (error) => {
        console.error('Error al cargar mis necesidades:', error);
        this.loadingMyNeeds = false;
      }
    });
  }
  
  /**
   * Cargar métricas del dashboard
   */
  loadMetrics(): void {
    // Solicitudes enviadas: donaciones donde soy donador
    if (this.allDonations.length > 0 && this.currentUser) {
      this.computeSolicitudes();
    }
    this.sentRequestsCount = this.solicitudes.length;
    
    // Donaciones recibidas: donaciones donde soy beneficiario
    if (this.currentUser && this.allDonations.length > 0) {
      const myId = (this.currentUser.id || '').toString();
      const received = this.allDonations.filter(d => (d.beneficiary?.id || '').toString() === myId);
      this.receivedDonationsCount = received.length;
    }
    
    // Necesidades publicadas: se actualiza en loadMyNeeds
    // Ya está actualizado en loadMyNeeds()
    
    // Mensajes: viene del stats (ahora obtiene el valor real del backend)
    if (this.stats) {
      this.messagesCount = this.stats.unreadMessages || 0;
    }
  }
  
  /**
   * Solicitar una donación disponible
   */
  requestAvailableDonation(post: Post): void {
    // Validar permisos antes de navegar
    if (!this.authService.canRequestDonation()) {
      if (!this.authService.isAuthenticated()) {
        this.router.navigate(['/auth/login']);
      } else {
        this.toast.error('Verificación requerida', 'Debes verificar tu cuenta para solicitar donaciones');
      }
      return;
    }
    
    // Navegar al formulario de solicitud de donación
    this.router.navigate(['/organization/donations/create'], {
      queryParams: { post: post.id }
    });
  }
  
  /**
   * Contactar al donante de una donación disponible
   */
  contactDonor(post: Post): void {
    // Navegar al perfil del donante o abrir chat
    if (post.user?.id) {
      this.router.navigate(['/profile', post.user.id]);
    }
  }
  
  /**
   * Ver detalle de un post
   */
  viewPost(postId: number): void {
    this.router.navigate(['/post', postId]);
  }
  
  /**
   * Calcular la cantidad total de artículos en un post
   */
  getTotalArticlesQuantity(postArticles: any[]): number {
    if (!postArticles || postArticles.length === 0) return 0;
    return postArticles.reduce((sum, pa) => sum + parseInt(pa.quantity || '0', 10), 0);
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
   * Cargar perfil de la organización
   */
  loadOrganizationProfile(): void {
    this.organizationProfileService.getMyOrganizationProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (profile) => {
          this.organizationProfile = profile;
        },
        error: (error) => {
          console.error('Error al cargar perfil de organización:', error);
        }
      });
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
    this.updatePagination();
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
    this.page = 1;
    this.applyFilters();
  }

  /** Paginación en cliente */
  updatePagination(): void {
    this.totalPages = Math.max(1, Math.ceil(this.filteredDonations.length / this.pageSize));
    if (this.page > this.totalPages) this.page = this.totalPages;
    if (this.page < 1) this.page = 1;
    const start = (this.page - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.pagedDonations = this.filteredDonations.slice(start, end);
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages) return;
    this.page = p;
    this.updatePagination();
    // push page into the url so back/forward preserves it
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: this.page },
      queryParamsHandling: 'merge'
    });
  }

  prevPage(): void {
    if (this.page > 1) {
      this.goToPage(this.page - 1);
    }
  }

  nextPage(): void {
    if (this.page < this.totalPages) {
      this.goToPage(this.page + 1);
    }
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  /** Permisos para cambiar estado */
  canChangeStatus(d: Donation): boolean {
    const isAdmin = this.currentUser?.role === 'admin';
    const isOwnerFlag = (d as any).owner === true;
    const isCreator = (d.user?.id?.toString() || '') === (this.currentUser?.id?.toString() || '');
    return isAdmin || isOwnerFlag || isCreator;
  }

  /** Cambiar estado de una donación */
  async onChangeDonationStatus(donation: Donation, newStatusId: string | number): Promise<void> {
    const statusId = typeof newStatusId === 'string' ? parseInt(newStatusId, 10) : newStatusId;
    if (!statusId || isNaN(statusId as number)) return;
    try {
      this.updatingStatus[donation.id] = true;
      const updated = await this.donationService.updateDonationStatus(donation.id, { status: statusId as number }).toPromise();
      if (updated) {
        const idx = this.donations.findIndex(x => x.id === donation.id);
        if (idx !== -1) this.donations[idx] = updated;
        const idxF = this.filteredDonations.findIndex(x => x.id === donation.id);
        if (idxF !== -1) this.filteredDonations[idxF] = updated;
        const idxP = this.pagedDonations.findIndex(x => x.id === donation.id);
        if (idxP !== -1) this.pagedDonations[idxP] = updated;
        this.toast.success('Estado actualizado', `La donación #${donation.id} ahora está en estado "${this.getStatusBadge(updated.statusDonation).text}"`);
        this.applyFilters();
      }
    } catch (err) {
      console.error('Error al cambiar estado de donación:', err);
      this.toast.error('No se pudo actualizar', 'Intenta nuevamente en unos segundos.');
    } finally {
      this.updatingStatus[donation.id] = false;
    }
  }

  /**
   * Obtener nombre de la organización
   */
  get organizationName(): string {
    // Prioridad: nombre del perfil > nombre del usuario > username del perfil > username del usuario > fallback
    if (this.organizationProfile?.name && this.organizationProfile.name.trim()) {
      return this.organizationProfile.name;
    }
    if (this.currentUser?.name && this.currentUser.name.trim()) {
      return this.currentUser.name;
    }
    if (this.organizationProfile?.username && this.organizationProfile.username.trim()) {
      return this.organizationProfile.username;
    }
    if (this.currentUser?.username && this.currentUser.username.trim()) {
      return this.currentUser.username;
    }
    return 'Organización';
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
      const status = statusDonation.status.toLowerCase().trim();
      switch (status) {
        case 'pendiente':
          return { text: 'Pendiente', class: 'bg-yellow-100 text-yellow-800' };
        case 'aceptada':
          return { text: 'Aceptada', class: 'bg-green-100 text-green-800' };
        case 'rechazada':
          return { text: 'Rechazada', class: 'bg-red-100 text-red-800' };
        case 'entregada':
          return { text: 'Entregada', class: 'bg-blue-100 text-blue-800' };
        case 'cancelada':
          return { text: 'Cancelada', class: 'bg-gray-200 text-gray-700' };
        case 'en progreso':
          return { text: 'En Progreso', class: 'bg-indigo-100 text-indigo-800' };
        case 'completada':
          return { text: 'Completada', class: 'bg-blue-100 text-blue-800' };
        case 'recogida':
        case 'recogida ':
          return { text: 'Recogida', class: 'bg-emerald-100 text-emerald-800' };
        case 'en camino':
          return { text: 'En Camino', class: 'bg-purple-100 text-purple-800' };
        case 'en espera':
          return { text: 'En Espera', class: 'bg-orange-100 text-orange-800' };
        case 'recibida':
          return { text: 'Recibida', class: 'bg-teal-100 text-teal-800' };
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
  const status = statusStr.toLowerCase().trim();
    
    switch (status) {
      case 'pendiente':
        return { text: 'Pendiente', class: 'bg-yellow-100 text-yellow-800' };
      case 'aceptada':
      case 'disponible':
        return { text: 'Disponible', class: 'bg-green-100 text-green-800' };
      case 'rechazada':
        return { text: 'Rechazada', class: 'bg-red-100 text-red-800' };
      case 'entregada':
        return { text: 'Entregada', class: 'bg-blue-100 text-blue-800' };
      case 'completada':
        return { text: 'Completada', class: 'bg-blue-100 text-blue-800' };
      case 'cancelada':
        return { text: 'Cancelada', class: 'bg-gray-200 text-gray-700' };
      case 'en progreso':
        return { text: 'En Progreso', class: 'bg-indigo-100 text-indigo-800' };
      case 'recogida':
      case 'recogida ':
        return { text: 'Recogida', class: 'bg-emerald-100 text-emerald-800' };
      case 'en camino':
        return { text: 'En Camino', class: 'bg-purple-100 text-purple-800' };
      case 'en espera':
        return { text: 'En Espera', class: 'bg-orange-100 text-orange-800' };
      case 'recibida':
        return { text: 'Recibida', class: 'bg-teal-100 text-teal-800' };
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
