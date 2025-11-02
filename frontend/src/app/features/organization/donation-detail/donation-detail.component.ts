import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DonationService, Donation } from '../../../core/services/donation.service';

@Component({
  selector: 'app-donation-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './donation-detail.component.html',
  styleUrls: ['./donation-detail.component.scss']
})
export class DonationDetailComponent implements OnInit {
  donation: Donation | null = null;
  loading = false;
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private donationService: DonationService
  ) {}

  ngOnInit(): void {
    // Obtener el ID de la donación desde la URL
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadDonation(id);
    } else {
      this.errorMessage = 'ID de donación no válido';
    }
  }

  private loadDonation(id: string): void {
    this.loading = true;
    this.errorMessage = '';

    this.donationService.getDonationById(id).subscribe({
      next: (donation) => {
        this.donation = donation;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        console.error('Error al cargar donación:', error);
        
        if (error.status === 404) {
          this.errorMessage = 'Donación no encontrada';
        } else if (error.status === 403) {
          this.errorMessage = 'No tienes permiso para ver esta donación';
        } else {
          this.errorMessage = 'Error al cargar la donación. Por favor intenta nuevamente.';
        }
      }
    });
  }

  // Navegar a editar
  onEdit(): void {
    if (this.donation) {
      this.router.navigate(['/organization/donations', this.donation.id, 'edit']);
    }
  }

  // Eliminar donación
  onDelete(): void {
    if (!this.donation) return;

    if (confirm('¿Estás seguro de eliminar esta donación? Esta acción no se puede deshacer.')) {
      this.loading = true;
      this.donationService.deleteDonation(this.donation.id).subscribe({
        next: () => {
          this.router.navigate(['/organization/donations']);
        },
        error: (error) => {
          this.loading = false;
          console.error('Error al eliminar:', error);
          this.errorMessage = 'Error al eliminar la donación. Por favor intenta nuevamente.';
        }
      });
    }
  }

  // Extender fecha de entrega en 10 días
  onExtendDate(): void {
    if (!this.donation) return;

    if (confirm('¿Deseas extender la fecha máxima de entrega en 10 días?')) {
      this.loading = true;
      this.donationService.extendDeliveryDate(this.donation.id).subscribe({
        next: (updatedDonation) => {
          this.donation = updatedDonation;
          this.loading = false;
          alert('Fecha extendida exitosamente');
        },
        error: (error) => {
          this.loading = false;
          console.error('Error al extender fecha:', error);
          this.errorMessage = 'Error al extender la fecha. Por favor intenta nuevamente.';
        }
      });
    }
  }

  // Volver a la lista
  onBack(): void {
    this.router.navigate(['/organization/donations']);
  }

  // Formatear fecha
  formatDate(dateString: string): string {
    if (!dateString) return 'No especificado';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Calcular días restantes
  getDaysRemaining(): number {
    if (!this.donation?.fechaMaximaEntrega) return 0;
    const today = new Date();
    const maxDate = new Date(this.donation.fechaMaximaEntrega);
    const diff = maxDate.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  // Obtener clase de estado
  getStatusClass(): string {
    const days = this.getDaysRemaining();
    if (days < 0) return 'expired';
    if (days <= 3) return 'urgent';
    if (days <= 7) return 'warning';
    return 'normal';
  }
}
