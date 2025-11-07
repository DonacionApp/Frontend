import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, catchError, of, BehaviorSubject, combineLatest } from 'rxjs';
import { DonationService, Donation } from '../../../core/services/post.service';
import { AuthService } from '../../../core/services/auth.service';
import { DonationCardComponent } from '../../../shared/components/donation-card/donation-card.component';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { DonationTypeService } from '../../../core/services/post-type.service';

interface DonationFilters {
  q: string;
  tagId: string;
  community: string;
  urgency: 'urgent' | 'soon' | 'later' | 'expired' | '';
}

interface UserInfo {
  id: string | null;
  role: string | null;
}

interface DonationStats {
  totalLikes: number;
  activeCount: number;
  filteredCount: number;
}

/**
 * Componente de feed de publicaciones de donaciones
 * Soporta filtrado avanzado, búsqueda en tiempo real y gestión de likes
 */
@Component({
  selector: 'app-publications-feed',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DonationCardComponent],
  templateUrl: './publications-feed.component.html',
  styleUrls: ['./publications-feed.component.scss']
})
export class PublicationsFeedComponent implements OnInit, OnDestroy {
  // Estado de datos
  donations: Donation[] = [];
  donationTypes: { id: string; name: string }[] = [];
  
  // Estado de UI
  loading$ = new BehaviorSubject<boolean>(false);
  errorMessage$ = new BehaviorSubject<string>('');
  showAdvancedFilters = false;
  
  // Paginación
  currentPage = 1;
  totalPages = 1;

  // Usuario actual
  private currentUser$ = new BehaviorSubject<UserInfo>({ id: null, role: null });
  
  // Control de carga inicial
  private hasInitialLoadTriggered = false;
  
  // Formulario de filtros
  filterForm: FormGroup;

  // Subject para limpieza de suscripciones
  private destroy$ = new Subject<void>();

  // Constantes
  private readonly DEBOUNCE_TIME = 300;
  private readonly DAYS_URGENT = 3;
  private readonly DAYS_SOON = 7;

  constructor(
    @Inject(DonationService) private donationService: DonationService,
    private authService: AuthService,
    private donationTypeService: DonationTypeService,
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.filterForm = this.createFilterForm();
  }

  // ==================== GETTERS ====================

  get currentUserId(): string | null {
    return this.currentUser$.value.id;
  }

  get currentUserRole(): string | null {
    return this.currentUser$.value.role;
  }

  get isOrganization(): boolean {
    return this.currentUserRole === 'organization';
  }

  get isDonor(): boolean {
    return this.currentUserRole === 'donor';
  }

  get loading(): boolean {
    return this.loading$.value;
  }

  get errorMessage(): string {
    return this.errorMessage$.value;
  }

  /**
   * Filtra las donaciones según los criterios del formulario
   */
  get filteredDonations(): Donation[] {
    const filters = this.getFiltersValue();
    
    return this.donations.filter(donation => {
      return this.matchesAllFilters(donation, filters);
    });
  }

  /**
   * Calcula estadísticas del feed actual
   */
  get stats(): DonationStats {
    const filtered = this.filteredDonations;
    
    return {
      totalLikes: filtered.reduce((total, d) => total + (d.likesCount || 0), 0),
      activeCount: this.countActiveDonations(filtered),
      filteredCount: filtered.length
    };
  }

  get totalLikes(): number {
    return this.stats.totalLikes;
  }

  get activeCount(): number {
    return this.stats.activeCount;
  }

  // ==================== LIFECYCLE HOOKS ====================

  ngOnInit(): void {
    this.initializeComponent();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.loading$.complete();
    this.errorMessage$.complete();
    this.currentUser$.complete();
  }

  // ==================== INICIALIZACIÓN ====================

  /**
   * Inicializa el componente configurando observables y cargando datos
   */
  private initializeComponent(): void {
    this.setupUserSubscription();
    this.loadDonationTypes();
  }

