import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { DonationService, Donation } from '../../../core/services/post.service';
import { AuthService } from '../../../core/services/auth.service';
import { DonationCardComponent } from '../../../shared/components/donation-card/donation-card.component';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-user-publications',
  standalone: true,
  imports: [CommonModule, DonationCardComponent, SpinnerComponent],
  template: `
    <div class="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div class="max-w-6xl mx-auto">
        <!-- Header -->
        <div class="mb-6">
          <button
            (click)="onBack()"
            class="mb-4 inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
            Volver
          </button>
          <h1 class="text-3xl font-bold text-gray-900">Publicaciones del Usuario</h1>
          <p class="mt-2 text-sm text-gray-600" *ngIf="username">
            Todas las publicaciones de {{ username }}
          </p>
        </div>

        <!-- Loading State -->
        <app-spinner *ngIf="loading"></app-spinner>

        <!-- Error State -->
        <div *ngIf="errorMessage && !loading" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div class="flex items-start">
            <svg class="w-5 h-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
            </svg>
            <div>
              <p class="text-sm font-medium text-red-800">{{ errorMessage }}</p>
              <button 
                (click)="loadPublications()"
                class="mt-2 text-sm text-red-600 hover:text-red-800 underline focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
              >
                Intentar nuevamente
              </button>
            </div>
          </div>
        </div>

        <!-- Publications List -->
        <div *ngIf="!loading && donations.length > 0" class="space-y-6">
          <div class="mb-4 text-sm text-gray-600">
            Mostrando {{ donations.length }} publicación{{ donations.length !== 1 ? 'es' : '' }}
          </div>
          <app-donation-card
            *ngFor="let donation of donations; trackBy: trackByDonationId"
            [donation]="donation"
            [showActions]="true"
            [currentUserId]="currentUserId"
            [currentUserRole]="currentUserRole"
            [showDelete]="currentUserRole === 'organization'"
            (likeToggled)="onLikeToggled($event)"
            (donationClicked)="onDonationClicked($event)"
            (donateClicked)="onDonateClicked($event)"
            (deleteClicked)="onDeleteDonation($event)"
            (editClicked)="onEditDonation($event)"
          ></app-donation-card>
        </div>

        <!-- Empty State -->
        <div *ngIf="!loading && donations.length === 0 && !errorMessage" class="text-center py-16">
          <div class="max-w-md mx-auto bg-white rounded-lg shadow p-10 border border-gray-200">
            <div class="mb-6">
              <div class="mx-auto w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                <svg class="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                </svg>
              </div>
            </div>
            <h3 class="text-xl font-bold text-gray-900 mb-2">No hay publicaciones</h3>
            <p class="text-gray-600">
              Este usuario aún no ha realizado publicaciones.
            </p>
          </div>
        </div>
      </div>
    </div>
  `
})
export class UserPublicationsComponent implements OnInit, OnDestroy {
  donations: Donation[] = [];
  loading = false;
  errorMessage = '';
  currentUserId: string | null = null;
  currentUserRole: string | null = null;
  targetUserId: string | null = null;
  username: string | null = null;
  
  private destroy$ = new Subject<void>();

