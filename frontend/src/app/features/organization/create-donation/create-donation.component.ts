import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { DonationService, CreateDonationDTO, Article, Comment } from '../../../core/services/donation.service';

@Component({
  selector: 'app-create-donation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-donation.component.html',
  styleUrls: ['./create-donation.component.scss']
})
export class CreateDonationComponent implements OnInit {
  donationForm!: FormGroup;
  loading = false;
  successMessage = '';
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private donationService: DonationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initializeForm();
  }

  private initializeForm(): void {
    this.donationForm = this.fb.group({
      lugarRecogida: ['', [Validators.required, Validators.minLength(5)]],
      lugarDonacion: ['', [Validators.required, Validators.minLength(5)]],
      comunity: ['', [Validators.required, Validators.minLength(3)]],
      fechaMaximaEntrega: ['', [Validators.required]],
      articles: this.fb.array([this.createArticleFormGroup()]),
      comments: this.fb.array([this.createCommentFormGroup()])
    });

    // Establecer fecha mínima (hoy)
    const today = new Date().toISOString().split('T')[0];
    this.donationForm.get('fechaMaximaEntrega')?.setValue(today);
  }

  // FormArrays getters
  get articles(): FormArray {
    return this.donationForm.get('articles') as FormArray;
  }

  get comments(): FormArray {
    return this.donationForm.get('comments') as FormArray;
  }

  // Crear FormGroup para un artículo
  private createArticleFormGroup(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      quantity: [1, [Validators.required, Validators.min(1), Validators.max(1000)]]
    });
  }

  // Crear FormGroup para un comentario
  private createCommentFormGroup(): FormGroup {
    return this.fb.group({
      text: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]]
    });
  }

  // Agregar artículo
  addArticle(): void {
    if (this.articles.length < 10) {
      this.articles.push(this.createArticleFormGroup());
    }
  }

  // Eliminar artículo
  removeArticle(index: number): void {
    if (this.articles.length > 1) {
      this.articles.removeAt(index);
    }
  }

  // Agregar comentario
  addComment(): void {
    if (this.comments.length < 5) {
      this.comments.push(this.createCommentFormGroup());
    }
  }

  // Eliminar comentario
  removeComment(index: number): void {
    if (this.comments.length > 1) {
      this.comments.removeAt(index);
    }
  }

  // Validar si un campo tiene errores
  hasError(fieldName: string): boolean {
    const field = this.donationForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  // Obtener mensaje de error
  getErrorMessage(fieldName: string): string {
    const field = this.donationForm.get(fieldName);
    if (field?.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (field?.hasError('minlength')) {
      const minLength = field.errors?.['minlength'].requiredLength;
      return `Mínimo ${minLength} caracteres`;
    }
    if (field?.hasError('min')) {
      return 'La cantidad debe ser mayor a 0';
    }
    if (field?.hasError('max')) {
      return 'La cantidad es demasiado grande';
    }
    return '';
  }

  // Enviar formulario
  onSubmit(): void {
    if (this.donationForm.invalid) {
      // Marcar todos los campos como touched para mostrar errores
      Object.keys(this.donationForm.controls).forEach(key => {
        this.donationForm.get(key)?.markAsTouched();
      });
      
      // Marcar todos los artículos y comentarios
      this.articles.controls.forEach(control => {
        Object.keys((control as FormGroup).controls).forEach(key => {
          control.get(key)?.markAsTouched();
        });
      });
      
      this.comments.controls.forEach(control => {
        Object.keys((control as FormGroup).controls).forEach(key => {
          control.get(key)?.markAsTouched();
        });
      });

      this.errorMessage = 'Por favor completa todos los campos requeridos correctamente';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    // Preparar datos para enviar
    const formValue = this.donationForm.value;
    
    // Convertir la fecha a formato ISO con hora
    const fechaDate = new Date(formValue.fechaMaximaEntrega);
    fechaDate.setHours(23, 59, 59, 999); // Establecer a las 23:59:59
    
    const donationData: CreateDonationDTO = {
      lugarRecogida: formValue.lugarRecogida.trim(),
      lugarDonacion: formValue.lugarDonacion.trim(),
      comunity: formValue.comunity.trim(),
      fechaMaximaEntrega: fechaDate.toISOString(),
      articles: formValue.articles.map((article: Article) => ({
        name: article.name.trim(),
        quantity: article.quantity
      })),
      comments: formValue.comments.map((comment: Comment) => ({
        text: comment.text.trim()
      }))
    };

    this.donationService.createDonation(donationData).subscribe({
      next: (newDonation) => {
        this.loading = false;
        this.successMessage = '¡Donación creada exitosamente!';
        
        // Limpiar formulario
        this.donationForm.reset();
        this.initializeForm();
        
        // Redirigir a la lista de donaciones después de 2 segundos
        setTimeout(() => {
          this.router.navigate(['/organization/donations']);
        }, 2000);
      },
      error: (error) => {
        this.loading = false;
        console.error('Error al crear donación:', error);
        
        if (error.status === 400) {
          this.errorMessage = 'Datos inválidos. Por favor verifica los campos.';
        } else if (error.status === 401) {
          this.errorMessage = 'Sesión expirada. Por favor inicia sesión nuevamente.';
        } else if (error.status === 500) {
          this.errorMessage = 'Error del servidor. Por favor intenta más tarde.';
        } else {
          this.errorMessage = 'Error al crear la donación. Por favor intenta nuevamente.';
        }
      }
    });
  }

  // Cancelar y volver
  onCancel(): void {
    if (confirm('¿Estás seguro de cancelar? Se perderán los datos ingresados.')) {
      this.router.navigate(['/organization/donations']);
    }
  }

  // Limpiar mensajes
  clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }
}
