import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DonationService, Donation, Comment } from '../../../core/services/donation.service';
import { AuthService } from '../../../core/services/auth.service';

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
  canEditDonation = false;
  canDeleteDonation = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private donationService: DonationService,
    private authService: AuthService,
    private location: Location
  ) {}

  ngOnInit(): void {
    // Obtener el ID de la donación desde la URL
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadDonation(parseInt(id));
    } else {
      this.errorMessage = 'ID de donación no válido';
    }
  }

  private loadDonation(id: number): void {
    this.loading = true;
    this.errorMessage = '';

    this.donationService.getDonationById(id).subscribe({
      next: (donation) => {
        this.donation = donation;
        this.loading = false;
        
        // Verificar si el usuario actual puede editar/eliminar
        this.checkPermissions();
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

  /**
   * Verificar permisos del usuario actual sobre la donación
   */
  private checkPermissions(): void {
    if (!this.donation) return;

    const currentUser = this.authService.currentUserValue;
    if (!currentUser) {
      this.canEditDonation = false;
      this.canDeleteDonation = false;
      return;
    }

    const currentUserId = String(currentUser.id);
    const beneficiaryId = String(this.donation.beneficiary?.id);
    const donatorId = String(this.donation.donator?.id);
    
    // Verificar si el usuario es el beneficiario (creador) o el donador
    const isBeneficiary = currentUserId === beneficiaryId;
    const isDonator = currentUserId === donatorId;
    
    // Verificar si el estado es "pendiente"
    const isPending = this.donation.statusDonation?.status?.toLowerCase() === 'pendiente';

    // Editar: Solo si es beneficiario o donador Y el estado es pendiente
    this.canEditDonation = (isBeneficiary || isDonator) && isPending;
    
    // Eliminar: Solo el beneficiario (creador) puede eliminar, sin importar el estado
    this.canDeleteDonation = isBeneficiary;
  }

  // Navegar a editar
  onEdit(): void {
    if (!this.donation) return;

    if (!this.canEditDonation) {
      const isPending = this.donation.statusDonation?.status?.toLowerCase() === 'pendiente';
      if (!isPending) {
        this.errorMessage = 'Solo se pueden editar donaciones en estado "pendiente".';
      } else {
        this.errorMessage = 'No tienes permiso para editar esta donación. Solo el beneficiario o donador pueden editarla.';
      }
      setTimeout(() => this.errorMessage = '', 4000);
      return;
    }

    this.router.navigate(['/organization/donations', this.donation.id, 'edit']);
  }

  // Navegar a gestionar artículos
  onManageArticles(): void {
    if (!this.donation) return;

    if (!this.canEditDonation) {
      const isPending = this.donation.statusDonation?.status?.toLowerCase() === 'pendiente';
      if (!isPending) {
        this.errorMessage = 'Solo se pueden gestionar artículos en estado "pendiente".';
      } else {
        this.errorMessage = 'No tienes permiso para gestionar los artículos. Solo el beneficiario o donador pueden hacerlo.';
      }
      setTimeout(() => this.errorMessage = '', 4000);
      return;
    }

    this.router.navigate(['/organization/donations', this.donation.id, 'manage-articles']);
  }

  // Eliminar donación
  onDelete(): void {
    if (!this.donation) return;

    if (!this.canDeleteDonation) {
      this.errorMessage = 'No tienes permiso para eliminar esta donación. Solo el creador puede eliminarla.';
      setTimeout(() => this.errorMessage = '', 3000);
      return;
    }

    if (confirm('¿Estás seguro de eliminar esta donación? Esta acción no se puede deshacer.')) {
      this.loading = true;
      this.donationService.deleteDonation(this.donation.id).subscribe({
        next: () => {
          this.router.navigate(['/organization/donations']);
        },
        error: (error) => {
          this.loading = false;
          console.error('Error al eliminar:', error);
          
          if (error.status === 404) {
            this.errorMessage = 'La donación no existe o ya fue eliminada.';
          } else if (error.status === 403) {
            this.errorMessage = 'No tienes permiso para eliminar esta donación. Solo el creador puede eliminarla.';
          } else if (error.status === 409) {
            this.errorMessage = 'No se puede eliminar la donación porque tiene artículos asociados o está en proceso.';
          } else if (error.status === 500) {
            this.errorMessage = 'Error en el servidor al eliminar la donación. Intenta nuevamente más tarde.';
          } else if (error.status === 0) {
            this.errorMessage = 'Error de conexión. Verifica tu conexión a internet.';
          } else {
            this.errorMessage = 'Error al eliminar la donación. Por favor intenta nuevamente.';
          }
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
          
          if (error.status === 404) {
            this.errorMessage = 'La donación no existe o ya fue eliminada.';
          } else if (error.status === 403) {
            this.errorMessage = 'No tienes permiso para extender la fecha de esta donación.';
          } else if (error.status === 400) {
            this.errorMessage = 'No se puede extender la fecha. Verifica que la donación esté en estado válido.';
          } else if (error.status === 500) {
            this.errorMessage = 'Error en el servidor al extender la fecha. Intenta nuevamente más tarde.';
          } else if (error.status === 0) {
            this.errorMessage = 'Error de conexión. Verifica tu conexión a internet.';
          } else {
            this.errorMessage = 'Error al extender la fecha. Por favor intenta nuevamente.';
          }
        }
      });
    }
  }

  // Volver a la lista
  onBack(): void {
     this.location.back();
  }

  // Formatear fecha
  formatDate(dateString: string): string {
    if (!dateString) return 'No especificado';
    
    // Si la fecha viene solo como "YYYY-MM-DD" (sin hora), formatearla directamente
    // para evitar problemas de zona horaria
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Formato solo fecha (YYYY-MM-DD), extraer componentes directamente
      const [year, month, day] = dateString.split('-').map(Number);
      // Usar Intl.DateTimeFormat con UTC para evitar cambios de zona horaria
      const date = new Date(Date.UTC(year, month - 1, day));
      return new Intl.DateTimeFormat('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
      }).format(date);
    } else {
      // Formato ISO completo, usar directamente
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  }

  // Calcular días restantes
  getDaysRemaining(): number {
    if (!this.donation?.fechaMaximaEntrega) return 0;
    
    // Manejar correctamente las fechas que vienen del backend
    let maxDate: Date;
    const fechaString = this.donation.fechaMaximaEntrega;
    
    if (fechaString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Formato solo fecha (YYYY-MM-DD), crear en UTC para evitar cambios de fecha
      const [year, month, day] = fechaString.split('-').map(Number);
      maxDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    } else {
      // Formato ISO completo, usar directamente
      maxDate = new Date(fechaString);
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Resetear horas para comparar solo fecha
    maxDate.setHours(0, 0, 0, 0); // Resetear horas para comparar solo fecha
    
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

  // Obtener comentarios como array
  getCommentsArray(): Comment[] {
    if (!this.donation?.comments) return [];
    if (Array.isArray(this.donation.comments)) {
      return this.donation.comments;
    }
    return [];
  }
}
