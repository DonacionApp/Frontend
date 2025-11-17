import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';
import { PublicStatsComponent } from '../../../shared/components/public-stats/public-stats.component';
import { DonationStatusDonutChartComponent } from '../../../shared/components/donation-status-donut-chart/donation-status-donut-chart.component';
import { PublicStatsService, UserPublicStats, UserTotals } from '../../../core/services/public-stats.service';
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
  imports: [CommonModule, PublicStatsComponent, DonationStatusDonutChartComponent, RouterModule],
  templateUrl: './public-stats-view.component.html',
  styleUrls: ['./public-stats-view.component.scss']
})
export class PublicStatsViewComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  userId: string = '';
  userInfo: UserBasicInfo | null = null;
  statsData: any = {};
  totals: UserTotals | null = null;
  donationsByStatus: any[] = [];
  donationsAsDonatorByStatus: any[] = [];
  userType: 'donor' | 'organization' = 'donor';
  
  isLoading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private publicStatsService: PublicStatsService,
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

    // Usar el servicio integrado de estadísticas públicas
    this.publicStatsService.getUserPublicStats(this.userId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (stats: UserPublicStats) => {
          // Mapear la información del usuario
          this.userInfo = {
            id: String(stats.userId),
            name: stats.username,
            userType: stats.userType,
            avatar: stats.profilePhoto,
            verified: stats.verified,
            createdAt: stats.createdAt
          };
          this.userType = stats.userType;

          // Asignar totales para los KPIs
          this.totals = stats.totals || {
            totalDonationsAsDonator: stats.totalDonations,
            totalPosts: stats.totalPosts,
            chatsCount: 0,
            totalLikes: 0
          };

          // Asignar datos de gráficos de dona
          this.donationsByStatus = stats.donationsByStatus || [];
          this.donationsAsDonatorByStatus = stats.donationsAsDonatorByStatus || [];

          // Preparar datos para el componente de estadísticas
          this.statsData = {
            donations: stats.donations,
            posts: stats.posts,
            userType: stats.userType,
            userId: stats.userId
          };
        },
        error: () => {
          this.error = 'No se pudo cargar el perfil del usuario';
          this.toastService.error('Error', 'El perfil solicitado no existe o no está disponible');
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
