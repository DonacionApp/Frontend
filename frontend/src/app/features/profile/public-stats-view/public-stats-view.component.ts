import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';
import { PublicStatsComponent } from '../../../shared/components/public-stats/public-stats.component';
import { DonationService } from '../../../core/services/donation.service';
import { PostsService } from '../../../core/services/posts.service';
import { UserProfileService } from '../../../core/services/user-profile.service';
import { OrganizationProfileService, OrganizationProfile } from '../../../core/services/organization-profile.service';
import { ToastService } from '../../../core/services/toast.service';

interface UserBasicInfo {
  id: string;
  name: string;
  userType: 'donor' | 'organization';
  avatar?: string;
  verified?: boolean;
  createdAt?: string;
}

@Component({
  selector: 'app-public-stats-view',
  standalone: true,
  imports: [CommonModule, PublicStatsComponent, RouterModule],
  templateUrl: './public-stats-view.component.html',
  styleUrls: ['./public-stats-view.component.scss']
})
export class PublicStatsViewComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  userId: string = '';
  userInfo: UserBasicInfo | null = null;
  statsData: any = {};
  userType: 'donor' | 'organization' = 'donor';
  
  isLoading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private donationService: DonationService,
    private postsService: PostsService,
    private userProfileService: UserProfileService,
    private organizationProfileService: OrganizationProfileService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    // Obtener el ID del usuario de la ruta
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const id = params.get('id');
        if (id) {
          this.userId = id;
          this.loadUserData();
        } else {
          this.error = 'ID de usuario no proporcionado';
          this.isLoading = false;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga la información básica del usuario y sus estadísticas
   */
  private loadUserData(): void {
    this.isLoading = true;
    this.error = null;

    // Primero intentar cargar como perfil de usuario/donante
    this.userProfileService.getUserMinimal(Number(this.userId))
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (profile) => {
          this.userInfo = {
            id: String(profile.id),
            name: profile.username || 'Usuario',
            userType: 'donor',
            avatar: profile.profilePhoto,
            verified: profile.emailVerified,
            createdAt: profile.createdAt
          };
          this.userType = 'donor';
          this.loadStatsData();
        },
        error: () => {
          // Si falla como usuario, intentar como organización
          this.loadOrganizationProfile();
        }
      });
  }

  /**
   * Intenta cargar el perfil como organización
   */
  private loadOrganizationProfile(): void {
    this.organizationProfileService.getOrganizationProfile(this.userId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (profile: OrganizationProfile) => {
          this.userInfo = {
            id: profile.id || this.userId,
            name: profile.name || profile.username || 'Organización',
            userType: 'organization',
            avatar: profile.logo,
            verified: profile.isVerified,
            createdAt: profile.createdAt
          };
          this.userType = 'organization';
          this.loadStatsData();
        },
        error: () => {
          this.error = 'No se pudo cargar el perfil del usuario';
          this.toastService.error('Error', 'El perfil solicitado no existe o no está disponible');
        }
      });
  }

  /**
   * Carga las estadísticas del usuario (donaciones y publicaciones)
   */
  private loadStatsData(): void {
    const donationsRequest = this.userType === 'donor'
      ? this.donationService.getDonationsByDonor(this.userId)
      : this.donationService.getDonationsByOrganization(this.userId);

    const postsRequest = this.postsService.getPostsByUserId(Number(this.userId));

    // Cargar donaciones
    donationsRequest
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (donations) => {
          this.statsData.donations = donations;
          this.statsData.userId = this.userId;
          this.statsData.userType = this.userType;
        },
        error: (err) => {
          console.error('Error al cargar donaciones:', err);
          this.statsData.donations = [];
        }
      });

    // Cargar publicaciones
    postsRequest
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (posts) => {
          this.statsData.posts = posts;
        },
        error: (err) => {
          console.error('Error al cargar publicaciones:', err);
          this.statsData.posts = [];
        }
      });
  }

  /**
   * Navega al perfil completo del usuario
   */
  goToProfile(): void {
    this.router.navigate(['/profile', this.userId]);
  }

  /**
   * Recarga los datos
   */
  reload(): void {
    this.loadUserData();
  }
}
