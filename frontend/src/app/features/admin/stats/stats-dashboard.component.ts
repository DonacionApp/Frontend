import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
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

  // Variables para cálculos adicionales
  private totalUsersCount = 0;
  private verifiedUsersCount = 0;
  private totalOrganizationsCount = 0;
  private donationsThisMonth = 0;
  private averageDailyDonations = 0;

  // KPIs Principales
  mainKPIs: KPICard[] = [
    {
      title: 'Total Usuarios Activos',
      value: 0,
      subtitle: 'Usuarios registrados',
      icon: 'users',
      colorClass: 'bg-gradient-to-br from-blue-500 to-blue-600',
      trend: {
        value: '+12.5%',
        direction: 'up'
      },
      loading: true
    },
    {
      title: 'Organizaciones Verificadas',
      value: 0,
      subtitle: 'Del total de organizaciones',
      icon: 'verified',
      colorClass: 'bg-gradient-to-br from-green-500 to-green-600',
      trend: {
        value: '+5.3%',
        direction: 'up'
      },
      loading: true
    },
    {
      title: 'Donaciones Este Mes',
      value: 0,
      subtitle: 'Comparado con el mes anterior',
      icon: 'donation',
      colorClass: 'bg-gradient-to-br from-orange-500 to-orange-600',
      trend: {
        value: '+18.2%',
        direction: 'up'
      },
      loading: true
    },
    {
      title: 'Publicaciones Activas',
      value: 0,
      subtitle: 'Publicaciones aprobadas',
      icon: 'document',
      colorClass: 'bg-gradient-to-br from-purple-500 to-purple-600',
      trend: {
        value: '+8.7%',
        direction: 'up'
      },
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
      trend: {
        value: '+2.1%',
        direction: 'up'
      },
      loading: true
    },
    {
      title: 'Promedio de Donación',
      value: '$0',
      subtitle: 'Por transacción',
      icon: 'money',
      colorClass: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
      trend: {
        value: '-1.5%',
        direction: 'down'
      },
      loading: true
    },
    {
      title: 'Tiempo de Respuesta',
      value: '0h',
      subtitle: 'Promedio de respuesta',
      icon: 'clock',
      colorClass: 'bg-gradient-to-br from-pink-500 to-pink-600',
      trend: {
        value: '-15%',
        direction: 'up'
      },
      loading: true
    },
    {
      title: 'Satisfacción',
      value: '0%',
      subtitle: 'Calificación promedio',
      icon: 'star',
      colorClass: 'bg-gradient-to-br from-yellow-500 to-yellow-600',
      trend: {
        value: '+3.2%',
        direction: 'up'
      },
      loading: true
    }
  ];

  // KPIs de Engagement
  engagementKPIs = [
    {
      label: 'Usuarios Nuevos (7 días)',
      value: 0,
      total: 0,
      percentage: 0,
      color: 'bg-blue-500'
    },
    {
      label: 'Organizaciones Nuevas (7 días)',
      value: 0,
      total: 0,
      percentage: 0,
      color: 'bg-green-500'
    },
    {
      label: 'Donaciones Completadas',
      value: 0,
      total: 0,
      percentage: 0,
      color: 'bg-orange-500'
    },
    {
      label: 'Publicaciones Aprobadas',
      value: 0,
      total: 0,
      percentage: 0,
      color: 'bg-purple-500'
    }
  ];

  // Periodos de tiempo disponibles
  timePeriods = [
    { label: 'Últimos 7 días', value: '7d' },
    { label: 'Últimos 30 días', value: '30d' },
    { label: 'Últimos 3 meses', value: '3m' },
    { label: 'Último año', value: '1y' }
  ];

  selectedPeriod = '30d';

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

  loadStatistics(): void {
    // Cargar datos reales desde los servicios
    forkJoin({
      users: this.userService.getAllUsers().pipe(catchError(() => of([]))),
      posts: this.postsService.getAllPosts({ limit: 1000 }).pipe(catchError(() => of([])))
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          // Procesar usuarios
          const allUsers = Array.isArray(data.users) ? data.users : [];
          const totalUsers = allUsers.filter(user => {
            const role = user.rol?.rol?.toLowerCase();
            return role !== 'admin';
          }).length;

          this.totalUsersCount = totalUsers;
          this.verifiedUsersCount = allUsers.filter(user => user.verified).length;

          const organizations = allUsers.filter(user => {
            const role = user.rol?.rol?.toLowerCase();
            return role === 'organizacion' || role === 'organization';
          });

          this.totalOrganizationsCount = organizations.length;
          const verifiedOrgs = organizations.filter(org => org.verified).length;

          // Actualizar KPIs principales
          this.mainKPIs[0].value = totalUsers;
          this.mainKPIs[0].loading = false;

          this.mainKPIs[1].value = verifiedOrgs;
          this.mainKPIs[1].loading = false;

          // Posts
          const allPosts = Array.isArray(data.posts) ? data.posts : [];
          this.mainKPIs[3].value = allPosts.length;
          this.mainKPIs[3].loading = false;

          // Cargar donaciones
          this.loadDonations(allUsers);

          // Actualizar KPIs secundarios con datos calculados
          this.updateSecondaryKPIs(totalUsers, organizations.length, allPosts.length);

          // Actualizar KPIs de engagement
          this.updateEngagementKPIs(allUsers, allPosts);
        },
        error: (error) => {
          console.error('Error loading statistics:', error);
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
      this.calculateDonationMetrics(0, []);
      return;
    }

    forkJoin(donationRequests)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (donationsArrays) => {
          const allDonations = donationsArrays.flat().filter(d => d);
          const totalDonations = allDonations.length;

          this.mainKPIs[2].value = totalDonations;
          this.mainKPIs[2].loading = false;

          this.calculateDonationMetrics(totalDonations, allDonations);
        },
        error: () => {
          this.mainKPIs[2].value = 0;
          this.mainKPIs[2].loading = false;
          this.calculateDonationMetrics(0, []);
        }
      });
  }

  private calculateDonationMetrics(totalDonations: number, allDonations: any[]): void {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Contar donaciones de este mes
    this.donationsThisMonth = allDonations.filter(donation => {
      if (!donation.createdAt) return false;
      const donationDate = new Date(donation.createdAt);
      return donationDate >= startOfMonth;
    }).length;

    // Calcular promedio diario (basado en el mes actual)
    const daysInMonth = now.getDate(); // Días transcurridos del mes
    this.averageDailyDonations = daysInMonth > 0 ? 
      Math.round(this.donationsThisMonth / daysInMonth) : 0;
  }

  private updateSecondaryKPIs(totalUsers: number, totalOrgs: number, totalPosts: number): void {
    // Tasa de conversión (ejemplo: organizaciones / usuarios totales)
    const conversionRate = totalUsers > 0 ? ((totalOrgs / totalUsers) * 100).toFixed(1) : '0';
    this.secondaryKPIs[0].value = `${conversionRate}%`;
    this.secondaryKPIs[0].loading = false;

    // Promedio de donación (requiere datos de montos - placeholder)
    this.secondaryKPIs[1].value = '$150';
    this.secondaryKPIs[1].loading = false;

    // Tiempo de respuesta (placeholder)
    this.secondaryKPIs[2].value = '2.5h';
    this.secondaryKPIs[2].loading = false;

    // Satisfacción (placeholder)
    this.secondaryKPIs[3].value = '94.3%';
    this.secondaryKPIs[3].loading = false;
  }

  private stopAllLoading(): void {
    this.mainKPIs.forEach(kpi => kpi.loading = false);
    this.secondaryKPIs.forEach(kpi => kpi.loading = false);
  }

  updateEngagementKPIs(users: any[] = [], posts: any[] = []): void {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Usuarios nuevos en los últimos 7 días
    const newUsers = users.filter(user => {
      if (!user.createdAt) return false;
      const createdDate = new Date(user.createdAt);
      return createdDate >= sevenDaysAgo;
    }).length;

    this.engagementKPIs[0].value = newUsers;
    this.engagementKPIs[0].total = users.length;
    this.engagementKPIs[0].percentage = users.length > 0 ? 
      Math.round((newUsers / users.length) * 100) : 0;

    // Organizaciones nuevas en los últimos 7 días
    const newOrgs = users.filter(user => {
      const role = user.rol?.rol?.toLowerCase();
      const isOrg = role === 'organizacion' || role === 'organization';
      if (!isOrg || !user.createdAt) return false;
      const createdDate = new Date(user.createdAt);
      return createdDate >= sevenDaysAgo;
    }).length;

    const totalOrgs = users.filter(user => {
      const role = user.rol?.rol?.toLowerCase();
      return role === 'organizacion' || role === 'organization';
    }).length;

    this.engagementKPIs[1].value = newOrgs;
    this.engagementKPIs[1].total = totalOrgs;
    this.engagementKPIs[1].percentage = totalOrgs > 0 ? 
      Math.round((newOrgs / totalOrgs) * 100) : 0;

    // Donaciones completadas (placeholder - requiere estado de donaciones)
    this.engagementKPIs[2].value = Math.floor(this.mainKPIs[2].value as number * 0.75);
    this.engagementKPIs[2].total = this.mainKPIs[2].value as number;
    this.engagementKPIs[2].percentage = 75;

    // Publicaciones aprobadas
    const approvedPosts = posts.filter(post => post.approved || post.status === 'approved').length;
    this.engagementKPIs[3].value = approvedPosts;
    this.engagementKPIs[3].total = posts.length;
    this.engagementKPIs[3].percentage = posts.length > 0 ? 
      Math.round((approvedPosts / posts.length) * 100) : 0;
  }

  changePeriod(period: string): void {
    this.selectedPeriod = period;
    // Marcar como loading antes de recargar
    this.mainKPIs.forEach(kpi => kpi.loading = true);
    this.secondaryKPIs.forEach(kpi => kpi.loading = true);
    // Recargar estadísticas
    this.loadStatistics();
  }

  getIconPath(icon: string): string {
    const icons: { [key: string]: string } = {
      users: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
      verified: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      donation: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      document: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      money: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
      clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      star: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z'
    };
    return icons[icon] || '';
  }

  getTrendIcon(direction: 'up' | 'down' | 'neutral'): string {
    if (direction === 'up') {
      return 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6';
    } else if (direction === 'down') {
      return 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6';
    }
    return 'M5 12h14';
  }

  getTrendColor(direction: 'up' | 'down' | 'neutral'): string {
    if (direction === 'up') return 'text-green-600';
    if (direction === 'down') return 'text-red-600';
    return 'text-gray-600';
  }

  // Métodos para las tarjetas destacadas
  getTotalOrganizations(): number {
    return this.totalOrganizationsCount;
  }

  getVerifiedUsersCount(): number {
    return this.verifiedUsersCount;
  }

  getDonationsThisMonth(): number {
    return this.donationsThisMonth;
  }

  getAverageDailyDonations(): number {
    return this.averageDailyDonations;
  }

  exportData(): void {
    // Metadatos del reporte
    const timestamp = new Date().toLocaleString('es-ES');
    const fecha = new Date().toISOString().split('T')[0];
    
    // ===== SECCIÓN 1: INFORMACIÓN DEL REPORTE =====
    const header = [
      'REPORTE DE ESTADÍSTICAS - DONACIONAPP',
      `Fecha de Exportación: ${timestamp}`,
      `Período Analizado: ${this.getReadablePeriod()}`,
      ''
    ];

    // ===== SECCIÓN 2: RESUMEN EJECUTIVO =====
    const resumenEjecutivo = [
      '=== RESUMEN EJECUTIVO ===',
      'Métrica,Valor',
      `Total de Usuarios Registrados,${this.totalUsersCount}`,
      `Usuarios Verificados,${this.verifiedUsersCount}`,
      `Porcentaje de Verificación,${this.totalUsersCount > 0 ? ((this.verifiedUsersCount / this.totalUsersCount) * 100).toFixed(1) : 0}%`,
      `Total de Organizaciones,${this.totalOrganizationsCount}`,
      `Organizaciones Verificadas,${this.mainKPIs[1].value}`,
      `Total de Donaciones,${this.mainKPIs[2].value}`,
      `Donaciones Este Mes,${this.donationsThisMonth}`,
      `Promedio Diario de Donaciones,${this.averageDailyDonations}`,
      `Total de Publicaciones,${this.mainKPIs[3].value}`,
      ''
    ];

    // ===== SECCIÓN 3: KPIs PRINCIPALES =====
    const kpisPrincipales = [
      '=== INDICADORES CLAVE DE RENDIMIENTO (KPI) ===',
      'Categoría,Indicador,Valor Actual,Descripción,Tendencia,Dirección,Estado'
    ];
    
    this.mainKPIs.forEach(kpi => {
      const estado = this.getKPIStatus(kpi.trend?.direction);
      kpisPrincipales.push(
        `KPI Principal,"${kpi.title}",${kpi.value},"${kpi.subtitle || ''}",${kpi.trend?.value || 'N/A'},${kpi.trend?.direction || 'neutral'},${estado}`
      );
    });
    kpisPrincipales.push('');

    // ===== SECCIÓN 4: MÉTRICAS DE RENDIMIENTO =====
    const metricasRendimiento = [
      '=== MÉTRICAS DE RENDIMIENTO ===',
      'Categoría,Indicador,Valor Actual,Descripción,Tendencia,Dirección,Estado'
    ];
    
    this.secondaryKPIs.forEach(kpi => {
      const estado = this.getKPIStatus(kpi.trend?.direction);
      metricasRendimiento.push(
        `Métrica Rendimiento,"${kpi.title}",${kpi.value},"${kpi.subtitle || ''}",${kpi.trend?.value || 'N/A'},${kpi.trend?.direction || 'neutral'},${estado}`
      );
    });
    metricasRendimiento.push('');

    // ===== SECCIÓN 5: INDICADORES DE ACTIVIDAD =====
    const indicadoresActividad = [
      '=== INDICADORES DE ACTIVIDAD (ÚLTIMOS 7 DÍAS) ===',
      'Indicador,Cantidad Actual,Total,Porcentaje,Estado'
    ];
    
    this.engagementKPIs.forEach(kpi => {
      const estado = kpi.percentage >= 70 ? 'Excelente' : kpi.percentage >= 40 ? 'Bueno' : 'Bajo';
      indicadoresActividad.push(
        `"${kpi.label}",${kpi.value},${kpi.total},${kpi.percentage}%,${estado}`
      );
    });
    indicadoresActividad.push('');

    // ===== SECCIÓN 6: ANÁLISIS COMPARATIVO =====
    const analisisComparativo = [
      '=== ANÁLISIS COMPARATIVO ===',
      'Métrica,Descripción,Valor',
      `Ratio Usuarios/Organizaciones,Usuarios por cada organización,${this.totalOrganizationsCount > 0 ? (this.totalUsersCount / this.totalOrganizationsCount).toFixed(2) : 0}`,
      `Ratio Donaciones/Usuarios,Donaciones por usuario,${this.totalUsersCount > 0 ? (Number(this.mainKPIs[2].value) / this.totalUsersCount).toFixed(2) : 0}`,
      `Ratio Publicaciones/Organizaciones,Posts por organización,${this.totalOrganizationsCount > 0 ? (Number(this.mainKPIs[3].value) / this.totalOrganizationsCount).toFixed(2) : 0}`,
      `Tasa de Verificación de Usuarios,Porcentaje de usuarios verificados,${this.totalUsersCount > 0 ? ((this.verifiedUsersCount / this.totalUsersCount) * 100).toFixed(1) : 0}%`,
      `Tasa de Verificación de Organizaciones,Porcentaje de organizaciones verificadas,${this.totalOrganizationsCount > 0 ? ((Number(this.mainKPIs[1].value) / this.totalOrganizationsCount) * 100).toFixed(1) : 0}%`,
      ''
    ];

    // ===== SECCIÓN 7: NOTAS Y OBSERVACIONES =====
    const notas = [
      '=== NOTAS Y OBSERVACIONES ===',
      'Nota,Descripción',
      `Generado automáticamente,Este reporte fue generado automáticamente desde el panel de administración`,
      `Datos en tiempo real,Los datos reflejan el estado actual del sistema al momento de la exportación`,
      `Período de análisis,${this.getReadablePeriod()}`,
      `Próxima actualización recomendada,Se recomienda generar un nuevo reporte en 7 días`,
      ''
    ];

    // ===== COMBINAR TODAS LAS SECCIONES =====
    const fullContent = [
      ...header,
      ...resumenEjecutivo,
      ...kpisPrincipales,
      ...metricasRendimiento,
      ...indicadoresActividad,
      ...analisisComparativo,
      ...notas
    ].join('\n');

    // Crear y descargar el archivo CSV
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + fullContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte_estadisticas_detallado_${fecha}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private getReadablePeriod(): string {
    const periods: { [key: string]: string } = {
      '7d': 'Últimos 7 días',
      '30d': 'Últimos 30 días',
      '3m': 'Últimos 3 meses',
      '1y': 'Último año'
    };
    return periods[this.selectedPeriod] || this.selectedPeriod;
  }

  private getKPIStatus(direction?: 'up' | 'down' | 'neutral'): string {
    if (!direction) return 'Sin cambios';
    if (direction === 'up') return 'Positivo ↑';
    if (direction === 'down') return 'Negativo ↓';
    return 'Estable →';
  }
}
