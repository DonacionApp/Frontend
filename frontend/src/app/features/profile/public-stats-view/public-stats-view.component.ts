import { Component, OnInit, OnDestroy, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PublicStatsComponent } from '../../../shared/components/public-stats/public-stats.component';
import { DonationStatusDonutChartComponent } from '../../../shared/components/donation-status-donut-chart/donation-status-donut-chart.component';
import { ArticlesListComponent } from '../../../shared/components/articles-list/articles-list.component';
import { PublicStatsService, UserPublicStats, UserTotals, ArticleSummary } from '../../../core/services/public-stats.service';
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
  imports: [CommonModule, PublicStatsComponent, DonationStatusDonutChartComponent, ArticlesListComponent, RouterModule],
  templateUrl: './public-stats-view.component.html'
})
export class PublicStatsViewComponent implements OnInit, OnDestroy, OnChanges {
  private destroy$ = new Subject<void>();
  
  @Input() userId: string | number = '';
  userInfo: UserBasicInfo | null = null;
  statsData: any = {};
  totals: UserTotals | null = null;
  donationsByStatus: any[] = [];
  donationsAsDonatorByStatus: any[] = [];
  donatedArticles: ArticleSummary[] = [];
  receivedArticles: ArticleSummary[] = [];
  userType: 'donor' | 'organization' = 'donor';
  
  isLoading = true;
  isExporting = false;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private publicStatsService: PublicStatsService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    // Obtener el ID del usuario de la ruta o del Input
    if (this.userId) {
      // Si viene del Input (desde ProfileComponent)
      this.loadUserData();
    } else {
      // Si viene de la ruta (standalone)
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
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['userId'] && !changes['userId'].firstChange && changes['userId'].currentValue) {
      this.loadUserData();
    }
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

  /**
   * Exporta las estadísticas a PDF
   */
  async exportToPDF(): Promise<void> {
    if (this.isExporting) return;

    this.isExporting = true;
    this.toastService.success('Generando PDF', 'Por favor espera mientras se genera tu documento...');

    try {
      // Obtener el elemento que contiene las estadísticas
      const element = document.getElementById('stats-content');
      if (!element) {
        throw new Error('No se encontró el contenido para exportar');
      }

      // Capturar el contenido como canvas
      const canvas = await html2canvas(element, {
        scale: 2, // Mejor calidad
        useCORS: true, // Permitir imágenes de otros dominios
        logging: false,
        backgroundColor: '#f9fafb' // Fondo gris claro
      } as any);
      
      // Calcular dimensiones para el PDF
      const imgWidth = 210; // A4 width en mm
      const pageHeight = 297; // A4 height en mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Crear el PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');

      // Agregar la primera página
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Si el contenido es más largo que una página, agregar más páginas
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Generar nombre del archivo con fecha
      const username = this.userInfo?.name || 'usuario';
      const date = new Date().toISOString().split('T')[0];
      const filename = `estadisticas-${username}-${date}.pdf`;

      // Descargar el PDF
      pdf.save(filename);

      this.toastService.success('PDF Generado', 'Tu documento ha sido descargado correctamente');
    } catch (error) {
      console.error('Error al generar PDF:', error);
      this.toastService.error('Error', 'No se pudo generar el PDF. Por favor intenta de nuevo');
    } finally {
      this.isExporting = false;
    }
  }
}
