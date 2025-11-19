import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DonationService, Donation, Comment, StatusDonation } from '../../../core/services/donation.service';
import { AuthService } from '../../../core/services/auth.service';
import { MessageService } from '../../../core/services/message.service';
import { HttpClient } from '@angular/common/http';
import { AlertService } from '../../../shared/services/alert.service';
import { environment } from '../../../../environments/environment';
import { AcknowledgmentFormComponent } from '../../../shared/components/acknowledgment-form/acknowledgment-form.component';
import { AcknowledgmentListComponent } from '../../../shared/components/acknowledgment-list/acknowledgment-list.component';

@Component({
  selector: 'app-donation-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, AcknowledgmentFormComponent, AcknowledgmentListComponent],
  templateUrl: './donation-detail.component.html',
  styleUrls: ['./donation-detail.component.scss']
})
export class DonationDetailComponent implements OnInit {
  donation: Donation | null = null;
  loading = false;
  errorMessage = '';
  canEditDonation = false;
  canDeleteDonation = false;
  canEditStatus = false;
  isBeneficiary = false;
  isDonator = false;

  allStatuses: StatusDonation[] = [];
  selectedStatusId: number = 0;
  updatingStatus = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private donationService: DonationService,
    public authService: AuthService,
    private location: Location,
    private http: HttpClient,
    private alertService: AlertService
    ,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadDonation(parseInt(id));
      this.loadStatuses();
    } else {
      this.errorMessage = 'ID de donación no válido';
    }
  }

  private loadStatuses(): void {
    this.donationService.getAllDonationStatuses().subscribe({
      next: (statuses) => {
        this.allStatuses = statuses;
      },
      error: (error) => {
        console.error('Error al cargar estados:', error);
      }
    });
  }

  private loadDonation(id: number): void {
    this.loading = true;
    this.errorMessage = '';

    this.donationService.getDonationById(id).subscribe({
      next: (donation) => {
        this.donation = donation;
        this.selectedStatusId = donation.statusDonation.id;
        this.loading = false;

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


  private checkPermissions(): void {
    if (!this.donation) return;

    const currentUser = this.authService.currentUserValue;
    if (!currentUser) {
      this.canEditDonation = false;
      this.canDeleteDonation = false;
      this.canEditStatus = false;
      return;
    }

    const currentUserId = String(currentUser.id);
    const beneficiaryId = String(this.donation.beneficiary?.id);
    const donatorId = String(this.donation.donator?.id);

    const isBeneficiary = currentUserId === beneficiaryId;
    const isDonator = currentUserId === donatorId;
    const isOwner = this.donation.owner === true;
    this.isBeneficiary = isBeneficiary;
    this.isDonator = isDonator;

    const isPending = this.donation.statusDonation?.status?.toLowerCase() === 'pendiente';

    const currentStatus = this.donation.statusDonation?.status?.toLowerCase().trim() || '';
    const finalStatuses = ['entregada', 'completada', 'cancelada', 'rechazada'];
    const isFinalStatus = finalStatuses.includes(currentStatus);

    this.canEditDonation = isDonator && isPending;

    this.canDeleteDonation = isDonator;

    this.canEditStatus = (isDonator || isOwner) && !isBeneficiary && !isFinalStatus;
  }

  loadAcknowledgments(): void {
    // Este método se llama cuando se crea un nuevo agradecimiento
    // Recargar la donación completa para obtener los reviews actualizados
    if (this.donation?.id) {
      this.loadDonation(this.donation.id);
    }
  }

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
  async onExtendDate(): Promise<void> {
    if (!this.donation) return;

    const confirmed = await this.alertService.warning(
      'Extender fecha',
      '¿Deseas extender la fecha máxima de entrega en 10 días?',
      'Sí, extender',
      'Cancelar'
    );

    if (!confirmed) return;

    this.loading = true;
    const url = `${environment.apiBackendUrl}/donation/update-date/${this.donation.id}`;

    try {
      const updatedDonation = await new Promise<Donation>((resolve, reject) => {
        this.http.put<Donation>(url, {}).subscribe({
          next: (data) => resolve(data),
          error: (err) => reject(err)
        });
      });

      this.donation = updatedDonation;
      this.loading = false;
      await this.alertService.success('Fecha extendida', 'La fecha máxima de entrega se extendió exitosamente por 10 días más.');

    } catch (error: any) {
      this.loading = false;
      console.error('Error al extender fecha:', error);
      const title = 'No se pudo extender la fecha';
      const message = error?.error?.message || 'Esta donación ya fue extendida una vez o no es posible extenderla.';
      await this.alertService.error(title, message);
    }
  }

  onBack(): void {
    this.location.back();
  }

  onCreateChat(): void {
    if (!this.donation) return;
    if (!this.authService.currentUserValue) {
      this.alertService.showAlert('Debes iniciar sesión', 'info');
      return;
    }
    if (!this.isBeneficiary && !this.isDonator) {
      this.alertService.error('No permitido', 'Solo los participantes de esta donación pueden crear o abrir el chat.');
      return;
    }

    this.loading = true;
    this.messageService.createChatFromDonation(this.donation.id).subscribe({
      next: async (res) => {
        try {
          const fresh = await new Promise<Donation>((resolve, reject) => {
            this.donationService.getDonationById(this.donation!.id).subscribe({ next: d => resolve(d), error: e => reject(e) });
          });
          this.donation = fresh;
          this.checkPermissions();
          this.alertService.success('Chat creado', 'El chat se creó correctamente.');
        } catch (err) {
          console.warn('No se pudo refrescar la donación después de crear chat:', err);
          this.alertService.success('Chat creado', 'El chat se creó correctamente.');
        }
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        console.error('Error al crear chat desde donación:', err);
        const msg = err?.error?.message || 'No se pudo crear el chat. Intenta nuevamente.';
        this.alertService.error('Error', msg);
      }
    });
  }

  onOpenChat(): void {
    if (!this.donation || !this.donation.chat || !this.donation.chat.id) return;
 
    if (!this.authService.currentUserValue || (!this.isBeneficiary && !this.isDonator)) {
      this.alertService.error('No permitido', 'No tienes permiso para ver este chat.');
      return;
    }
    console.log('Navegando al chat ID:', this.donation.chat.id);
    
    this.router.navigate(['/chat'], { queryParams: { chat: this.donation.chat.id } });
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'No especificado';

    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return new Intl.DateTimeFormat('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
      }).format(date);
    } else {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  }

  getDaysRemaining(): number {
    if (!this.donation?.fechaMaximaEntrega) return 0;

    let maxDate: Date;
    const fechaString = this.donation.fechaMaximaEntrega;

    if (fechaString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = fechaString.split('-').map(Number);
      maxDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    } else {
      maxDate = new Date(fechaString);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    maxDate.setHours(0, 0, 0, 0); 

    const diff = maxDate.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

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

  // Verificar si el estado permite dejar agradecimiento
  canLeaveAcknowledgment(): boolean {
    if (!this.donation?.statusDonation?.status) return false;
    const status = this.donation.statusDonation.status.toLowerCase().trim();
    const statusAllowed = status === 'entregada' || status === 'completada';
    
    if (!statusAllowed) return false;
    
    // Verificar si el beneficiario ya dejó un agradecimiento
    if (!this.isBeneficiary) return false;
    
    const currentUser = this.authService.currentUserValue;
    if (!currentUser) return false;
    
    const currentUserId = String(currentUser.id);
    
    // Si ya existe una review del beneficiario actual, no permitir crear otra
    if (this.donation.reviews && this.donation.reviews.length > 0) {
      const hasReviewFromBeneficiary = this.donation.reviews.some(review => {
        const reviewUserId = String(review.user?.id || '');
        return reviewUserId === currentUserId;
      });
      
      if (hasReviewFromBeneficiary) {
        return false; // Ya tiene un agradecimiento, no mostrar formulario
      }
    }
    
    return true;
  }

  onStatusChange(): void {
    if (!this.donation || this.updatingStatus || !this.canEditStatus) return;

    this.updatingStatus = true;
    this.errorMessage = '';

    this.donationService.updateDonationStatus(this.donation.id, { status: this.selectedStatusId }).subscribe({
      next: (updatedDonation) => {
        this.donation = updatedDonation;
        this.selectedStatusId = updatedDonation.statusDonation.id;
        this.updatingStatus = false;
        this.checkPermissions();
      },
      error: (error) => {
        this.updatingStatus = false;
        console.error('Error al actualizar estado:', error);

        if (error.status === 404) {
          this.errorMessage = 'Donación no encontrada';
        } else if (error.status === 403) {
          this.errorMessage = 'No tienes permiso para actualizar el estado';
        } else {
          this.errorMessage = 'Error al actualizar el estado';
        }

        if (this.donation) {
          this.selectedStatusId = this.donation.statusDonation.id;
        }
      }
    });
  }
}
