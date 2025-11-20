import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { ImpactMetricsComponent, type ImpactStats } from '../../shared/components/impact-metrics/impact-metrics.component';
import { PublicStatsService, FALLBACK_STATS } from '../../core/services/public-stats.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, ButtonComponent, FooterComponent, ModalComponent, ImpactMetricsComponent],
  templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit {
  // Modal states
  showInfoModal = false;
  showContactModal = false;

  // Impact statistics - Inicia con valores mínimos base (usados como fallback)
  impactStats: ImpactStats = { ...FALLBACK_STATS };

  isLoadingStats = true;

  constructor(
    private router: Router,
    private publicStatsService: PublicStatsService
  ) {}

  ngOnInit(): void {
    this.loadImpactStats();
  }

  /**
   * Carga estadísticas globales del backend.
   * - Si la API responde: usa datos reales
   * - Si la API falla: usa valores mínimos base del servicio (fallback automático)
   */
  loadImpactStats(): void {
    this.isLoadingStats = true;
    this.publicStatsService.getGlobalImpactStats().subscribe({
      next: (stats) => {
        // El servicio siempre devuelve datos (reales o fallback)
        this.impactStats = {
          totalDonations: stats.totalDonations,
          totalOrganizations: stats.totalOrganizations,
          totalCities: stats.totalCities,
          satisfactionRate: stats.satisfactionRate
        };
        this.isLoadingStats = false;
      },
      error: (error) => {
        // Este bloque solo se ejecuta si hay un error catastrófico
        this.isLoadingStats = false;
        // Mantiene los valores mínimos base definidos en impactStats
      }
    });
  }

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  onDonorRegisterClick(): void {
    this.router.navigate(['/register/donor']);
  }

  onOrganizationRegisterClick(): void {
    this.router.navigate(['/organization/register']);
  }

  onLoginClick(): void {
    this.router.navigate(['/auth/login']);
  }

  // Modal methods
  openInfoModal(): void {
    this.showInfoModal = true;
  }

  closeInfoModal(): void {
    this.showInfoModal = false;
  }

  openContactModal(): void {
    this.showContactModal = true;
  }

  closeContactModal(): void {
    this.showContactModal = false;
  }
}
