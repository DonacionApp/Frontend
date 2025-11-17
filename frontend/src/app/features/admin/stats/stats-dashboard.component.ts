import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, catchError, retry } from 'rxjs/operators';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { UserManagementService } from '../../../core/services/user-management.service';
import { PostsService } from '../../../core/services/posts.service';
import { DonationService } from '../../../core/services/donation.service';

interface KPICard {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  colorClass: string;
  trend?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
  };
  loading: boolean;
}

@Component({
  selector: 'app-stats-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, KpiCardComponent],
  templateUrl: './stats-dashboard.component.html',
  styleUrls: ['./stats-dashboard.component.scss']
})
export class StatsDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Variables para cálculos y tendencias
  private totalUsersCount = 0;
  private verifiedUsersCount = 0;
  private totalOrganizationsCount = 0;
  private donationsThisMonth = 0;
  private averageDailyDonations = 0;
  private totalDonationsCount = 0;
  private previousMonthDonations = 0;
  private previousWeekUsers = 0;
  private currentWeekUsers = 0;
  
  // Métricas de rendimiento de API
  private apiLoadStartTime = 0;
  private apiLoadEndTime = 0;

  // Control de errores y estado de conexión API
  apiErrors: {
    users: boolean;
    posts: boolean;
    donations: boolean;
  } = { users: false, posts: false, donations: false };

  isReconnecting = false;
  lastUpdateTime?: Date;
  hasAnyError = false;

  // Datos para Resumen Rápido
  activeUsersToday = 0;
  pendingVerifications = 0;
  donationsToday = 0;
  
  // Datos para Resumen Ejecutivo
  newUsersLast7Days = 0;
  newOrgsLast7Days = 0;

  // KPIs Principales (se actualizarán con datos reales y tendencias calculadas)
  mainKPIs: KPICard[] = [
    {
      title: 'Total Usuarios Activos',
      value: 0,
      subtitle: 'Usuarios registrados',
      icon: 'users',
      colorClass: 'bg-gradient-to-br from-blue-500 to-blue-600',
      trend: { value: '0%', direction: 'neutral' },
      loading: true
    },
    {
      title: 'Organizaciones Verificadas',
      value: 0,
      subtitle: 'Del total de organizaciones',
      icon: 'verified',
      colorClass: 'bg-gradient-to-br from-green-500 to-green-600',
      trend: { value: '0%', direction: 'neutral' },
      loading: true
    },
    {
      title: 'Donaciones Este Mes',
      value: 0,
      subtitle: 'Comparado con el mes anterior',
      icon: 'donation',
      colorClass: 'bg-gradient-to-br from-orange-500 to-orange-600',
      trend: { value: '0%', direction: 'neutral' },
      loading: true
    },
    {
      title: 'Publicaciones Activas',
      value: 0,
      subtitle: 'Publicaciones totales',
      icon: 'document',
      colorClass: 'bg-gradient-to-br from-purple-500 to-purple-600',
      trend: { value: '0%', direction: 'neutral' },
      loading: true
    }
  ];

  // KPIs Secundarios
  secondaryKPIs: KPICard[] = [
    {
      title: 'Tasa de Conversión',
      value: '0%',
      subtitle: 'Visitantes a donantes',
      icon: 'chart',
      colorClass: 'bg-gradient-to-br from-cyan-500 to-cyan-600',
      trend: { value: '+0%', direction: 'neutral' },
      loading: true
    },
    {
      title: 'Promedio de Donaciones',
      value: '$0',
      subtitle: 'Por usuario activo',
      icon: 'money',
      colorClass: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
      trend: { value: '+0%', direction: 'neutral' },
      loading: true
    },
    {
      title: 'Tiempo de Respuesta',
      value: '0ms',
      subtitle: 'Velocidad del sistema',
      icon: 'clock',
      colorClass: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
      trend: { value: '-0%', direction: 'neutral' },
      loading: true
    },
    {
      title: 'Satisfacción de Usuarios',
      value: '0%',
      subtitle: 'Basado en feedback',
      icon: 'star',
      colorClass: 'bg-gradient-to-br from-pink-500 to-pink-600',
      trend: { value: '+0%', direction: 'neutral' },
      loading: true
    }
  ];

  // Engagement KPIs
  engagementKPIs = [
    { label: 'Usuarios activos (7d)', value: 0, total: 100, percentage: 0, color: 'bg-blue-500' },
    { label: 'Organizaciones activas', value: 0, total: 100, percentage: 0, color: 'bg-green-500' },
    { label: 'Tasa de verificación', value: 0, total: 100, percentage: 0, color: 'bg-purple-500' },
    { label: 'Posts con interacción', value: 0, total: 100, percentage: 0, color: 'bg-orange-500' }
  ];

  // Estado del sistema
  systemHealth = {
    overall: 'Óptimo',
    status: 'success' as 'success' | 'warning' | 'error',
    metrics: [
      { label: 'API Status', value: 'Conectado', status: 'success' as 'success' | 'warning' | 'error' },
      { label: 'Database', value: 'Operativo', status: 'success' as 'success' | 'warning' | 'error' },
      { label: 'Latencia', value: '<100ms', status: 'success' as 'success' | 'warning' | 'error' }
    ]
  };

  // Periodos de tiempo disponibles
  selectedPeriod = '30d';
  timePeriods = [
    { label: '7 días', value: '7d' },
    { label: '30 días', value: '30d' },
    { label: '3 meses', value: '3m' },
    { label: '1 año', value: '1y' }
  ];

  constructor(
    private userService: UserManagementService,
    private postsService: PostsService,
    private donationService: DonationService
  ) {}

  ngOnInit(): void {
    this.loadStatistics();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga todas las estadísticas desde los endpoints de la API
   * Incluye reintentos automáticos y manejo de errores
   */
  loadStatistics(): void {
    this.isReconnecting = true;
    this.apiErrors = { users: false, posts: false, donations: false };
    this.hasAnyError = false;
    
    // Capturar tiempo de inicio para calcular respuesta
    this.apiLoadStartTime = Date.now();

    // Realizar llamadas en paralelo a los endpoints con reintentos
    forkJoin({
      users: this.userService.getAllUsers().pipe(
        retry(2), // Reintentar 2 veces en caso de error
        catchError((error) => {
          console.error('❌ Error cargando usuarios desde API:', error);
          this.apiErrors.users = true;
          this.hasAnyError = true;
          this.updateSystemHealth();
          return of([]);
        })
      ),
      posts: this.postsService.getAllPosts({ limit: 1000 }).pipe(
        retry(2),
        catchError((error) => {
          console.error('❌ Error cargando publicaciones desde API:', error);
          this.apiErrors.posts = true;
          this.hasAnyError = true;
          this.updateSystemHealth();
          return of([]);
        })
      )
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          console.log('✅ Datos cargados exitosamente desde API');
          
          // Capturar tiempo de fin para calcular respuesta
          this.apiLoadEndTime = Date.now();
          
          this.isReconnecting = false;
          this.lastUpdateTime = new Date();
          this.processStatisticsData(data);
        },
        error: (error) => {
          console.error('❌ Error crítico cargando estadísticas:', error);
          this.isReconnecting = false;
          this.hasAnyError = true;
          this.stopAllLoading();
          this.updateSystemHealth();
        }
      });
  }

  /**
   * Procesa los datos recibidos de la API y actualiza los KPIs
   */
  private processStatisticsData(data: any): void {
    // Procesar usuarios
    const allUsers = Array.isArray(data.users) ? data.users : [];
    const nonAdminUsers = allUsers.filter((user: any) => {
      const role = user.rol?.rol?.toLowerCase();
      return role !== 'admin';
    });

    this.totalUsersCount = nonAdminUsers.length;
    this.verifiedUsersCount = allUsers.filter((user: any) => user.verified).length;

    // Filtrar organizaciones
    const organizations = allUsers.filter((user: any) => {
      const role = user.rol?.rol?.toLowerCase();
      return role === 'organizacion' || role === 'organization';
    });

    this.totalOrganizationsCount = organizations.length;
    const verifiedOrgs = organizations.filter((org: any) => org.verified).length;

    // Actualizar KPI de usuarios con tendencia
    this.mainKPIs[0].value = this.totalUsersCount;
    this.mainKPIs[0].loading = false;
    this.calculateUserTrend(allUsers);

    // Actualizar KPI de organizaciones con tendencia
    this.mainKPIs[1].value = verifiedOrgs;
    this.mainKPIs[1].loading = false;
    this.calculateOrganizationTrend(organizations);

    // Procesar publicaciones
    const allPosts = Array.isArray(data.posts) ? data.posts : [];
    this.mainKPIs[3].value = allPosts.length;
    this.mainKPIs[3].loading = false;
    this.calculatePostsTrend(allPosts);

    // Cargar donaciones (llamada separada por user)
    this.loadDonations(allUsers);

    // Actualizar KPIs secundarios
    this.updateSecondaryKPIs(allUsers, organizations, allPosts);

    // Actualizar indicadores de engagement
    this.updateEngagementKPIs(allUsers, allPosts);

    // Calcular datos para Resumen Rápido
    this.calculateActiveUsersToday(allUsers);
    this.calculatePendingVerifications(allUsers);

    // Actualizar estado del sistema
    this.updateSystemHealth();
  }

  /**
   * Carga las donaciones para todos los usuarios
   * Incluye manejo de errores individual por usuario
   */
  private loadDonations(users: any[]): void {
    const donationRequests = users.map(user => 
      this.donationService.getDonationsByUserId(user.id).pipe(
        retry(1),
        catchError((error) => {
          console.warn(`⚠️ Error cargando donaciones para usuario ${user.id}:`, error);
          return of([]);
        })
      )
    );

    if (donationRequests.length === 0) {
      this.finalizeDonationMetrics(0, []);
      return;
    }

    forkJoin(donationRequests)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (donationsArrays) => {
          const allDonations = donationsArrays.flat().filter(d => d);
          this.totalDonationsCount = allDonations.length;
          this.calculateDonationsToday(allDonations);
          this.finalizeDonationMetrics(allDonations.length, allDonations);
          console.log(`✅ ${allDonations.length} donaciones cargadas desde API`);
        },
        error: (error) => {
          console.error('❌ Error cargando donaciones:', error);
          this.apiErrors.donations = true;
          this.hasAnyError = true;
          this.finalizeDonationMetrics(0, []);
          this.updateSystemHealth();
        }
      });
  }

  /**
   * Finaliza las métricas de donaciones
   */
  private finalizeDonationMetrics(totalDonations: number, allDonations: any[]): void {
    this.mainKPIs[2].value = totalDonations;
    this.mainKPIs[2].loading = false;
    this.calculateDonationMetrics(totalDonations, allDonations);
  }

  /**
   * Calcula métricas de donaciones y tendencias
   */
  private calculateDonationMetrics(totalDonations: number, allDonations: any[]): void {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    
    // Contar donaciones de este mes
    this.donationsThisMonth = allDonations.filter(donation => {
      if (!donation.createdAt) return false;
      const donationDate = new Date(donation.createdAt);
      return donationDate >= startOfMonth;
    }).length;

    // Contar donaciones del mes anterior
    this.previousMonthDonations = allDonations.filter(donation => {
      if (!donation.createdAt) return false;
      const donationDate = new Date(donation.createdAt);
      return donationDate >= startOfPreviousMonth && donationDate <= endOfPreviousMonth;
    }).length;

    // Calcular promedio diario (basado en el mes actual)
    const daysInMonth = now.getDate();
    this.averageDailyDonations = daysInMonth > 0 ? 
      Math.round(this.donationsThisMonth / daysInMonth) : 0;

    // Calcular tendencia
    this.calculateDonationTrend();
  }

  /**
   * Calcula la tendencia de usuarios (últimos 7 días vs 7 días anteriores)
   */
  private calculateUserTrend(users: any[]): void {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    this.currentWeekUsers = users.filter(user => {
      if (!user.createdAt) return false;
      const createdDate = new Date(user.createdAt);
      return createdDate >= sevenDaysAgo;
    }).length;
    
    // Guardar para el Resumen Ejecutivo
    this.newUsersLast7Days = this.currentWeekUsers;

    this.previousWeekUsers = users.filter(user => {
      if (!user.createdAt) return false;
      const createdDate = new Date(user.createdAt);
      return createdDate >= fourteenDaysAgo && createdDate < sevenDaysAgo;
    }).length;

    this.updateTrend(this.mainKPIs[0], this.currentWeekUsers, this.previousWeekUsers);
  }

  /**
   * Calcula la tendencia de organizaciones
   */
  private calculateOrganizationTrend(organizations: any[]): void {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const currentWeekOrgs = organizations.filter(org => {
      if (!org.createdAt) return false;
      const createdDate = new Date(org.createdAt);
      return createdDate >= sevenDaysAgo;
    }).length;
    
    // Guardar para el Resumen Ejecutivo
    this.newOrgsLast7Days = currentWeekOrgs;

    const previousWeekOrgs = organizations.filter(org => {
      if (!org.createdAt) return false;
      const createdDate = new Date(org.createdAt);
      return createdDate >= fourteenDaysAgo && createdDate < sevenDaysAgo;
    }).length;

    this.updateTrend(this.mainKPIs[1], currentWeekOrgs, previousWeekOrgs);
  }

  /**
   * Calcula la tendencia de donaciones (mes actual vs mes anterior)
   */
  private calculateDonationTrend(): void {
    this.updateTrend(this.mainKPIs[2], this.donationsThisMonth, this.previousMonthDonations);
  }

  /**
   * Calcula la tendencia de publicaciones
   */
  private calculatePostsTrend(posts: any[]): void {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const currentWeekPosts = posts.filter(post => {
      if (!post.createdAt) return false;
      const createdDate = new Date(post.createdAt);
      return createdDate >= sevenDaysAgo;
    }).length;

    const previousWeekPosts = posts.filter(post => {
      if (!post.createdAt) return false;
      const createdDate = new Date(post.createdAt);
      return createdDate >= fourteenDaysAgo && createdDate < sevenDaysAgo;
    }).length;

    this.updateTrend(this.mainKPIs[3], currentWeekPosts, previousWeekPosts);
  }

  /**
   * Actualiza la tendencia de un KPI basado en valores actual y previo
   */
  private updateTrend(kpi: KPICard, currentValue: number, previousValue: number): void {
    if (previousValue > 0) {
      const change = ((currentValue - previousValue) / previousValue) * 100;
      kpi.trend = {
        value: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`,
        direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
      };
    } else if (currentValue > 0) {
      kpi.trend = { value: '+100%', direction: 'up' };
    } else {
      kpi.trend = { value: '0%', direction: 'neutral' };
    }
  }

  /**
   * Actualiza los KPIs secundarios con métricas calculadas
   */
  private updateSecondaryKPIs(users: any[], organizations: any[], posts: any[]): void {
    const totalUsers = users.length;
    
    // Tasa de conversión (donantes / usuarios)
    const conversionRate = totalUsers > 0 ? 
      ((this.totalDonationsCount / totalUsers) * 100).toFixed(1) : '0';
    this.secondaryKPIs[0].value = `${conversionRate}%`;
    this.secondaryKPIs[0].loading = false;

    // Promedio de donaciones por usuario (cantidad)
    const avgDonations = totalUsers > 0 ?
      (this.totalDonationsCount / totalUsers).toFixed(2) : '0.00';
    this.secondaryKPIs[1].value = avgDonations;
    this.secondaryKPIs[1].loading = false;

    // Tiempo de respuesta promedio (basado en tiempo de carga de APIs)
    const responseTime = this.calculateAverageResponseTime();
    this.secondaryKPIs[2].value = responseTime;
    this.secondaryKPIs[2].loading = false;

    // Índice de Satisfacción Compuesto
    const satisfaction = this.calculateSatisfactionIndex(users, posts);
    this.secondaryKPIs[3].value = `${satisfaction}%`;
    this.secondaryKPIs[3].loading = false;
  }

  /**
   * Calcula el tiempo promedio de respuesta de las APIs
   */
  private calculateAverageResponseTime(): string {
    if (this.apiLoadStartTime === 0 || this.apiLoadEndTime === 0) {
      return 'Calculando...';
    }
    
    const responseTimeMs = this.apiLoadEndTime - this.apiLoadStartTime;
    
    if (responseTimeMs < 1000) {
      return `${responseTimeMs}ms`;
    } else {
      return `${(responseTimeMs / 1000).toFixed(2)}s`;
    }
  }

  /**
   * Calcula un índice de satisfacción compuesto basado en múltiples métricas:
   * - 30% Tasa de usuarios activos (últimos 7 días)
   * - 25% Tasa de verificación completada
   * - 25% Tasa de interacción en posts
   * - 20% Ausencia de bloqueos
   */
  private calculateSatisfactionIndex(users: any[], posts: any[]): number {
    if (users.length === 0) return 0;

    // 1. Tasa de usuarios activos (últimos 7 días) - Peso: 30%
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeUsers = users.filter(u => {
      if (!u.lastLogin) return false;
      return new Date(u.lastLogin) >= sevenDaysAgo;
    }).length;
    const activeRate = (activeUsers / users.length) * 100;

    // 2. Tasa de verificación completada - Peso: 25%
    const verifiedUsers = users.filter(u => u.verified || u.emailVerified).length;
    const verificationRate = (verifiedUsers / users.length) * 100;

    // 3. Tasa de interacción en posts - Peso: 25%
    let interactionRate = 0;
    if (posts.length > 0) {
      const postsWithInteraction = posts.filter(p => 
        (p.likesCount && p.likesCount > 0) || 
        (p.commentsCount && p.commentsCount > 0) ||
        (p.sharesCount && p.sharesCount > 0)
      ).length;
      interactionRate = (postsWithInteraction / posts.length) * 100;
    }

    // 4. Ausencia de bloqueos - Peso: 20%
    const blockedUsers = users.filter(u => u.block === true).length;
    const nonBlockedRate = ((users.length - blockedUsers) / users.length) * 100;

    // Calcular índice compuesto
    const satisfactionIndex = (
      (activeRate * 0.30) +
      (verificationRate * 0.25) +
      (interactionRate * 0.25) +
      (nonBlockedRate * 0.20)
    );

    return Math.round(satisfactionIndex);
  }

  /**
   * Calcula usuarios activos en las últimas 24 horas
   */
  private calculateActiveUsersToday(users: any[]): void {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    this.activeUsersToday = users.filter((user: any) => {
      if (!user.lastLogin) return false;
      const lastActivity = new Date(user.lastLogin);
      return lastActivity >= oneDayAgo;
    }).length;
  }

  /**
   * Calcula organizaciones pendientes de verificación
   */
  private calculatePendingVerifications(users: any[]): void {
    const organizations = users.filter((user: any) => {
      const role = user.rol?.rol?.toLowerCase();
      return role === 'organizacion' || role === 'organization';
    });
    
    this.pendingVerifications = organizations.filter((org: any) => !org.verified).length;
  }

  /**
   * Calcula donaciones de hoy
   */
  private calculateDonationsToday(allDonations: any[]): void {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    this.donationsToday = allDonations.filter((donation: any) => {
      if (!donation.createdAt) return false;
      const donationDate = new Date(donation.createdAt);
      return donationDate >= startOfDay;
    }).length;
  }

  /**
   * Actualiza los indicadores de engagement
   */
  private updateEngagementKPIs(users: any[], posts: any[]): void {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Usuarios activos en los últimos 7 días (basado en lastLogin)
    const activeUsers = users.filter(u => {
      if (!u.lastLogin) return false;
      return new Date(u.lastLogin) >= sevenDaysAgo;
    }).length;
    
    this.engagementKPIs[0].value = activeUsers;
    this.engagementKPIs[0].total = this.totalUsersCount || 1;
    this.engagementKPIs[0].percentage = (activeUsers / (this.totalUsersCount || 1)) * 100;

    // Organizaciones activas (basado en lastLogin)
    const orgs = users.filter(u => {
      const role = u.rol?.rol?.toLowerCase();
      return role === 'organizacion' || role === 'organization';
    });
    const activeOrgs = orgs.filter(o => {
      if (!o.lastLogin) return false;
      return new Date(o.lastLogin) >= sevenDaysAgo;
    }).length;
    
    this.engagementKPIs[1].value = activeOrgs;
    this.engagementKPIs[1].total = this.totalOrganizationsCount || 1;
    this.engagementKPIs[1].percentage = (activeOrgs / (this.totalOrganizationsCount || 1)) * 100;

    // Tasa de verificación
    this.engagementKPIs[2].value = this.verifiedUsersCount;
    this.engagementKPIs[2].total = this.totalUsersCount || 1;
    this.engagementKPIs[2].percentage = (this.verifiedUsersCount / (this.totalUsersCount || 1)) * 100;

    // Posts con interacción
    const postsWithLikes = posts.filter(p => (p.likesCount || 0) > 0).length;
    this.engagementKPIs[3].value = postsWithLikes;
    this.engagementKPIs[3].total = posts.length || 1;
    this.engagementKPIs[3].percentage = (postsWithLikes / (posts.length || 1)) * 100;
  }

  /**
   * Actualiza el estado de salud del sistema basado en errores de API
   */
  private updateSystemHealth(): void {
    const errorCount = Object.values(this.apiErrors).filter(e => e).length;

    if (errorCount === 0) {
      this.systemHealth.overall = 'Óptimo';
      this.systemHealth.status = 'success';
      this.systemHealth.metrics[0].value = 'Conectado';
      this.systemHealth.metrics[0].status = 'success';
    } else if (errorCount === 1) {
      this.systemHealth.overall = 'Advertencia';
      this.systemHealth.status = 'warning';
      this.systemHealth.metrics[0].value = 'Parcial';
      this.systemHealth.metrics[0].status = 'warning';
    } else {
      this.systemHealth.overall = 'Crítico';
      this.systemHealth.status = 'error';
      this.systemHealth.metrics[0].value = 'Con errores';
      this.systemHealth.metrics[0].status = 'error';
    }

    // Actualizar latencia basada en errores
    if (this.hasAnyError) {
      this.systemHealth.metrics[2].value = '>200ms';
      this.systemHealth.metrics[2].status = 'warning';
    }
  }

  /**
   * Detiene todos los estados de carga
   */
  private stopAllLoading(): void {
    this.mainKPIs.forEach(kpi => kpi.loading = false);
    this.secondaryKPIs.forEach(kpi => kpi.loading = false);
  }

  // Métodos de interfaz de usuario

  changePeriod(period: string): void {
    this.selectedPeriod = period;
    this.loadStatistics();
  }

  selectPeriod(period: string): void {
    this.changePeriod(period);
  }

  getIconPath(icon: string): string {
    const iconPaths: { [key: string]: string } = {
      'users': 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
      'verified': 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      'donation': 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      'document': 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      'chart': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      'money': 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      'clock': 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      'star': 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z'
    };
    return iconPaths[icon] || iconPaths['chart'];
  }

  getDonationsThisMonth(): number {
    return this.donationsThisMonth;
  }

  getAverageDailyDonations(): number {
    return this.averageDailyDonations;
  }

  getVerifiedUsersCount(): number {
    return this.verifiedUsersCount;
  }

  getTotalOrganizations(): number {
    return this.totalOrganizationsCount;
  }

  onKPIClick(kpi: KPICard): void {
    console.log('KPI clicked:', kpi.title);
  }

  exportData(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const periodReadable = this.getReadablePeriod();

    // Generar CSV estructurado con 7 secciones
    const csvRows = [
      // SECCIÓN 1: Encabezado
      `Reporte de Estadísticas - ${periodReadable}`,
      `Fecha de generación: ${new Date().toLocaleString('es-ES')}`,
      `Última actualización: ${this.lastUpdateTime?.toLocaleString('es-ES') || 'N/A'}`,
      `Estado del sistema: ${this.systemHealth.overall}`,
      '',

      // SECCIÓN 2: Resumen Ejecutivo
      '=== RESUMEN EJECUTIVO ===',
      `Total de Usuarios: ${this.totalUsersCount}`,
      `Organizaciones Totales: ${this.totalOrganizationsCount}`,
      `Donaciones Totales: ${this.totalDonationsCount}`,
      `Donaciones Este Mes: ${this.donationsThisMonth}`,
      `Promedio Diario de Donaciones: ${this.averageDailyDonations}`,
      '',

      // SECCIÓN 3: KPIs Principales
      '=== INDICADORES CLAVE (KPIs) ===',
      'Título,Valor,Subtítulo,Tendencia,Dirección',
      ...this.mainKPIs.map(kpi => 
        `"${kpi.title}",${kpi.value},"${kpi.subtitle}","${kpi.trend?.value || 'N/A'}",${kpi.trend?.direction || 'neutral'}`
      ),
      '',

      // SECCIÓN 4: Métricas de Rendimiento
      '=== MÉTRICAS DE RENDIMIENTO ===',
      'Título,Valor,Subtítulo,Tendencia',
      ...this.secondaryKPIs.map(kpi =>
        `"${kpi.title}",${kpi.value},"${kpi.subtitle}","${kpi.trend?.value || 'N/A'}"`
      ),
      '',

      // SECCIÓN 5: Indicadores de Engagement
      '=== INDICADORES DE ACTIVIDAD ===',
      'Indicador,Valor Actual,Total,Porcentaje',
      ...this.engagementKPIs.map(kpi =>
        `"${kpi.label}",${kpi.value},${kpi.total},${kpi.percentage.toFixed(1)}%`
      ),
      '',

      // SECCIÓN 6: Análisis Comparativo
      '=== ANÁLISIS COMPARATIVO ===',
      `Usuarios - Semana Actual: ${this.currentWeekUsers}`,
      `Usuarios - Semana Anterior: ${this.previousWeekUsers}`,
      `Donaciones - Mes Actual: ${this.donationsThisMonth}`,
      `Donaciones - Mes Anterior: ${this.previousMonthDonations}`,
      `Ratio Usuarios/Organizaciones: ${this.totalOrganizationsCount > 0 ? (this.totalUsersCount / this.totalOrganizationsCount).toFixed(2) : 'N/A'}`,
      `Ratio Donaciones/Usuarios: ${this.totalUsersCount > 0 ? (this.totalDonationsCount / this.totalUsersCount).toFixed(2) : 'N/A'}`,
      '',

      // SECCIÓN 7: Notas y Observaciones
      '=== ESTADO DEL SISTEMA ===',
      `Estado General: ${this.systemHealth.overall}`,
      `Errores de API - Usuarios: ${this.apiErrors.users ? 'SÍ' : 'NO'}`,
      `Errores de API - Publicaciones: ${this.apiErrors.posts ? 'SÍ' : 'NO'}`,
      `Errores de API - Donaciones: ${this.apiErrors.donations ? 'SÍ' : 'NO'}`,
      '',
      '=== FIN DEL REPORTE ==='
    ];

    // Crear archivo CSV con BOM UTF-8 para Excel
    const BOM = '\uFEFF';
    const csvContent = BOM + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `estadisticas-${timestamp}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    console.log('✅ Reporte exportado exitosamente');
  }

  private getReadablePeriod(): string {
    const period = this.timePeriods.find(p => p.value === this.selectedPeriod);
    return period?.label || this.selectedPeriod;
  }

  private getKPIStatus(kpi: KPICard): string {
    if (kpi.loading) return 'Cargando';
    const trend = kpi.trend?.direction;
    if (trend === 'up') return 'Mejorando';
    if (trend === 'down') return 'Decreciendo';
    return 'Estable';
  }
}