  constructor(
    @Inject(DonationService) private donationService: DonationService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Obtener usuario actual
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.currentUserId = user?.id || null;
      this.currentUserRole = user?.role || null;
    });

    // Obtener userId desde query params (oculto, no en la URL visible)
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const userId = params['userId'];
      if (userId) {
        this.targetUserId = userId;
        this.loadPublications();
      } else {
        this.errorMessage = 'ID de usuario no proporcionado';
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPublications(): void {
    if (!this.targetUserId) {
      this.errorMessage = 'ID de usuario no válido';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.donations = [];

    this.donationService.getAllPublications()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (donations: Donation[]) => {
          const filtered = (donations || []).filter(donation => {
            const ownerA = donation.userId ? String(donation.userId) : null;
            const ownerB = donation.user?.id ? String(donation.user.id) : null;
            const target = String(this.targetUserId);
            return ownerA === target || ownerB === target;
          });

          this.donations = filtered;
          if (this.donations.length > 0 && this.donations[0].user) {
            this.username = this.donations[0].user?.username || null;
          }

          if (this.donations.length === 0) {
            this.errorMessage = '';
          }

          this.loading = false;
        },
        error: (error: any) => {
          this.loading = false;
          console.error('Error al cargar publicaciones del usuario:', error);
          this.errorMessage = 'Error al cargar las publicaciones. Por favor intenta nuevamente.';
          this.donations = [];
        }
      });
  }

  onLikeToggled(event: { donationId: string; isLiked: boolean }): void {
    if (!this.currentUserId) {
      this.router.navigate(['/auth/login'], { 
        queryParams: { returnUrl: this.router.url } 
      });
      return;
    }

    if (this.donationService.isLikeInProgress(event.donationId)) {
      return;
    }

    const index = this.donations.findIndex(d => d.id === event.donationId);
    if (index === -1) return;

    const previousLiked = this.donations[index].isLikedByCurrentUser || false;
    const previousCount = this.donations[index].likesCount || 0;
    const newLikeState = !previousLiked;
    const optimisticCount = Math.max(0, previousCount + (newLikeState ? 1 : -1));

    this.donations[index] = {
      ...this.donations[index],
      isLikedByCurrentUser: newLikeState,
      likesCount: optimisticCount
    } as Donation;
    this.donations = [...this.donations];

    this.donationService.toggleLike(event.donationId, previousLiked).subscribe({
      next: (updatedDonation: Donation) => {
        const currentIndex = this.donations.findIndex(d => d.id === event.donationId);
        if (currentIndex !== -1 && updatedDonation) {
          this.donations[currentIndex] = {
            ...this.donations[currentIndex],
            likes: updatedDonation.likes || this.donations[currentIndex].likes,
            likesCount: updatedDonation.likesCount ?? this.donations[currentIndex].likesCount ?? optimisticCount,
            isLikedByCurrentUser: updatedDonation.isLikedByCurrentUser ?? newLikeState,
            updatedAt: updatedDonation.updatedAt || this.donations[currentIndex].updatedAt
          } as Donation;
          this.donations = [...this.donations];
        }
      },
      error: (error: any) => {
        console.error('Error al actualizar like:', error);

        const currentIndex = this.donations.findIndex(d => d.id === event.donationId);
        if (currentIndex !== -1) {
          const normalizedMessage = (error?.error?.message || error?.message || '').toString().toLowerCase();

          if (error.status === 400 && normalizedMessage.includes('ya le ha dado like')) {
            // Mantener like activo y contador sin forzar petición adicional
            this.donations[currentIndex] = {
              ...this.donations[currentIndex],
              isLikedByCurrentUser: true,
              likesCount: Math.max(previousCount, optimisticCount)
            } as Donation;
            this.donations = [...this.donations];
            return;
          }

          this.donations[currentIndex] = {
            ...this.donations[currentIndex],
            isLikedByCurrentUser: previousLiked,
            likesCount: previousCount
          } as Donation;
          this.donations = [...this.donations];
        }
      }
    });
  }

  onDonationClicked(donationId: string): void {
    this.router.navigate(['/donations', donationId]);
  }

  onDonateClicked(donationId: string): void {
    if (!this.currentUserId) {
      this.router.navigate(['/auth/login'], { 
        queryParams: { returnUrl: '/donations/feed' } 
      });
      return;
    }

    this.router.navigate(['/donations', donationId], { 
      queryParams: { action: 'donate' } 
    });
  }

  onBack(): void {
    this.router.navigate(['/donations/feed']);
  }

  trackByDonationId(index: number, donation: Donation): string {
    return donation.id;
  }

  onDeleteDonation(donationId: string): void {
    if (!donationId) return;
    const confirmed = confirm('¿Eliminar esta publicación? Esta acción no se puede deshacer.');
    if (!confirmed) return;

    this.donationService.deletePublication(donationId).subscribe({
      next: () => {
        this.donations = this.donations.filter(d => d.id !== donationId);
      },
      error: (error: any) => {
        console.error('Error al eliminar publicación:', error);
        alert('No se pudo eliminar la publicación.');
      }
    });
  }

  onEditDonation(donationId: string): void {
    if (!donationId) return;
    this.router.navigate(['/donations', donationId, 'edit']);
  }
}