  /**
   * Configura la suscripción al usuario actual
   */
  private setupUserSubscription(): void {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.handleUserChange(user);
      });
  }

  /**
   * Maneja cambios en el usuario actual
   */
  private handleUserChange(user: any): void {
    const userInfo: UserInfo = {
      id: user?.id || null,
      role: user?.role || null
    };

    const previousUserId = this.currentUser$.value.id;
    this.currentUser$.next(userInfo);

    const userChanged = previousUserId !== userInfo.id;

    if (!this.hasInitialLoadTriggered) {
      this.hasInitialLoadTriggered = true;
      this.performInitialLoad(userInfo.role);
      return;
    }

    if (userChanged) {
      console.log('🔄 Usuario cambió:', { anterior: previousUserId, nuevo: userInfo.id });
      this.recalculateLikeStates(userInfo.id);
      this.loadPublications();
    }
  }

  /**
   * Realiza la carga inicial según el rol del usuario
   */
  private performInitialLoad(role: string | null): void {
          this.loadPublications();

    if (role === 'donor') {
      this.setupDonorFeatures();
    }
  }

  /**
   * Configura características específicas para donadores
   */
  private setupDonorFeatures(): void {
    this.applyUrlFilters();
    this.setupReactiveSearch();
  }

  /**
   * Aplica filtros desde los parámetros de URL
   */
  private applyUrlFilters(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const filters = this.extractFiltersFromParams(params);
        
        if (this.hasAnyFilter(filters)) {
          this.filterForm.patchValue(filters, { emitEvent: false });
            this.onApplyAdvancedFilters();
            this.showAdvancedFilters = false;
          }
        });
  }

  /**
   * Configura la búsqueda reactiva con debounce
   */
  private setupReactiveSearch(): void {
        this.filterForm.valueChanges
          .pipe(
        debounceTime(this.DEBOUNCE_TIME),
            distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
            takeUntil(this.destroy$)
          )
          .subscribe(() => {
            this.onApplyAdvancedFilters();
          });
  }

  /**
   * Carga los tipos de donación disponibles
   */
  private loadDonationTypes(): void {
    this.donationTypeService.getAllDonationTypes()
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('❌ Error cargando tipos de donación:', error);
          return of([]);
        })
      )
      .subscribe(types => {
        this.donationTypes = (types || []).map(t => ({ 
          id: String(t.id), 
          name: t.name 
        }));
      });
  }

  // ==================== FORMULARIO ====================

  /**
   * Crea el formulario de filtros
   */
  private createFilterForm(): FormGroup {
    return this.fb.group({
      q: [''],
      tagId: [''],
      community: [''],
      urgency: ['']
    });
  }

  /**
   * Obtiene los valores actuales del formulario de filtros
   */
  private getFiltersValue(): DonationFilters {
    const value = this.filterForm.value || {};
    return {
      q: (value.q || '').toString().toLowerCase().trim(),
      tagId: (value.tagId || '').toString(),
      community: (value.community || '').toString().toLowerCase().trim(),
      urgency: value.urgency || ''
    };
  }

  /**
   * Extrae filtros de los parámetros de URL
   */
  private extractFiltersFromParams(params: any): DonationFilters {
    return {
      q: params['q'] || '',
      community: params['community'] || '',
      tagId: params['tagId'] || '',
      urgency: params['urgency'] || ''
    };
  }

  /**
   * Verifica si hay algún filtro activo
   */
  private hasAnyFilter(filters: DonationFilters): boolean {
    return !!(filters.q || filters.community || filters.tagId || filters.urgency);
  }

  // ==================== FILTRADO ====================

  /**
   * Verifica si una donación cumple con todos los filtros
   */
  private matchesAllFilters(donation: Donation, filters: DonationFilters): boolean {
    return (
      this.matchesTextFilter(donation, filters.q) &&
      this.matchesCommunityFilter(donation, filters.community) &&
      this.matchesTagFilter(donation, filters.tagId) &&
      this.matchesUrgencyFilter(donation, filters.urgency)
    );
  }

  /**
   * Verifica si una donación cumple con el filtro de texto
   */
  private matchesTextFilter(donation: Donation, text: string): boolean {
    if (!text) return true;
    
    const title = (donation.title || '').toLowerCase();
    const description = (donation.description || donation.message || '').toLowerCase();
    
    return title.includes(text) || description.includes(text);
  }

  /**
   * Verifica si una donación cumple con el filtro de comunidad
   */
  private matchesCommunityFilter(donation: Donation, community: string): boolean {
    if (!community) return true;
    
    return (donation.comunity || '').toLowerCase().includes(community);
  }

  /**
   * Verifica si una donación cumple con el filtro de categoría/tag
   */
  private matchesTagFilter(donation: Donation, tagId: string): boolean {
    if (!tagId) return true;
    
    const hasTagMatch = donation.tags?.some(t => String(t.id) === tagId);
    const hasDonationTypeMatch = donation.donationType && String(donation.donationType.id) === tagId;
    const hasDonationTypeIdMatch = donation.donationTypeId && String(donation.donationTypeId) === tagId;
    
    return !!(hasTagMatch || hasDonationTypeMatch || hasDonationTypeIdMatch);
  }

  /**
   * Verifica si una donación cumple con el filtro de urgencia
   */
  private matchesUrgencyFilter(donation: Donation, urgency: string): boolean {
    if (!urgency) return true;
    
    const daysRemaining = this.getDaysRemaining(donation.fechaMaximaEntrega);
    
    switch (urgency) {
      case 'urgent':
        return daysRemaining >= 0 && daysRemaining <= this.DAYS_URGENT;
      case 'soon':
        return daysRemaining > this.DAYS_URGENT && daysRemaining <= this.DAYS_SOON;
      case 'later':
        return daysRemaining > this.DAYS_SOON;
      case 'expired':
        return daysRemaining < 0;
      default:
        return true;
    }
  }

  /**
   * Calcula los días restantes hasta la fecha máxima de entrega
   */
  private getDaysRemaining(fechaMaximaEntrega?: string): number {
    if (!fechaMaximaEntrega) return -1;
    
    const today = new Date();
    const maxDate = new Date(fechaMaximaEntrega);
    const diff = maxDate.getTime() - today.getTime();
    
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Cuenta las donaciones activas (no expiradas)
   */
  private countActiveDonations(donations: Donation[]): number {
    const today = new Date();
    
    return donations.filter(donation => {
      if (!donation.fechaMaximaEntrega) return false;
      const maxDate = new Date(donation.fechaMaximaEntrega);
      return maxDate >= today;
    }).length;
  }

  // ==================== CARGA DE DATOS ====================

  /**
   * Carga todas las publicaciones del backend
   */
  loadPublications(): void {
    this.setLoadingState(true);
    this.clearError();
    this.donations = [];

    
    
    this.donationService.getAllPublications()
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          this.handleLoadError(error);
          return of([]);
        })
      )
      .subscribe({
        next: (donations: Donation[]) => {
          this.handleLoadSuccess(donations);
        }
      });
  }

  /**
   * Maneja la carga exitosa de publicaciones
   */
  private handleLoadSuccess(donations: Donation[]): void {
    this.donations = donations || [];
    this.setLoadingState(false);

    // Recalcular estados de like basándose en el usuario actual
    const currentUserId = this.currentUser$.value.id;
    if (currentUserId) {
      console.log('🔄 Recalculando likes después de cargar publicaciones para usuario:', currentUserId);
      this.recalculateLikeStates(currentUserId);
    }

    if (this.donations.length === 0) {
      console.log('ℹ️ No hay publicaciones disponibles');
    }
  }

  /**
   * Maneja errores al cargar publicaciones
   */
  private handleLoadError(error: any): void {
    this.setLoadingState(false);
    // Si el backend responde 404/204 u otro indicador de "no hay datos",
    // mostrar estado vacío en lugar de error.
    const status = error?.status;
    const message = (error?.error?.message || error?.message || '').toString().toLowerCase();
    const isEmptyResponse = status === 404 || status === 204 || message.includes('no data') || message.includes('not found');

    this.donations = [];
    if (isEmptyResponse) {
      this.clearError();
      return;
    }

    // Errores reales: red, 5xx, auth, etc.
    this.setError('Error al cargar las publicaciones. Por favor intenta nuevamente.');
  }

  // ==================== GESTIÓN DE LIKES ====================

  /**
   * Maneja el toggle de like en una donación
   */
  onLikeToggled(event: { donationId: string; isLiked: boolean }): void {
    if (!this.ensureAuthenticated()) {
      return;
    }

    if (this.donationService.isLikeInProgress(event.donationId)) {
      
      return;
    }

    const donation = this.findDonation(event.donationId);
    if (!donation) {
      console.error('❌ Donación no encontrada:', event.donationId);
      return;
    }
    
    if (!this.validateLikeAction(donation, event.isLiked)) {
      return;
    }

    this.performLikeToggle(donation, event);
  }

  /**
   * Encuentra una donación por ID
   */
  private findDonation(donationId: string): Donation | undefined {
    return this.donations.find(d => d.id === donationId);
  }

  /**
   * Valida si la acción de like es válida
   */
  private validateLikeAction(donation: Donation, isCurrentlyLiked: boolean): boolean {
    // No bloquear desde el frontend; dejar que el backend decida
    return true;
  }

  /**
   * Ejecuta el toggle de like - instantáneo con confirmación del backend
   */
  private performLikeToggle(donation: Donation, event: { donationId: string; isLiked: boolean }): void {
    // Lógica simple de interruptor (switch):
    // Si está OFF (no liked) -> Encender (liked) y sumar 1
    // Si está ON (liked) -> Apagar (no liked) y restar 1

    const donationIndex = this.donations.findIndex(d => d.id === event.donationId);
    if (donationIndex === -1) return;

    const previousLiked = this.normalizeBoolean(donation.isLikedByCurrentUser);
    const previousCount = this.normalizeNumber(donation.likesCount);
    const newLikeState = !previousLiked;

    // IMPORTANTE: Calcular el contador optimista que SABEMOS es correcto
    const optimisticCount = Math.max(0, previousCount + (newLikeState ? 1 : -1));

    // Actualización optimista - crear nuevo objeto y reemplazar en array
    const optimisticDonation = {
      ...this.donations[donationIndex],
      isLikedByCurrentUser: newLikeState,
      likesCount: optimisticCount
    };

    this.donations[donationIndex] = optimisticDonation;
    this.donations = [...this.donations];

    console.log('📝 Actualización optimista:', {
      donationId: event.donationId,
      wasLiked: previousLiked,
      isNowLiked: newLikeState,
      countChanged: `${previousCount} → ${optimisticCount}`
    });

    // Enviar al backend
    this.donationService.toggleLike(event.donationId, previousLiked)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedDonation: Donation) => {
          // Backend confirmó el like/unlike
          console.log('✅ Backend confirmó - Like procesado:', {
            donationId: event.donationId,
            isLiked: newLikeState,
            optimisticCount,
            respuesta_backend: updatedDonation
          });

          const currentIndex = this.donations.findIndex(d => d.id === event.donationId);
          if (currentIndex !== -1) {
            // Mantener el estado optimista
            this.donations[currentIndex] = {
              ...this.donations[currentIndex],
              isLikedByCurrentUser: newLikeState,
              likesCount: optimisticCount
            } as Donation;
            this.donations = [...this.donations];

            console.log('✅ Like confirmado - Estado final:', {
              donationId: event.donationId,
              isLiked: this.donations[currentIndex].isLikedByCurrentUser,
              count: this.donations[currentIndex].likesCount
            });
          }
        },
        error: (error) => {
          console.error('❌ Error al dar/quitar like:', error);

          const currentIndex = this.donations.findIndex(d => d.id === event.donationId);
          if (currentIndex !== -1) {
            const normalizedMessage = (error?.error?.message || error?.message || '').toString().toLowerCase();

            if (error.status === 400 && normalizedMessage.includes('ya le ha dado like')) {
              console.warn('⚠️ Like duplicado detectado. Manteniendo el estado sincronizado con backend.');

              const currentDonation = this.donations[currentIndex];
              const ensuredCount = this.normalizeNumber(currentDonation.likesCount ?? previousCount);

              this.donations[currentIndex] = {
                ...currentDonation,
                isLikedByCurrentUser: true,
                likesCount: ensuredCount > 0 ? ensuredCount : Math.max(1, previousCount)
              } as Donation;
              this.donations = [...this.donations];

              return;
            }

            // Revertir al estado anterior si hay error
            console.warn('⏮️ Revirtiendo a estado anterior:', {
              donationId: event.donationId,
              revirtiendo_a_liked: previousLiked,
              revirtiendo_a_count: previousCount
            });

            this.donations[currentIndex] = {
              ...this.donations[currentIndex],
              isLikedByCurrentUser: previousLiked,
              likesCount: previousCount
            } as Donation;
            this.donations = [...this.donations];
          }

          if (error.status === 400) {
            console.warn('⚠️ Error 400 - Backend rechazó la solicitud');
          } else if (error.status === 401) {
            console.warn('⚠️ Error 401 - Token expirado, por favor vuelve a iniciar sesión');
          }
        }
      });
  }

  private normalizeBoolean(value: any): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return ['1', 'true', 'sí', 'si', 'yes', 'y'].includes(normalized);
    }

    return false;
  }

  private normalizeNumber(value: any): number {
    if (typeof value === 'number' && !isNaN(value)) {
      return value;
    }

    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Recalcula los estados de like basándose en el usuario actual
   * Verifica si el usuario actual está en la lista de usuarios que dieron like
   */
  private recalculateLikeStates(currentUserId: string | null): void {
    if (!currentUserId || this.donations.length === 0) {
      console.log('⚠️ No se puede recalcular likes: usuario actual o donaciones vacías');
      return;
    }

    console.log('📊 Recalculando estados de like para usuario:', currentUserId);

    this.donations = this.donations.map(donation => {
      // Verificar si el usuario actual está en la lista de likes
      let isCurrentUserLiked = false;

      if (Array.isArray(donation.likes) && donation.likes.length > 0) {
        // Si likes es un array de objetos con userId
        isCurrentUserLiked = donation.likes.some((like: any) => {
          const likeUserId = like?.userId || like?.user?.id || like?.id;
          return String(likeUserId) === String(currentUserId);
        });

        console.log('✅ Like recalculado para donación', donation.id, ':', {
          currentUserId,
          likesCount: donation.likes.length,
          isLikedByCurrentUser: isCurrentUserLiked,
          likesList: donation.likes.map((l: any) => ({
            userId: l?.userId || l?.user?.id || l?.id,
            username: l?.user?.username || l?.username
          }))
        });
      } else if (this.normalizeBoolean(donation.isLikedByCurrentUser) && this.normalizeNumber(donation.likesCount) > 0) {
        // Si no hay lista pero hay bandera y contador, mantener estado previo como respaldo
        isCurrentUserLiked = true;
      }

      return {
        ...donation,
        isLikedByCurrentUser: isCurrentUserLiked
      };
    });

    // Notificar cambios
    this.donations = [...this.donations];
    console.log('✨ Estados de like recalculados para', this.donations.length, 'publicaciones');
  }

  // ==================== ACCIONES DE USUARIO ====================

  /**
   * Maneja el clic en una donación
   */
  onDonationClicked(donationId: string): void {
    this.router.navigate(['/donations', donationId]);
  }

  onDeleteDonation(donationId: string): void {
    if (!donationId) return;
    const confirmed = confirm('¿Eliminar esta publicación? Esta acción no se puede deshacer.');
    if (!confirmed) return;

    this.donationService.deletePublication(donationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.donations = this.donations.filter(d => d.id !== donationId);
        },
        error: () => {
          alert('No se pudo eliminar la publicación.');
        }
      });
  }

  onEditDonation(donationId: string): void {
    if (!donationId) return;
    this.router.navigate(['/donations', donationId, 'edit']);
  }

  /**
   * Inicia el proceso de donación
   */
  onDonateClicked(donationId: string): void {
    
    
    if (!this.ensureAuthenticated('/donations/feed')) {
      return;
    }

    this.router.navigate(['/donations', donationId], { 
      queryParams: { action: 'donate' } 
    });
    
    
  }

  /**
   * Navega a la creación de nueva donación
   */
  onCreateNewDonation(): void {
    if (!this.ensureAuthenticated('/donations/create')) {
      return;
    }

    this.router.navigate(['/donations/create']);
  }

  /**
   * Recarga las publicaciones
   */
  onRefresh(): void {
    this.loadPublications();
  }

  /**
   * Resetea todos los filtros
   */
  onResetFilters(): void {
    this.filterForm.reset({ 
      q: '', 
      tagId: '', 
      community: '', 
      urgency: '' 
    });
    
    this.clearUrlFilters();
  }

  /**
   * Alterna la visibilidad de filtros avanzados
   */
  onToggleAdvancedFilters(): void {
    this.showAdvancedFilters = !this.showAdvancedFilters;
  }

  /**
   * Aplica los filtros avanzados
   */
  onApplyAdvancedFilters(): void {
    const filters = this.getFiltersValue();
    
    this.setLoadingState(true);
    
    this.donationService.getFilteredPublications(filters)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('❌ Error aplicando filtros:', error);
          this.setLoadingState(false);
          return of([]);
        })
      )
      .subscribe((donations: Donation[]) => {
        this.handleFilterSuccess(donations, filters);
      });

  }

  /**
   * Maneja la aplicación exitosa de filtros
   */
  private handleFilterSuccess(donations: Donation[], filters: DonationFilters): void {
    this.donations = donations || [];
    this.setLoadingState(false);
    this.hasInitialLoadTriggered = true;
    this.showAdvancedFilters = false;
    this.syncFiltersToUrl(filters);
  }

  /**
   * Inicia la búsqueda de donaciones (para donadores)
   */
  onSearchForDonations(): void {
    this.hasInitialLoadTriggered = true;
    this.loadPublications();
  }

  // ==================== UTILIDADES ====================

  /**
   * Verifica si el usuario está autenticado, redirige si no lo está
   */
  private ensureAuthenticated(returnUrl: string = '/donations/feed'): boolean {
    if (!this.currentUserId) {
      this.router.navigate(['/auth/login'], { 
        queryParams: { returnUrl } 
      });
      return false;
    }
    return true;
  }

  /**
   * Establece el estado de carga
   */
  private setLoadingState(loading: boolean): void {
    this.loading$.next(loading);
  }

  /**
   * Establece un mensaje de error
   */
  private setError(message: string): void {
    this.errorMessage$.next(message);
  }

  /**
   * Limpia el mensaje de error
   */
  clearError(): void {
    this.errorMessage$.next('');
  }
  
  /**
   * Cancela la carga en progreso
   */
  onCancelLoading(): void {
    this.setLoadingState(false);
    this.clearError();
  }
  
  /**
   * Navega a la página anterior
   */
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadPublications();
    }
  }
  
  /**
   * Navega a la página siguiente
   */
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadPublications();
    }
  }

  /**
   * Sincroniza filtros con la URL
   */
  private syncFiltersToUrl(filters: DonationFilters): void {
        this.router.navigate([], {
          relativeTo: this.route,
      queryParams: { 
        q: filters.q || null, 
        community: filters.community || null, 
        tagId: filters.tagId || null, 
        urgency: filters.urgency || null 
      },
          queryParamsHandling: 'merge'
        });
  }

  /**
   * Limpia los filtros de la URL
   */
  private clearUrlFilters(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { 
        q: null, 
        community: null, 
        tagId: null, 
        urgency: null 
      },
      queryParamsHandling: 'merge'
    });
  }

  /**
   * TrackBy function para optimizar renderizado de lista
   */
  trackByDonationId(index: number, donation: Donation): string {
    return donation.id;
  }
}

