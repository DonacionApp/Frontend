import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { DonationService, Donation } from '../../../core/services/donation.service';
import { AuthService } from '../../../core/services/auth.service';
import { DonationCardComponent } from '../../../shared/components/donation-card/donation-card.component';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { DonationTypeService } from '../../../core/services/donation-type.service';

@Component({
  selector: 'app-publications-feed',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DonationCardComponent],
  templateUrl: './publications-feed.component.html',
  styleUrls: ['./publications-feed.component.scss']
})
export class PublicationsFeedComponent implements OnInit, OnDestroy {
  donations: Donation[] = [];
  loading = false;
  errorMessage = '';
  currentUserId: string | null = null;
  currentUserRole: string | null = null;
  private hasInitialLoadTriggered = false;
  showAdvancedFilters = false;

  // Filtros de búsqueda
  filterForm: FormGroup;
  donationTypes: { id: string; name: string }[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private donationService: DonationService,
    private authService: AuthService,
    private donationTypeService: DonationTypeService,
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.filterForm = this.fb.group({
      q: [''],
      tagId: [''],
      community: [''],
      urgency: [''] // urgent(<=3), soon(<=7), later(>7), expired(<0)
    });
  }

  // Getters para estadísticas
  get totalLikes(): number {
    return this.filteredDonations.reduce((total, donation) => total + (donation.likesCount || 0), 0);
  }

  get activeCount(): number {
    const today = new Date();
    return this.filteredDonations.filter(donation => {
      if (!donation.fechaMaximaEntrega) return false;
      const maxDate = new Date(donation.fechaMaximaEntrega);
      return maxDate >= today;
    }).length;
  }

  // Lista filtrada para mostrar
  get filteredDonations(): Donation[] {
    const { q, tagId, community, urgency } = this.filterForm.value || {};
    const text = (q || '').toString().toLowerCase().trim();
    const communityText = (community || '').toString().toLowerCase().trim();
    const tagIdStr = (tagId || '').toString();

    return this.donations.filter(d => {
      // Texto libre (título/descripción)
      const matchesText = text
        ? (d.title || '').toLowerCase().includes(text) || (d.description || d.message || '').toLowerCase().includes(text)
        : true;

      // Comunidad
      const matchesCommunity = communityText
        ? (d.comunity || '').toLowerCase().includes(communityText)
        : true;

      // Tag/Categoría (si el post tiene tags con id o donationTypeId)
      const matchesTag = tagIdStr
        ? (
            (d.tags && d.tags.some(t => String(t.id) === tagIdStr)) ||
            (d.donationType && String(d.donationType.id) === tagIdStr) ||
            (d.donationTypeId && String(d.donationTypeId) === tagIdStr)
          )
        : true;

      // Urgencia por días restantes
      const daysRemaining = this.getDaysRemaining(d.fechaMaximaEntrega);
      const matchesUrgency = urgency
        ? (
            (urgency === 'urgent' && daysRemaining >= 0 && daysRemaining <= 3) ||
            (urgency === 'soon' && daysRemaining > 3 && daysRemaining <= 7) ||
            (urgency === 'later' && daysRemaining > 7) ||
            (urgency === 'expired' && daysRemaining < 0)
          )
        : true;

      return matchesText && matchesCommunity && matchesTag && matchesUrgency;
    });
  }

