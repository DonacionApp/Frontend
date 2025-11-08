import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DonationByUser } from '../../../core/services/donation.service';
import { AuthService } from '../../../core/services/auth.service';

interface FilterOptions {
  status: string;
  location: string;
  article: string;
  dateFrom: string;
  dateTo: string;
}

@Component({
  selector: 'app-user-donations-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './user-donations-list.component.html',
  styleUrls: ['./user-donations-list.component.scss']
})
export class UserDonationsListComponent implements OnChanges {
  @Input() donations: DonationByUser[] = [];
  @Input() isLoading: boolean = false;
  @Input() errorMessage: string = '';

  currentUserId: number | null = null;
  filteredDonations: DonationByUser[] = [];
  
  // Filter state
  showFilters: boolean = false;
  isApplyingFilters: boolean = false;
  
  filters: FilterOptions = {
    status: '',
    location: '',
    article: '',
    dateFrom: '',
    dateTo: ''
  };

  // Available options for dropdowns
  availableStatuses: string[] = [];
  availableLocations: string[] = [];
  availableArticles: string[] = [];

  constructor(
    private router: Router,
    private authService: AuthService
  ) {
    const currentUser = this.authService.currentUserValue;
    this.currentUserId = currentUser?.id ? Number(currentUser.id) : null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['donations']) {
      console.log('Donations received:', this.donations);
      this.filteredDonations = [...this.donations];
      this.extractFilterOptions();
    }
  }

  extractFilterOptions(): void {
    const statusSet = new Set<string>();
    const locationSet = new Set<string>();
    const articleSet = new Set<string>();

    this.donations.forEach(donation => {
      if (donation.statusDonation?.status) {
        statusSet.add(donation.statusDonation.status);
      }
      if (donation.lugarRecogida) {
        locationSet.add(donation.lugarRecogida);
      }
      if (donation.lugarDonacion) {
        locationSet.add(donation.lugarDonacion);
      }
      donation.articles?.forEach(article => {
        if (article.article?.name) {
          articleSet.add(article.article.name);
        }
      });
    });

    this.availableStatuses = Array.from(statusSet).sort();
    this.availableLocations = Array.from(locationSet).sort();
    this.availableArticles = Array.from(articleSet).sort();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  applyFilters(): void {
    this.isApplyingFilters = true;
    
    setTimeout(() => {
      this.filteredDonations = this.donations.filter(donation => {
        if (this.filters.status && donation.statusDonation?.status !== this.filters.status) {
          return false;
        }

        // Filter by location
        if (this.filters.location) {
          const locationMatch = 
            donation.lugarRecogida?.toLowerCase().includes(this.filters.location.toLowerCase()) ||
            donation.lugarDonacion?.toLowerCase().includes(this.filters.location.toLowerCase());
          if (!locationMatch) {
            return false;
          }
        }

        // Filter by article
        if (this.filters.article) {
          const hasArticle = donation.articles?.some(a => 
            a.article?.name?.toLowerCase().includes(this.filters.article.toLowerCase())
          );
          if (!hasArticle) {
            return false;
          }
        }

        // Filter by date range
        if (this.filters.dateFrom) {
          const donationDate = new Date(donation.createdAt);
          const fromDate = new Date(this.filters.dateFrom);
          if (donationDate < fromDate) {
            return false;
          }
        }

        if (this.filters.dateTo) {
          const donationDate = new Date(donation.createdAt);
          const toDate = new Date(this.filters.dateTo);
          toDate.setHours(23, 59, 59, 999); // Include the entire day
          if (donationDate > toDate) {
            return false;
          }
        }

        return true;
      });

      this.isApplyingFilters = false;
    }, 300);
  }

  clearFilters(): void {
    this.filters = {
      status: '',
      location: '',
      article: '',
      dateFrom: '',
      dateTo: ''
    };
    this.filteredDonations = [...this.donations];
  }

  hasActiveFilters(): boolean {
    return !!(
      this.filters.status ||
      this.filters.location ||
      this.filters.article ||
      this.filters.dateFrom ||
      this.filters.dateTo
    );
  }

  getActiveFiltersCount(): number {
    let count = 0;
    if (this.filters.status) count++;
    if (this.filters.location) count++;
    if (this.filters.article) count++;
    if (this.filters.dateFrom) count++;
    if (this.filters.dateTo) count++;
    return count;
  }

  viewDonationDetails(donationId: number): void {
    this.router.navigate(['/organization/donations', donationId]);
  }

  viewPostDetails(postId: number, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/post', postId]);
  }

  getStatusColor(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pendiente': 'bg-yellow-100 text-yellow-700',
      'aceptada': 'bg-green-100 text-green-700',
      'rechazada': 'bg-red-100 text-red-700',
      'completada': 'bg-blue-100 text-blue-700',
      'cancelada': 'bg-gray-100 text-gray-700'
    };
    return statusMap[status.toLowerCase()] || 'bg-gray-100 text-gray-700';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  }
}
