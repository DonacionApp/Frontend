import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { DonationByUser } from '../../../core/services/donation.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-user-donations-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './user-donations-list.component.html',
  styleUrls: ['./user-donations-list.component.scss']
})
export class UserDonationsListComponent implements OnChanges {
  @Input() donations: DonationByUser[] = [];
  @Input() isLoading: boolean = false;
  @Input() errorMessage: string = '';

  currentUserId: number | null = null;

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
    }
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
