import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';
import { PublicStatsComponent } from '../../../shared/components/public-stats/public-stats.component';
import { DonationStatusDonutChartComponent } from '../../../shared/components/donation-status-donut-chart/donation-status-donut-chart.component';
import { ArticlesListComponent } from '../../../shared/components/articles-list/articles-list.component';
import { PublicStatsService, UserPublicStats, UserTotals, ArticleSummary } from '../../../core/services/public-stats.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    PublicStatsComponent, 
    DonationStatusDonutChartComponent, 
    ArticlesListComponent
  ],
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.scss']
})
export class StatsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  userId: number = 0;
  username: string = '';
  userType: 'donor' | 'organization' = 'donor';
  statsData: any = {};
  totals: UserTotals | null = null;
  donationsByStatus: any[] = [];
  donationsAsDonatorByStatus: any[] = [];
  donatedArticles: ArticleSummary[] = [];
  receivedArticles: ArticleSummary[] = [];
  
  isLoading = true;
  error: string | null = null;
  publicStatsUrl: string = '';

  constructor(
    private publicStatsService: PublicStatsService,
    private authService: AuthService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    // Obtener usuario actual
    const user = this.authService.getCurrentUser();
    
    if (user && user.id) {
      this.userId = Number(user.id);
      this.username = user.username || user.email || 'Usuario';
      this.userType = user.role === 'organization' ? 'organization' : 'donor';
      this.publicStatsUrl = `${window.location.origin}/usuario/${user.id}/stats`;
      this.loadStats();
    } else {
      this.error = 'No se pudo obtener información del usuario';
      this.isLoading = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadStats(): void {
    this.isLoading = true;
    this.error = null;

    this.publicStatsService.getUserPublicStats(this.userId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (stats: UserPublicStats) => {
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

          // Asignar artículos donados y recibidos
          this.donatedArticles = stats.donatedArticles || [];
          this.receivedArticles = stats.receivedArticles || [];

          // Preparar datos para el componente de estadísticas
          this.statsData = {
            donations: stats.donations,
            posts: stats.posts,
            userType: stats.userType,
            userId: stats.userId
          };
        },
        error: (err) => {
          console.error('Error al cargar estadísticas:', err);
          this.error = 'No se pudieron cargar las estadísticas. Por favor, intenta nuevamente.';
          this.toastService.error('Error', 'No se pudieron cargar las estadísticas');
        }
      });
  }

  copyPublicLink(): void {
    navigator.clipboard.writeText(this.publicStatsUrl).then(() => {
      this.toastService.success('¡Éxito!', 'Link copiado al portapapeles');
    }).catch(() => {
      this.toastService.error('Error', 'No se pudo copiar el link');
    });
  }

  shareOnSocialMedia(platform: string): void {
    const url = encodeURIComponent(this.publicStatsUrl);
    const text = encodeURIComponent(`¡Mira mis estadísticas en DonacionApp!`);
    
    let shareUrl = '';
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
        break;
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${text}%20${url}`;
        break;
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }
  }

  reload(): void {
    this.loadStats();
  }
}
