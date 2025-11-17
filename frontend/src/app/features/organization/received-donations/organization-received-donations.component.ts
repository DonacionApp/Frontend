import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { DonationService, Donation, DonationArticle } from '../../../core/services/donation.service';
import { ToastService } from '../../../core/services/toast.service';

interface ReceivedDonationStats {
  totalDonations: number;
  totalArticles: number;
  uniqueDonors: number;
}

@Component({
  selector: 'app-organization-received-donations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './organization-received-donations.component.html',
  styleUrls: ['./organization-received-donations.component.scss']
})
export class OrganizationReceivedDonationsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loading = true;
  errorMessage = '';
  receivedDonations: Donation[] = [];
  filteredDonations: Donation[] = [];
  stats: ReceivedDonationStats = {
    totalDonations: 0,
    totalArticles: 0,
    uniqueDonors: 0
  };

  // filtros
  searchTerm = '';
  dateFrom: string | null = null;
  dateTo: string | null = null;

  constructor(
    private donationService: DonationService,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadReceivedDonations();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadReceivedDonations(): void {
    this.loading = true;
    this.errorMessage = '';

    this.donationService.getMyDonations()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (donations) => {
          this.receivedDonations = donations.filter(d => this.isCompletedDonation(d));
          this.computeStats();
          this.applyFilters();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error al cargar donaciones recibidas:', error);
          this.errorMessage = 'No pudimos cargar tu historial de donaciones entregadas. Intenta nuevamente en unos segundos.';
          this.loading = false;
        }
      });
  }

  private computeStats(): void {
    const donors = new Set<string>();
    let totalArticles = 0;

    for (const donation of this.receivedDonations) {
      if (donation?.donator?.id) {
        donors.add(donation.donator.id.toString());
      }

      if (Array.isArray(donation.articles)) {
        const subtotal = donation.articles.reduce((sum, article) => sum + this.parseQuantity(article), 0);
        totalArticles += subtotal;
      }
    }

    this.stats = {
      totalDonations: this.receivedDonations.length,
      totalArticles,
      uniqueDonors: donors.size
    };
  }

  applyFilters(): void {
    const search = this.searchTerm.trim().toLowerCase();
    const from = this.dateFrom ? new Date(`${this.dateFrom}T00:00:00`) : null;
    const to = this.dateTo ? new Date(`${this.dateTo}T23:59:59`) : null;

    this.filteredDonations = this.receivedDonations.filter(donation => {
      const dateToCompare = donation.updatedAt || donation.createdAt;
      const donationDate = new Date(dateToCompare);

      if (from && donationDate < from) {
        return false;
      }
      if (to && donationDate > to) {
        return false;
      }

      if (search) {
        const donor = (donation.donator?.username || donation.donator?.email || '').toLowerCase();
        const title = (donation.post?.title || '').toLowerCase();
        const location = `${donation.lugarRecogida || ''} ${(donation as any).lugarDonacion || ''}`.toLowerCase();
        const articles = (donation.articles || [])
          .map(a => (a.article?.name || '').toLowerCase())
          .join(' ');

        if (![donor, title, location, articles].some(field => field.includes(search))) {
          return false;
        }
      }

      return true;
    });
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.dateFrom = null;
    this.dateTo = null;
    this.applyFilters();
  }

  getArticlesSummary(articles: DonationArticle[]): string {
    if (!Array.isArray(articles) || articles.length === 0) {
      return 'Sin artículos registrados';
    }

    const parts = articles.map(article => `${this.parseQuantity(article)} × ${article.article?.name || 'Artículo'}`);
    return parts.join(', ');
  }

  viewDonationDetail(donationId: number): void {
    this.router.navigate(['/organization/donations', donationId]);
  }

  goBackToDashboard(): void {
    this.router.navigate(['/organization']);
  }

  refresh(): void {
    this.toastService.info('Actualizando', 'Buscando últimas donaciones entregadas...');
    this.loadReceivedDonations();
  }

  trackByDonationId(_index: number, donation: Donation): number {
    return donation.id;
  }

  private isCompletedDonation(donation: Donation): boolean {
    const normalized = this.normalizeStatus(donation);
    const completedStatuses = ['entregada', 'completada', 'recibida', 'entregado', 'completo'];
    return completedStatuses.includes(normalized);
  }

  private normalizeStatus(donation: Donation): string {
    const status = donation?.statusDonation;
    if (!status) {
      return '';
    }

    if (typeof status === 'object' && 'status' in status && status.status) {
      return status.status.toString().toLowerCase().trim();
    }

    return status.toString().toLowerCase().trim();
  }

  parseQuantity(article: DonationArticle | undefined): number {
    if (!article) {
      return 0;
    }
    const qty = parseFloat(article.quantity as unknown as string);
    return Number.isNaN(qty) ? 0 : qty;
  }

  getStatusBadge(donation: Donation): { text: string; class: string } {
    const status = this.normalizeStatus(donation);
    switch (status) {
      case 'entregada':
      case 'entregado':
        return { text: 'Entregada', class: 'bg-blue-100 text-blue-700' };
      case 'completada':
      case 'completo':
        return { text: 'Completada', class: 'bg-emerald-100 text-emerald-700' };
      case 'recibida':
        return { text: 'Recibida', class: 'bg-teal-100 text-teal-700' };
      default:
        return { text: donation.statusDonation?.toString() || 'Estado desconocido', class: 'bg-gray-100 text-gray-700' };
    }
  }

  formatDate(value: string): string {
    if (!value) {
      return 'Sin fecha';
    }

    return new Date(value).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}

