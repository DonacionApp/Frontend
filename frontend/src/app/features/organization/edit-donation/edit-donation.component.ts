import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { DonationService, Donation } from '../../../core/services/donation.service';
import { AuthService } from '../../../core/services/auth.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-edit-donation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-donation.component.html',
  styleUrls: ['./edit-donation.component.scss']
})
export class EditDonationComponent implements OnInit, OnDestroy {
  donationForm!: FormGroup;
  loading = false;
  errorMessage = '';
  successMessage = '';
  donationId = 0;
  currentDonation: Donation | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private donationService: DonationService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    // Obtener el ID de la donación desde la ruta
    const id = this.route.snapshot.paramMap.get('id');
    this.donationId = id ? parseInt(id) : 0;
    
    if (this.donationId) {
      this.loadDonation(this.donationId);
    } else {
      this.errorMessage = 'ID de donación no válido';
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.donationForm = this.fb.group({
      lugarRecogida: ['', [Validators.required, Validators.maxLength(200)]],
      lugarDonacion: ['', [Validators.required, Validators.maxLength(200)]],
      fechaMaximaEntrega: ['', Validators.required],
      // Solo los campos editables según UpdateDonationDTO
    });
  }

  // Artículos y comentarios se mantienen en listas para visualización (no editables)
  articlesList: any[] = [];
  commentsList: any[] = [];

  /**
   * Cargar datos de la donación existente
   */
  private loadDonation(id: number): void {
    this.loading = true;
    this.donationService.getDonationById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (donation) => {
          this.currentDonation = donation;

          // Verificar permisos de edición
          const currentUser = this.authService.currentUserValue;
          if (!currentUser) {
            this.errorMessage = 'Debes iniciar sesión para editar una donación.';
            this.loading = false;
            setTimeout(() => {
              this.router.navigate(['/auth/login']);
            }, 2000);
            return;
          }

          const currentUserId = String(currentUser.id);
          const beneficiaryId = String(donation.beneficiary?.id);
          const donatorId = String(donation.donator?.id);
          
          // Verificar si es beneficiario o donador
          const isBeneficiary = currentUserId === beneficiaryId;
          const isDonator = currentUserId === donatorId;
          
          // Verificar si el estado es "pendiente"
          const isPending = donation.statusDonation?.status?.toLowerCase() === 'pendiente';

          // Solo puede editar si es beneficiario/donador Y está en pendiente
          if (!isBeneficiary && !isDonator) {
            this.errorMessage = 'No tienes permiso para editar esta donación. Solo el beneficiario o donador pueden editarla.';
            this.loading = false;
            setTimeout(() => {
              this.router.navigate(['/organization/donations', id]);
            }, 2000);
            return;
          }

          if (!isPending) {
            this.errorMessage = 'Solo se pueden editar donaciones en estado "pendiente".';
            this.loading = false;
            setTimeout(() => {
              this.router.navigate(['/organization/donations', id]);
            }, 2000);
            return;
          }

          // Llenar el formulario con los datos existentes
          this.donationForm.patchValue({
            lugarRecogida: donation.lugarRecogida,
            lugarDonacion: donation.lugarDonacion,
            fechaMaximaEntrega: this.formatDateForInput(donation.fechaMaximaEntrega)
          });

          // Guardar artículos y comentarios para visualización (no editables)
          this.articlesList = donation.articles || [];
          this.commentsList = Array.isArray(donation.comments) ? donation.comments : [];

          this.loading = false;
        },
        error: (error) => {
          this.loading = false;
          console.error('Error al cargar donación:', error);
          
          if (error.status === 404) {
            this.errorMessage = 'Donación no encontrada';
          } else if (error.status === 403) {
            this.errorMessage = 'No tienes permiso para editar esta donación';
          } else {
            this.errorMessage = 'Error al cargar la donación. Intenta nuevamente.';
          }
          
          // Redirigir después de mostrar el error
          setTimeout(() => {
            this.router.navigate(['/organization/donations']);
          }, 2000);
        }
      });
  }

  /**
   * Convertir fecha a formato compatible con input date (YYYY-MM-DD)
   * El backend devuelve la fecha en formato "YYYY-MM-DD", la usamos directamente
   */
  private formatDateForInput(isoDate: string): string {
    // Si la fecha viene solo como "YYYY-MM-DD" (sin hora), usarla directamente
    if (isoDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return isoDate; // Ya está en formato correcto
    }
    
    // Si viene en formato ISO completo, extraer solo la fecha
    const date = new Date(isoDate);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Agregar nuevo artículo
   */
  // No es posible agregar artículos desde aquí: los artículos están ligados al post y son de solo lectura.

  /**
   * Eliminar artículo
   */
  // Eliminación de artículos no permitida en la edición (artículos pertenecen al post)

  /**
   * Agregar nuevo comentario
   */
  // Comentarios no editables desde aquí; se muestran los comentarios existentes.

  /**
   * Eliminar comentario
   */
  // No es posible eliminar comentarios desde esta vista

  /**
   * Enviar formulario actualizado
   */
  onSubmit(): void {
    if (this.donationForm.invalid) {
      this.donationForm.markAllAsTouched();
      this.errorMessage = 'Por favor completa todos los campos requeridos correctamente';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const formValue = this.donationForm.value;

    // Enviar la fecha en formato ISO con hora (18:00:00 UTC) como Postman lo hace
    // El input type="date" devuelve "YYYY-MM-DD", lo convertimos a ISO con hora
    const fechaString = formValue.fechaMaximaEntrega; // Formato: "YYYY-MM-DD"
    const [year, month, day] = fechaString.split('-').map(Number);
    // Crear fecha a las 18:00:00 UTC del día seleccionado (igual que Postman)
    const fechaDate = new Date(Date.UTC(year, month - 1, day, 18, 0, 0, 0));

    const updateData: any = {
      lugarRecogida: formValue.lugarRecogida?.trim(),
      lugarDonacion: formValue.lugarDonacion?.trim(),
      fechaMaximaEntrega: fechaDate.toISOString() // Formato: "YYYY-MM-DDTHH:mm:ss.sssZ"
    };

    this.donationService.updateDonation(this.donationId, updateData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.loading = false;
          this.successMessage = 'Donación actualizada exitosamente';
          
          // Redirigir al detalle después de 1.5 segundos
          setTimeout(() => {
            this.router.navigate(['/organization/donations', this.donationId]);
          }, 1500);
        },
        error: (error) => {
          this.loading = false;
          console.error('Error al actualizar donación:', error);

          if (error.status === 400) {
            this.errorMessage = 'Datos inválidos. Verifica el formulario.';
          } else if (error.status === 401) {
            this.errorMessage = 'Sesión expirada. Por favor inicia sesión nuevamente.';
            setTimeout(() => this.router.navigate(['/auth/login']), 2000);
          } else if (error.status === 403) {
            this.errorMessage = 'No tienes permiso para editar esta donación.';
          } else if (error.status === 404) {
            this.errorMessage = 'Donación no encontrada.';
          } else {
            this.errorMessage = 'Error al actualizar la donación. Intenta nuevamente.';
          }
        }
      });
  }

  /**
   * Cancelar y volver al detalle
   */
  onCancel(): void {
    this.router.navigate(['/organization/donations', this.donationId]);
  }

  /**
   * Obtener mensaje de error de un campo
   */
  getFieldError(fieldName: string): string {
    const field = this.donationForm.get(fieldName);
    
    if (field?.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (field?.hasError('maxlength')) {
      const maxLength = field.errors?.['maxlength'].requiredLength;
      return `Máximo ${maxLength} caracteres`;
    }
    return '';
  }
}
