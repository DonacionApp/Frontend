import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { UserManagementService } from '../../../core/services/user-management.service';
import { PostsService } from '../../../core/services/posts.service';
import { DonationService } from '../../../core/services/donation.service';

interface KPIData {
  title: string;
  value: number;
  subtitle: string;
  iconPath: string;
  colorClass: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  loading: boolean;
  valuePrefix?: string;
  valueSuffix?: string;
}

@Component({
  selector: 'app-kpi-test',
  standalone: true,
  imports: [CommonModule, KpiCardComponent],
  template: `
    <div class="min-h-screen bg-gray-50 p-6">
      <div class="max-w-7xl mx-auto">
        <div class="flex items-center justify-between mb-8">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Panel de Indicadores</h1>
            <p class="text-gray-600 mt-2">Métricas y estadísticas del sistema</p>
          </div>
          <button 
            (click)="reloadData()"
            [disabled]="isReloading"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors">
            <svg class="w-5 h-5" [class.animate-spin]="isReloading" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            {{ isReloading ? 'Actualizando...' : 'Actualizar' }}
          </button>
        </div>
        
        <!-- Grid de KPIs con Datos Reales -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          
          <!-- KPI 1: Total Usuarios -->
          <app-kpi-card
            *ngFor="let kpi of mainKPIs"
            [title]="kpi.title"
            [value]="kpi.value"
            [subtitle]="kpi.subtitle"
            [iconPath]="kpi.iconPath"
            [colorClass]="kpi.colorClass"
            [trend]="kpi.trend"
            [trendDirection]="kpi.trendDirection"
            [loading]="kpi.loading"
            [valuePrefix]="kpi.valuePrefix"
            [valueSuffix]="kpi.valueSuffix">
          </app-kpi-card>
        </div>

        <!-- KPIs Secundarios -->
        <div class="mb-6">
          <h2 class="text-xl font-semibold text-gray-800">Métricas de Rendimiento</h2>
          <div class="h-1 w-20 bg-blue-600 mt-2 rounded"></div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <app-kpi-card
            *ngFor="let kpi of secondaryKPIs"
            [title]="kpi.title"
            [value]="kpi.value"
            [subtitle]="kpi.subtitle"
            [iconPath]="kpi.iconPath"
            [colorClass]="kpi.colorClass"
            [trend]="kpi.trend"
            [trendDirection]="kpi.trendDirection"
            [loading]="kpi.loading"
            [valuePrefix]="kpi.valuePrefix"
            [valueSuffix]="kpi.valueSuffix">
          </app-kpi-card>
        </div>

        <!-- Información del Sistema -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-800">Estado del Sistema</h2>
            <span class="flex items-center gap-2">
              <span class="relative flex h-3 w-3">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" *ngIf="!hasError"></span>
                <span class="relative inline-flex rounded-full h-3 w-3" [class.bg-green-500]="!hasError" [class.bg-red-500]="hasError"></span>
              </span>
              <span class="text-sm font-medium" [class.text-green-600]="!hasError" [class.text-red-600]="hasError">
                {{ hasError ? 'Desconectado' : 'Operativo' }}
              </span>
            </span>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <div>
                <p class="text-xs text-gray-500">Última actualización</p>
                <p class="text-sm font-medium text-gray-900">{{ lastUpdate | date:'short' }}</p>
              </div>
            </div>
            <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path>
              </svg>
              <div>
                <p class="text-xs text-gray-500">Fuente de datos</p>
                <p class="text-sm font-medium text-gray-900">API REST</p>
              </div>
            </div>
          </div>
          
          <div *ngIf="errorMessage" class="mt-4 p-3 bg-red-50 border-l-4 border-red-500 rounded">
            <div class="flex items-start gap-2">
              <svg class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
              </svg>
              <div>
                <p class="text-sm font-medium text-red-800">Error de conexión</p>
                <p class="text-xs text-red-700 mt-1">{{ errorMessage }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class KpiTestComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  isReloading = false;
  lastUpdate = new Date();
  hasError = false;
  errorMessage = '';

  mainKPIs: KPIData[] = [
    {
      title: 'Total Usuarios',
      value: 0,
      subtitle: 'Usuarios registrados',
      iconPath: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
      colorClass: 'bg-gradient-to-br from-blue-500 to-blue-600',
      trend: '+0%',
      trendDirection: 'neutral',
      loading: true
    },
    {
      title: 'Organizaciones',
      value: 0,
      subtitle: 'Organizaciones registradas',
      iconPath: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      colorClass: 'bg-gradient-to-br from-green-500 to-green-600',
      trend: '+0%',
      trendDirection: 'neutral',
      loading: true
    },
    {
      title: 'Donaciones',
      value: 0,
      subtitle: 'Total de donaciones',
      iconPath: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7',
      colorClass: 'bg-gradient-to-br from-orange-500 to-orange-600',
      trend: '+0%',
      trendDirection: 'neutral',
      loading: true
    },
    {
      title: 'Publicaciones',
      value: 0,
      subtitle: 'Posts creados',
      iconPath: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      colorClass: 'bg-gradient-to-br from-purple-500 to-purple-600',
      trend: '+0%',
      trendDirection: 'neutral',
      loading: true
    }
  ];

  secondaryKPIs: KPIData[] = [
    {
      title: 'Usuarios Verificados',
      value: 0,
      subtitle: 'Del total de usuarios',
      iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      colorClass: 'bg-gradient-to-br from-cyan-500 to-cyan-600',
      loading: true,
      valueSuffix: '%'
    },
    {
      title: 'Posts con Interacción',
      value: 0,
      subtitle: 'Posts con likes',
      iconPath: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
      colorClass: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
      loading: true,
      valueSuffix: '%'
    },
    {
      title: 'Promedio Donaciones',
      value: 0,
      subtitle: 'Por usuario donante',
      iconPath: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      colorClass: 'bg-gradient-to-br from-pink-500 to-pink-600',
      loading: true
    }
  ];

  constructor(
    private userService: UserManagementService,
    private postsService: PostsService,
    private donationService: DonationService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    this.hasError = false;
    this.errorMessage = '';
    
    forkJoin({
      users: this.userService.getAllUsers().pipe(catchError(() => of([]))),
      posts: this.postsService.getAllPosts({ limit: 1000 }).pipe(catchError(() => of([])))
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          const allUsers = Array.isArray(data.users) ? data.users : [];
          const allPosts = Array.isArray(data.posts) ? data.posts : [];

          // Total usuarios (excluyendo admins)
          const totalUsers = allUsers.filter(user => {
            const role = user.rol?.rol?.toLowerCase();
            return role !== 'admin';
          }).length;

          // Total organizaciones
          const organizations = allUsers.filter(user => {
            const role = user.rol?.rol?.toLowerCase();
            return role === 'organizacion' || role === 'organization';
          });

          // Usuarios verificados
          const verifiedUsers = allUsers.filter(user => user.verified).length;
          const verifiedPercentage = totalUsers > 0 ? ((verifiedUsers / totalUsers) * 100).toFixed(1) : '0';

          // Total de posts (todos los posts son válidos si existen)
          const totalPostsCount = allPosts.length;

          // Actualizar KPIs principales
          this.mainKPIs[0].value = totalUsers;
          this.mainKPIs[0].loading = false;

          this.mainKPIs[1].value = organizations.length;
          this.mainKPIs[1].loading = false;

          this.mainKPIs[3].value = totalPostsCount;
          this.mainKPIs[3].loading = false;

          // KPIs secundarios
          this.secondaryKPIs[0].value = parseFloat(verifiedPercentage);
          this.secondaryKPIs[0].loading = false;

          // Posts con likes (interacción)
          const postsWithLikes = allPosts.filter(post => post.likesCount > 0).length;
          const postsWithLikesPercentage = totalPostsCount > 0 ? 
            ((postsWithLikes / totalPostsCount) * 100).toFixed(1) : '0';
          
          this.secondaryKPIs[1].value = parseFloat(postsWithLikesPercentage);
          this.secondaryKPIs[1].loading = false;

          // Cargar donaciones
          this.loadDonations(allUsers);

          this.lastUpdate = new Date();
        },
        error: (error) => {
          console.error('Error loading data:', error);
          this.hasError = true;
          this.errorMessage = 'No se pudieron cargar los datos del backend';
          this.stopAllLoading();
        }
      });
  }

  private loadDonations(users: any[]): void {
    const donationRequests = users.map(user => 
      this.donationService.getDonationsByUserId(user.id).pipe(
        catchError(() => of([]))
      )
    );

    if (donationRequests.length === 0) {
      this.mainKPIs[2].value = 0;
      this.mainKPIs[2].loading = false;
      this.secondaryKPIs[2].value = 0;
      this.secondaryKPIs[2].loading = false;
      return;
    }

    forkJoin(donationRequests)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (donationsArrays) => {
          const totalDonations = donationsArrays.reduce((total, donations) => {
            return total + (Array.isArray(donations) ? donations.length : 0);
          }, 0);

          // Contar usuarios que han donado
          const usersWithDonations = donationsArrays.filter(donations => 
            Array.isArray(donations) && donations.length > 0
          ).length;

          // Promedio de donaciones por usuario donante
          const avgDonations = usersWithDonations > 0 ? 
            (totalDonations / usersWithDonations).toFixed(1) : '0';

          this.mainKPIs[2].value = totalDonations;
          this.mainKPIs[2].loading = false;

          this.secondaryKPIs[2].value = parseFloat(avgDonations);
          this.secondaryKPIs[2].loading = false;
        },
        error: () => {
          this.mainKPIs[2].value = 0;
          this.mainKPIs[2].loading = false;
          this.secondaryKPIs[2].value = 0;
          this.secondaryKPIs[2].loading = false;
        }
      });
  }

  private stopAllLoading(): void {
    this.mainKPIs.forEach(kpi => kpi.loading = false);
    this.secondaryKPIs.forEach(kpi => kpi.loading = false);
  }

  reloadData(): void {
    this.isReloading = true;
    this.mainKPIs.forEach(kpi => kpi.loading = true);
    this.secondaryKPIs.forEach(kpi => kpi.loading = true);
    
    this.loadData();
    
    setTimeout(() => {
      this.isReloading = false;
    }, 1000);
  }
}
