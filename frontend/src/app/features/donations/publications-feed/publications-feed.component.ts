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

