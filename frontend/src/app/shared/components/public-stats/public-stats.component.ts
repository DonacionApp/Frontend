import { Component, Input, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { KpiCardComponent } from '../kpi-card/kpi-card.component';
import { MonthlyDonationsChartComponent } from '../../../features/admin/stats/monthly-donations-chart/monthly-donations-chart.component';
import { PopularCategoriesChartComponent } from '../../../features/admin/stats/popular-categories-chart/popular-categories-chart.component';

interface KPICard {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  colorClass: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  loading: boolean;
}

export interface PublicStatsData {
  donations?: any[];
  posts?: any[];
  userType?: 'donor' | 'organization';
  userId?: number;
}

@Component({
  selector: 'app-public-stats',
  standalone: true,
  imports: [
    CommonModule,
    KpiCardComponent,
    MonthlyDonationsChartComponent,
    PopularCategoriesChartComponent
  ],
  templateUrl: './public-stats.component.html',
  styleUrls: ['./public-stats.component.scss']
})
export class PublicStatsComponent implements OnInit, OnDestroy, OnChanges {
  private destroy$ = new Subject<void>();

  @Input() data: PublicStatsData = {};
  @Input() userType: 'donor' | 'organization' = 'donor';
  @Input() showCharts: boolean = true;
  @Input() showTrends: boolean = true;

  private totalDonationsCount = 0;
  private totalPostsCount = 0;
  private donationsThisMonth = 0;
  private previousMonthDonations = 0;
  private postsThisMonth = 0;
  private previousMonthPosts = 0;

  monthlyDonationsData: Array<{month: string, donations: number, amount?: number}> = [];
  popularCategoriesData: Array<{category: string, count: number, percentage?: number}> = [];

  mainKPIs: KPICard[] = [];
  isLoading = true;

  constructor() {}

  ngOnInit(): void {
    this.initializeKPIs();
    this.processData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && !changes['data'].firstChange) {
      this.processData();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeKPIs(): void {
    if (this.userType === 'donor') {
      this.mainKPIs = [
        {
          title: 'Donaciones Realizadas',
          value: 0,
          subtitle: 'Total de donaciones',
          icon: 'donation',
          colorClass: 'bg-gradient-to-br from-orange-500 to-orange-600',
          trend: '0%',
          trendDirection: 'neutral',
          loading: true
        },
        {
          title: 'Donaciones Este Mes',
          value: 0,
          subtitle: 'En los últimos 30 días',
          icon: 'calendar',
          colorClass: 'bg-gradient-to-br from-blue-500 to-blue-600',
          trend: '0%',
          trendDirection: 'neutral',
          loading: true
        },
        {
          title: 'Publicaciones Creadas',
          value: 0,
          subtitle: 'Total de publicaciones',
          icon: 'document',
          colorClass: 'bg-gradient-to-br from-purple-500 to-purple-600',
          trend: '0%',
          trendDirection: 'neutral',
          loading: true
        },
        {
          title: 'Impacto Generado',
          value: 0,
          subtitle: 'Artículos donados',
          icon: 'heart',
          colorClass: 'bg-gradient-to-br from-pink-500 to-pink-600',
          trend: '0%',
          trendDirection: 'neutral',
          loading: true
        }
      ];
    } else {
      this.mainKPIs = [
        {
          title: 'Donaciones Recibidas',
          value: 0,
          subtitle: 'Total recibido',
          icon: 'donation',
          colorClass: 'bg-gradient-to-br from-green-500 to-green-600',
          trend: '0%',
          trendDirection: 'neutral',
          loading: true
        },
        {
          title: 'Donaciones Este Mes',
          value: 0,
          subtitle: 'En los últimos 30 días',
          icon: 'calendar',
          colorClass: 'bg-gradient-to-br from-blue-500 to-blue-600',
          trend: '0%',
          trendDirection: 'neutral',
          loading: true
        },
        {
          title: 'Publicaciones Activas',
          value: 0,
          subtitle: 'Solicitudes publicadas',
          icon: 'document',
          colorClass: 'bg-gradient-to-br from-purple-500 to-purple-600',
          trend: '0%',
          trendDirection: 'neutral',
          loading: true
        },
        {
          title: 'Tasa de Respuesta',
          value: '0%',
          subtitle: 'Publicaciones atendidas',
          icon: 'chart',
          colorClass: 'bg-gradient-to-br from-cyan-500 to-cyan-600',
          trend: '0%',
          trendDirection: 'neutral',
          loading: true
        }
      ];
    }
  }

  private processData(): void {
    this.isLoading = true;
    const donations = this.data.donations || [];
    const posts = this.data.posts || [];

    this.totalDonationsCount = donations.length;
    this.calculateDonationMetrics(donations);
    this.totalPostsCount = posts.length;
    this.calculatePostMetrics(posts);
    this.updateKPIs(donations, posts);

    if (this.showCharts) {
      this.calculateMonthlyDonations(donations);
      this.calculatePopularCategories(posts);
    }

    this.isLoading = false;
  }

  private calculateDonationMetrics(donations: any[]): void {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    this.donationsThisMonth = donations.filter(donation => {
      if (!donation.createdAt) return false;
      const donationDate = new Date(donation.createdAt);
      return donationDate >= startOfMonth;
    }).length;

    this.previousMonthDonations = donations.filter(donation => {
      if (!donation.createdAt) return false;
      const donationDate = new Date(donation.createdAt);
      return donationDate >= startOfPreviousMonth && donationDate <= endOfPreviousMonth;
    }).length;
  }

  private calculatePostMetrics(posts: any[]): void {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    this.postsThisMonth = posts.filter(post => {
      if (!post.createdAt) return false;
      const postDate = new Date(post.createdAt);
      return postDate >= startOfMonth;
    }).length;

    this.previousMonthPosts = posts.filter(post => {
      if (!post.createdAt) return false;
      const postDate = new Date(post.createdAt);
      return postDate >= startOfPreviousMonth && postDate <= endOfPreviousMonth;
    }).length;
  }

  private updateKPIs(donations: any[], posts: any[]): void {
    if (this.userType === 'donor') {
      this.mainKPIs[0].value = this.totalDonationsCount;
      this.mainKPIs[0].loading = false;
      this.updateTrend(this.mainKPIs[0], this.totalDonationsCount, this.totalDonationsCount - this.donationsThisMonth);

      this.mainKPIs[1].value = this.donationsThisMonth;
      this.mainKPIs[1].loading = false;
      this.updateTrend(this.mainKPIs[1], this.donationsThisMonth, this.previousMonthDonations);

      this.mainKPIs[2].value = this.totalPostsCount;
      this.mainKPIs[2].loading = false;
      this.updateTrend(this.mainKPIs[2], this.postsThisMonth, this.previousMonthPosts);

      this.mainKPIs[3].value = this.totalDonationsCount;
      this.mainKPIs[3].loading = false;
      this.mainKPIs[3].trend = 'Total';
      this.mainKPIs[3].trendDirection = 'neutral';
    } else {
      this.mainKPIs[0].value = this.totalDonationsCount;
      this.mainKPIs[0].loading = false;
      this.updateTrend(this.mainKPIs[0], this.totalDonationsCount, this.totalDonationsCount - this.donationsThisMonth);

      this.mainKPIs[1].value = this.donationsThisMonth;
      this.mainKPIs[1].loading = false;
      this.updateTrend(this.mainKPIs[1], this.donationsThisMonth, this.previousMonthDonations);

      this.mainKPIs[2].value = this.totalPostsCount;
      this.mainKPIs[2].loading = false;
      this.updateTrend(this.mainKPIs[2], this.postsThisMonth, this.previousMonthPosts);

      const postsWithDonations = posts.filter(post => 
        donations.some(d => d.postId === post.id)
      ).length;
      const responseRate = this.totalPostsCount > 0 
        ? ((postsWithDonations / this.totalPostsCount) * 100).toFixed(1)
        : '0';
      this.mainKPIs[3].value = `${responseRate}%`;
      this.mainKPIs[3].loading = false;
      this.mainKPIs[3].trend = `${postsWithDonations}/${this.totalPostsCount}`;
      this.mainKPIs[3].trendDirection = 'neutral';
    }
  }

  private updateTrend(kpi: KPICard, currentValue: number, previousValue: number): void {
    if (!this.showTrends) {
      kpi.trend = undefined;
      kpi.trendDirection = undefined;
      return;
    }

    if (previousValue > 0) {
      const change = ((currentValue - previousValue) / previousValue) * 100;
      kpi.trend = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
      kpi.trendDirection = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
    } else if (currentValue > 0) {
      kpi.trend = '+100%';
      kpi.trendDirection = 'up';
    } else {
      kpi.trend = '0%';
      kpi.trendDirection = 'neutral';
    }
  }

  private calculateMonthlyDonations(donations: any[]): void {
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const today = new Date();
    const last6Months: Array<{month: string, donations: number, amount?: number}> = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

      const monthDonations = donations.filter(donation => {
        if (!donation.createdAt) return false;
        const donationDate = new Date(donation.createdAt);
        return donationDate >= monthStart && donationDate <= monthEnd;
      });

      last6Months.push({
        month: monthNames[date.getMonth()],
        donations: monthDonations.length
      });
    }

    this.monthlyDonationsData = last6Months;
  }

  private calculatePopularCategories(posts: any[]): void {
    const categoryCount = new Map<string, number>();

    posts.forEach(post => {
      const categoryName = post.typePost?.type || 'Sin categoría';
      categoryCount.set(categoryName, (categoryCount.get(categoryName) || 0) + 1);
    });

    const totalPosts = posts.length;
    const categoriesArray = Array.from(categoryCount.entries()).map(([category, count]) => ({
      category,
      count,
      percentage: totalPosts > 0 ? (count / totalPosts) * 100 : 0
    }));

    this.popularCategoriesData = categoriesArray.sort((a, b) => b.count - a.count);
  }

  getIconPath(icon: string): string {
    const iconPaths: { [key: string]: string } = {
      'donation': 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      'calendar': 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      'document': 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      'heart': 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
      'chart': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
    };
    return iconPaths[icon] || iconPaths['chart'];
  }

  onKPIClick(kpi: KPICard): void {
    console.log('KPI clicked:', kpi.title);
  }
}
