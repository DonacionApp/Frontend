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
  donationId = '';
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
    this.donationId = this.route.snapshot.paramMap.get('id') || '';
    
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
      comunity: ['', [Validators.required, Validators.maxLength(100)]],
      fechaMaximaEntrega: ['', Validators.required],
      articles: this.fb.array([], [Validators.required, Validators.minLength(1)]),
      comments: this.fb.array([])
    });
  }

  get articles(): FormArray {
    return this.donationForm.get('articles') as FormArray;
  }

  get comments(): FormArray {
    return this.donationForm.get('comments') as FormArray;
  }

  /**
   * Cargar datos de la donación existente
   */
  private loadDonation(id: string): void {
    this.loading = true;
    this.donationService.getDonationById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (donation) => {
          this.currentDonation = donation;

          // Verificar si el usuario actual es el propietario
          const currentUser = this.authService.currentUserValue;
          
          // Obtener el ID del creador (con fallback)
          const donationCreatorId = donation.userId || donation.user?.id;
          const currentUserId = String(currentUser?.id || '');
          const creatorId = String(donationCreatorId || '');
          
          if (!currentUser || currentUserId !== creatorId) {
            this.errorMessage = 'No tienes permiso para editar esta donación. Solo el creador puede editarla.';
            this.loading = false;
            setTimeout(() => {
              this.router.navigate(['/donations/manage', id]);
            }, 2000);
            return;
          }

          // Limpiar los FormArrays antes de rellenar
          this.articles.clear();
          this.comments.clear();

          // Llenar el formulario con los datos existentes
          this.donationForm.patchValue({
            lugarRecogida: donation.lugarRecogida || '',
            lugarDonacion: donation.lugarDonacion || '',
            comunity: donation.comunity || '',
            fechaMaximaEntrega: donation.fechaMaximaEntrega ? this.formatDateForInput(donation.fechaMaximaEntrega) : ''
          });

          // Agregar artículos existentes
          if (donation.articles && donation.articles.length > 0) {
            donation.articles.forEach(article => {
              this.articles.push(this.fb.group({
                name: [article.name, [Validators.required, Validators.maxLength(100)]],
                quantity: [article.quantity, [Validators.required, Validators.min(1)]]
              }));
            });
          }

          // Agregar comentarios existentes
          if (donation.comments && donation.comments.length > 0) {
            donation.comments.forEach(comment => {
              this.comments.push(this.fb.group({
                text: [comment.text, [Validators.required, Validators.maxLength(500)]]
              }));
            });
          }

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
            this.router.navigate(['/organization']);
          }, 2000);
        }
      });
  }

  /**
   * Convertir fecha ISO a formato compatible con input datetime-local
   */
  private formatDateForInput(isoDate: string): string {
    const date = new Date(isoDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  /**
   * Agregar nuevo artículo
   */
  onAddArticle(): void {
    if (this.articles.length >= 10) {
      this.errorMessage = 'Máximo 10 artículos permitidos';
      setTimeout(() => this.errorMessage = '', 3000);
      return;
    }

    this.articles.push(this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      quantity: [1, [Validators.required, Validators.min(1)]]
    }));
  }

  /**
   * Eliminar artículo
   */
  onRemoveArticle(index: number): void {
    if (this.articles.length > 1) {
      this.articles.removeAt(index);
    } else {
      this.errorMessage = 'Debe haber al menos un artículo';
      setTimeout(() => this.errorMessage = '', 3000);
    }
  }

  /**
   * Agregar nuevo comentario
   */
  onAddComment(): void {
    if (this.comments.length >= 5) {
      this.errorMessage = 'Máximo 5 comentarios permitidos';
      setTimeout(() => this.errorMessage = '', 3000);
      return;
    }

    this.comments.push(this.fb.group({
      text: ['', [Validators.required, Validators.maxLength(500)]]
    }));
  }

  /**
   * Eliminar comentario
   */
  onRemoveComment(index: number): void {
    this.comments.removeAt(index);
  }

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

    // Convertir fecha a ISO 8601
    const fechaMaximaEntrega = new Date(formValue.fechaMaximaEntrega).toISOString();

    const updateData = {
      lugarRecogida: formValue.lugarRecogida,
      lugarDonacion: formValue.lugarDonacion,
      articles: formValue.articles,
      comments: formValue.comments,
      comunity: formValue.comunity,
      fechaMaximaEntrega
    };

    this.donationService.updateDonation(this.donationId, updateData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.loading = false;
          this.successMessage = 'Donación actualizada exitosamente';
          
          // Redirigir al detalle después de 1.5 segundos
          setTimeout(() => {
            this.router.navigate(['/donations/manage', this.donationId]);
          }, 1500);
        },
        error: (error) => {
          this.loading = false;
          console.error('Error al actualizar donación:', error);
          console.error('Detalles del error:', {
            status: error.status,
            statusText: error.statusText,
            url: error.url,
            error: error.error
          });

          if (error.status === 400) {
            this.handleValidationErrors(error.error);
          } else if (error.status === 401) {
            this.errorMessage = 'Sesión expirada. Por favor inicia sesión nuevamente.';
            setTimeout(() => this.router.navigate(['/auth/login']), 2000);
          } else if (error.status === 403) {
            this.errorMessage = 'No tienes permiso para editar esta donación.';
          } else if (error.status === 404) {
            this.errorMessage = 'Donación no encontrada.';
          } else if (error.status === 413) {
            this.errorMessage = 'Los archivos son demasiado grandes. El tamaño máximo total permitido es 5MB.';
          } else if (error.status === 500) {
            this.errorMessage = 'Error del servidor. Por favor intenta más tarde.';
          } else {
            this.errorMessage = error.error?.message || 'Error al actualizar la donación. Intenta nuevamente.';
          }
        }
      });
  }

  /**
   * Cancelar y volver al detalle
   */
  onCancel(): void {
    this.router.navigate(['/donations/manage', this.donationId]);
  }

  /**
   * Obtener mensaje de error de un campo
   */
  getFieldError(fieldName: string): string {
    const field = this.donationForm.get(fieldName);
    
    // Primero verificar si hay un error del backend para este campo
    if (field?.hasError('serverError')) {
      return field.errors?.['serverError'] || 'Error en este campo';
    }
    
    // Luego verificar errores de validación del frontend
    if (field?.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (field?.hasError('minlength')) {
      const minLength = field.errors?.['minlength'].requiredLength;
      return `Mínimo ${minLength} caracteres`;
    }
    if (field?.hasError('maxlength')) {
      const maxLength = field.errors?.['maxlength'].requiredLength;
      return `Máximo ${maxLength} caracteres`;
    }
    if (field?.hasError('min')) {
      return 'La cantidad debe ser mayor a 0';
    }
    if (field?.hasError('max')) {
      return 'La cantidad es demasiado grande';
    }
    return '';
  }

  /**
   * Manejar errores de validación del backend
   */
  private handleValidationErrors(errorResponse: any): void {
    const errorMessages: string[] = [];
    
    // Mapeo de nombres de campos del backend al frontend
    const fieldMapping: { [key: string]: string } = {
      'title': 'title',
      'message': 'description',
      'description': 'description',
      'lugarRecogida': 'lugarRecogida',
      'lugarDonacion': 'lugarDonacion',
      'comunity': 'comunity',
      'fechaMaximaEntrega': 'fechaMaximaEntrega',
      'typePostId': 'donationTypeId',
      'typePost': 'donationTypeId',
      'articles': 'articles',
      'comments': 'comments'
    };
    
    // Si el backend devuelve un objeto 'errors' con campos específicos
    if (errorResponse?.errors && typeof errorResponse.errors === 'object') {
      Object.keys(errorResponse.errors).forEach(backendField => {
        const frontendField = fieldMapping[backendField] || backendField;
        const fieldControl = this.donationForm.get(frontendField);
        
        if (fieldControl) {
          // Obtener el mensaje de error (puede ser string o array)
          const errorMessage = Array.isArray(errorResponse.errors[backendField])
            ? errorResponse.errors[backendField][0]
            : errorResponse.errors[backendField];
          
          // Establecer el error en el campo
          fieldControl.setErrors({ serverError: errorMessage });
          fieldControl.markAsTouched();
          
          // Agregar al mensaje general
          const fieldLabel = this.getFieldLabel(frontendField);
          errorMessages.push(`${fieldLabel}: ${errorMessage}`);
        } else {
          // Si el campo no existe en el formulario, agregarlo al mensaje general
          errorMessages.push(`${backendField}: ${errorResponse.errors[backendField]}`);
        }
      });
    }
    
    // Si hay un mensaje general
    if (errorResponse?.message) {
      errorMessages.unshift(errorResponse.message);
    }
    
    // Construir mensaje final
    if (errorMessages.length > 0) {
      if (errorMessages.length === 1) {
        this.errorMessage = errorMessages[0];
      } else {
        this.errorMessage = `Errores en los siguientes campos:\n${errorMessages.join('\n')}`;
      }
    } else {
      this.errorMessage = 'Datos inválidos. Por favor verifica los campos marcados.';
    }
    
    // Marcar todos los campos como touched para mostrar errores
    Object.keys(this.donationForm.controls).forEach(key => {
      const control = this.donationForm.get(key);
      if (control && !control.valid) {
        control.markAsTouched();
      }
    });
  }

  /**
   * Obtener etiqueta amigable para un campo
   */
  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      'title': 'Título',
      'description': 'Descripción',
      'lugarRecogida': 'Lugar de Recogida',
      'lugarDonacion': 'Lugar de Donación',
      'comunity': 'Comunidad',
      'fechaMaximaEntrega': 'Fecha Máxima de Entrega',
      'donationTypeId': 'Tipo de Donación',
      'articles': 'Artículos',
      'comments': 'Comentarios'
    };
    return labels[fieldName] || fieldName;
  }
}