  private getDaysRemaining(fechaMaximaEntrega?: string): number {
    if (!fechaMaximaEntrega) return -1;
    const today = new Date();
    const maxDate = new Date(fechaMaximaEntrega);
    const diff = maxDate.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  ngOnInit(): void {
    // Obtener usuario actual y configurar el comportamiento según rol
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.currentUserId = user?.id || null;
      this.currentUserRole = user?.role || null;
      console.log('👤 Usuario actual:', { id: this.currentUserId, role: this.currentUserRole });

      if (this.currentUserRole === 'donor') {
        // Donor: auto-carga y búsqueda automática
        if (!this.hasInitialLoadTriggered) {
          this.hasInitialLoadTriggered = true;
          this.loadPublications();
        }

        // Aplicar filtros desde URL
        this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
          const q = params['q'] || '';
          const community = params['community'] || '';
          const tagId = params['tagId'] || '';
          const urgency = params['urgency'] || '';
          if (q || community || tagId || urgency) {
            this.filterForm.patchValue({ q, community, tagId, urgency }, { emitEvent: false });
            this.onApplyAdvancedFilters();
            this.showAdvancedFilters = false;
          }
        });

        // Búsqueda reactiva con debounce
        this.filterForm.valueChanges
          .pipe(
            debounceTime(300),
            distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
            takeUntil(this.destroy$)
          )
          .subscribe(() => {
            this.onApplyAdvancedFilters();
          });
      } else {
        // Organización u otros roles: carga única sin búsqueda automática
        if (!this.hasInitialLoadTriggered) {
          this.hasInitialLoadTriggered = true;
          this.loadPublications();
        }
      }
    });

    // Cargar categorías/tags para filtro
    this.donationTypeService.getAllDonationTypes().pipe(takeUntil(this.destroy$)).subscribe(types => {
      this.donationTypes = (types || []).map(t => ({ id: String(t.id), name: t.name }));
    });
  }

  // Getter para verificar si el usuario es organización
  get isOrganization(): boolean {
    return this.currentUserRole === 'organization';
  }

  // Getter para verificar si el usuario es donador
  get isDonor(): boolean {
    return this.currentUserRole === 'donor';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPublications(): void {
    this.loading = true;
    this.errorMessage = '';
    // Asegurar que siempre empezamos con array vacío
    this.donations = [];

    console.log('🔄 Cargando publicaciones desde el backend...');
    
    this.donationService.getAllPublicDonations().subscribe({
      next: (donations) => {
        console.log('✅ Publicaciones recibidas del backend:', donations);
        console.log('📊 Cantidad:', donations.length);
        
        // Asignar solo las donaciones que vengan del backend
        this.donations = donations || [];
        this.loading = false;
        
        if (this.donations.length === 0) {
          console.log('ℹ️ No hay publicaciones en el backend');
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('❌ Error al cargar publicaciones:', error);
        console.error('Detalles del error:', {
          status: error.status,
          message: error.message,
          error: error.error
        });
        this.errorMessage = 'Error al cargar las publicaciones. Por favor intenta nuevamente.';
        // Asegurar que el array esté vacío en caso de error
        this.donations = [];
      }
    });
  }

  onLikeToggled(event: { donationId: string; isLiked: boolean }): void {
    if (!this.currentUserId) {
      // Redirigir a login si no está autenticado
      this.router.navigate(['/auth/login'], { 
        queryParams: { returnUrl: '/donations/feed' } 
      });
      return;
    }

    // Prevenir múltiples clics si ya está en proceso
    if (this.donationService.isLikeInProgress(event.donationId)) {
      return;
    }

    const index = this.donations.findIndex(d => d.id === event.donationId);
    if (index === -1) return;

    // Guardar estado anterior para posible reversión
    const donation = this.donations[index];
    const previousState = {
      isLiked: donation.isLikedByCurrentUser || false,
      likesCount: donation.likesCount || 0
    };

    // Prevenir like duplicado: si intenta dar like pero ya le dio like, no hacer nada
    // Esta validación adicional evita que el contador se incremente incorrectamente
    if (!event.isLiked && donation.isLikedByCurrentUser) {
      console.warn('⚠️ Intento de like duplicado detectado, evitando actualización optimista');
      return;
    }
    
    // Prevenir unlike cuando no tiene like: si intenta quitar like pero no lo tiene, no hacer nada
    if (event.isLiked && !donation.isLikedByCurrentUser) {
      console.warn('⚠️ Intento de quitar like cuando no existe, evitando actualización optimista');
      return;
    }

    // Actualización optimista: actualizar inmediatamente en la UI
    if (event.isLiked) {
      // Quitar like
      donation.isLikedByCurrentUser = false;
      donation.likesCount = Math.max((donation.likesCount || 0) - 1, 0);
    } else {
      // Agregar like
      donation.isLikedByCurrentUser = true;
      donation.likesCount = (donation.likesCount || 0) + 1;
    }

    // Llamar al servicio para sincronizar con el backend
    this.donationService.toggleLike(event.donationId, event.isLiked).subscribe({
      next: (updatedDonation) => {
        // Sincronizar con la respuesta del servidor preservando datos existentes
        const currentIndex = this.donations.findIndex(d => d.id === event.donationId);
        if (currentIndex !== -1 && updatedDonation) {
          const existingDonation = this.donations[currentIndex];
          // Solo actualizar campos relacionados con likes, preservar el resto
          existingDonation.likes = updatedDonation.likes || existingDonation.likes;
          existingDonation.likesCount = updatedDonation.likesCount ?? existingDonation.likesCount ?? 0;
          existingDonation.isLikedByCurrentUser = updatedDonation.isLikedByCurrentUser ?? existingDonation.isLikedByCurrentUser ?? false;
          existingDonation.updatedAt = updatedDonation.updatedAt || existingDonation.updatedAt;
        }
      },
      error: (error) => {
        console.error('Error al actualizar like:', error);
        // Revertir la actualización optimista en caso de error
        if (index !== -1) {
          donation.isLikedByCurrentUser = previousState.isLiked;
          donation.likesCount = previousState.likesCount;
        }
        
        // El servicio ya sincroniza con el backend automáticamente después de errores
        // Aquí solo revertimos el estado local inmediato para feedback visual rápido
      }
    });
  }

  onDonationClicked(donationId: string): void {
    this.router.navigate(['/donations', donationId]);
  }

  onDonateClicked(donationId: string): void {
    console.log('💚 Donación iniciada para:', donationId);
    
    if (!this.currentUserId) {
      // Redirigir a login si no está autenticado
      this.router.navigate(['/auth/login'], { 
        queryParams: { returnUrl: '/donations/feed' } 
      });
      return;
    }

    // TODO: Implementar la lógica completa de donación
    // Esto podría:
    // 1. Abrir un modal de confirmación con formulario de donación
    // 2. Redirigir a una página de donación detallada
    // 3. Enviar una solicitud de contacto al backend
    
    // Por ahora, redirigimos a los detalles de la donación con parámetro de acción
    // En el futuro, esto podría ser: /donations/:id/donate
    this.router.navigate(['/donations', donationId], { 
      queryParams: { action: 'donate' } 
    });
    
    // Mostrar feedback temporal
    console.log('✅ Redirigiendo a detalles para iniciar donación...');
  }

  onCreateNewDonation(): void {
    if (!this.currentUserId) {
      this.router.navigate(['/auth/login'], { 
        queryParams: { returnUrl: '/donations/create' } 
      });
      return;
    }

    this.router.navigate(['/donations/create']);
  }

  onRefresh(): void {
    this.loadPublications();
  }

  onResetFilters(): void {
    this.filterForm.reset({ q: '', tagId: '', community: '', urgency: '' });
    // Limpiar query params
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: null, community: null, tagId: null, urgency: null },
      queryParamsHandling: 'merge'
    });
  }

  trackByDonationId(index: number, donation: Donation): string {
    return donation.id;
  }

  // Acción explícita para que donadores inicien la búsqueda/carga
  onSearchForDonations(): void {
    this.hasInitialLoadTriggered = true;
    this.loadPublications();
  }

  onToggleAdvancedFilters(): void {
    this.showAdvancedFilters = !this.showAdvancedFilters;
  }

  onApplyAdvancedFilters(): void {
    const { q, community, tagId, urgency } = this.filterForm.value || {};
    // Intentar filtrar en servidor; si falla, quedamos con el filtrado local
    this.loading = true;
    this.donationService.getPublicDonationsFiltered({ q, community, tagId, urgency }).subscribe({
      next: donations => {
        this.donations = donations || [];
        this.loading = false;
        this.hasInitialLoadTriggered = true;
        this.showAdvancedFilters = false;
        // Sync filtros con la URL
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { q: q || null, community: community || null, tagId: tagId || null, urgency: urgency || null },
          queryParamsHandling: 'merge'
        });
      },
      error: () => {
        this.loading = false;
        this.showAdvancedFilters = false;
      }
    });
  }
}

