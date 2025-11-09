import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { DonationService, CreateDonationDTO, ArticleInput, Comment } from '../../../core/services/donation.service';
import { PostsService, Post, PostArticle } from '../../../core/services/posts.service';

/**
 * Validador personalizado para asegurar que la fecha no sea anterior a hoy
 */
function minDateValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  
  const selectedDate = new Date(control.value);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Resetear horas para comparar solo fecha
  
  if (selectedDate < today) {
    return { minDate: { value: control.value, message: 'La fecha no puede ser anterior a hoy' } };
  }
  
  return null;
}

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
  
  // Datos del post
  postId!: number;
  post: Post | null = null;
  availableArticles: PostArticle[] = [];
  loadingPost = false;

  // Fecha mínima (hoy)
  minDate: string;

  constructor(
    private fb: FormBuilder,
    private donationService: DonationService,
    private postsService: PostsService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    // Establecer fecha mínima como hoy
    const today = new Date();
    this.minDate = today.toISOString().split('T')[0];
  }

  ngOnInit(): void {
    // Obtener el postId tanto de parámetros de ruta como de query params (ej: ?post=5)
    this.route.params.subscribe(params => {
      let idFromParams = params['id'];
      // Si no viene en params, intentar en query params (por ejemplo ?post=5)
      if (!idFromParams) {
        idFromParams = this.route.snapshot.queryParamMap.get('post');
      }

      this.postId = idFromParams ? +idFromParams : NaN;
      if (this.postId && !isNaN(this.postId)) {
        this.errorMessage = '';
        this.loadPost();
      } else {
        this.errorMessage = 'No se proporcionó un ID de publicación válido';
      }
    });
  }

  /**
   * Cargar datos del post con sus artículos
   */
  private loadPost(): void {
    this.loadingPost = true;
    this.postsService.getPostById(this.postId).subscribe({
      next: (post) => {
        this.post = post;
        this.availableArticles = post.postArticle || [];
        
        if (this.availableArticles.length === 0) {
          this.errorMessage = 'Esta publicación no tiene artículos disponibles';
          this.loadingPost = false;
          return;
        }
        
        this.initializeForm();
        this.loadingPost = false;
      },
      error: (error) => {
        console.error('Error al cargar post:', error);
        this.loadingPost = false;
        
        if (error.status === 404) {
          this.errorMessage = 'La publicación no existe o fue eliminada';
        } else if (error.status === 403) {
          this.errorMessage = 'No tienes permiso para acceder a esta publicación';
        } else if (error.status === 500) {
          this.errorMessage = 'Error del servidor al cargar la publicación. Intenta más tarde';
        } else {
          this.errorMessage = 'No se pudo cargar la información de la publicación. Verifica tu conexión';
        }
      }
    });
  }

  private initializeForm(): void {
    this.donationForm = this.fb.group({
      lugarRecogida: ['', [Validators.required, Validators.minLength(5)]],
      lugarDonacion: ['', [Validators.required, Validators.minLength(5)]],
      fechaMaximaEntrega: ['', [Validators.required, minDateValidator]],
      articles: this.fb.array([], [Validators.required, Validators.minLength(1)]),
      comments: this.fb.array([this.createCommentFormGroup()])
    });

    // Establecer fecha mínima (hoy)
    const today = new Date().toISOString().split('T')[0];
    this.donationForm.get('fechaMaximaEntrega')?.setValue(today);
    
    // Agregar artículos disponibles como checkboxes
    this.initializeArticlesSelection();
  }

  // FormArrays getters
  get articles(): FormArray {
    return this.donationForm.get('articles') as FormArray;
  }

  get comments(): FormArray {
    return this.donationForm.get('comments') as FormArray;
  }

  /**
   * Inicializar selección de artículos del post
   */
  private initializeArticlesSelection(): void {
    // Crear un FormGroup por cada artículo disponible
    this.availableArticles.forEach(postArticle => {
      const maxQ = parseInt(postArticle.quantity) || 1;
      this.articles.push(this.fb.group({
        articlePostId: [postArticle.id],
        articleName: [postArticle.article.name],
        articleDescription: [postArticle.article.descripcion],
        maxQuantity: [maxQ],
        selected: [false],
        // quantity con validadores dinámicos incluyendo max
        quantity: [{ value: 1, disabled: true }, [Validators.required, Validators.min(1), Validators.max(maxQ)]]
      }));
    });
  }

  /**
   * Manejar cambio en checkbox de artículo
   */
  onArticleSelectionChange(index: number): void {
    const articleGroup = this.articles.at(index) as FormGroup;
    const selected = articleGroup.get('selected')?.value;
    const quantityControl = articleGroup.get('quantity');
    const maxQ = articleGroup.get('maxQuantity')?.value || 1;

    if (selected && maxQ > 1) {
      // habilitar edición solo si hay más de 1 disponible
      quantityControl?.setValidators([Validators.required, Validators.min(1), Validators.max(maxQ)]);
      quantityControl?.updateValueAndValidity();
      quantityControl?.enable();
    } else {
      // si no está seleccionado o solo hay 1 disponible, mantener valor 1 y deshabilitado
      quantityControl?.clearValidators();
      quantityControl?.updateValueAndValidity();
      quantityControl?.setValue(1);
      quantityControl?.disable();
    }
    
    // Actualizar validador del array
    this.updateArticlesValidator();
  }

  /**
   * Actualizar validación: al menos un artículo debe estar seleccionado
   */
  private updateArticlesValidator(): void {
    const hasSelected = this.articles.controls.some(
      control => control.get('selected')?.value === true
    );
    
    if (!hasSelected) {
      this.articles.setErrors({ noSelection: true });
    } else {
      this.articles.setErrors(null);
    }
  }

  /**
   * Actualizar máximo de cantidad cuando el usuario cambia la cantidad
   */
  onQuantityChange(index: number): void {
    const articleGroup = this.articles.at(index) as FormGroup;
    const quantity = articleGroup.get('quantity')?.value;
    const maxQuantity = articleGroup.get('maxQuantity')?.value;
    
    if (quantity > maxQuantity) {
      articleGroup.get('quantity')?.setValue(maxQuantity);
    }
  }

  // Crear FormGroup para un comentario
  private createCommentFormGroup(): FormGroup {
    return this.fb.group({
      message: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]]
    });
  }

  // Agregar comentario
  addComment(): void {
    if (this.comments.length < 5) {
      this.comments.push(this.createCommentFormGroup());
    }
  }

  // Eliminar comentario
  removeComment(index: number): void {
    if (this.comments.length > 0) {
      this.comments.removeAt(index);
    }
  }

  // Verificar si hay al menos un artículo seleccionado
  hasSelectedArticles(): boolean {
    return this.articles.controls.some(control => control.get('selected')?.value === true);
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
    if (field?.hasError('minDate')) {
      return field.errors?.['minDate'].message || 'La fecha no puede ser anterior a hoy';
    }
    return '';
  }

  // Helpers seguros para acceder a availableArticles desde la plantilla
  getArticleName(index: number): string {
    const a = this.availableArticles[index];
    return a && a.article && a.article.name ? a.article.name : 'Artículo';
  }

  getArticleDescripcion(index: number): string {
    const a = this.availableArticles[index];
    return a && a.article && a.article.descripcion ? a.article.descripcion : '';
  }

  getArticleQuantity(index: number): number {
    const a = this.availableArticles[index];
    if (!a) return 0;
    const q = a.quantity;
    return typeof q === 'number' ? q : parseInt(String(q || '0')) || 0;
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

      this.errorMessage = 'Por favor completa todos los campos requeridos correctamente y selecciona al menos un artículo';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    // Preparar datos para enviar
    const formValue = this.donationForm.getRawValue(); // getRawValue() incluye campos disabled
    
    // Filtrar solo artículos seleccionados
    const selectedArticles: ArticleInput[] = formValue.articles
      .filter((article: any) => article.selected)
      .map((article: any) => ({
        articlePostId: article.articlePostId,
        quantity: parseInt(article.quantity)
      }));

    // Filtrar comentarios no vacíos
    const comments: Comment[] = formValue.comments
      .filter((comment: any) => comment.message && comment.message.trim())
      .map((comment: any) => ({
        message: comment.message.trim()
      }));
    
    // Enviar la fecha en formato ISO con hora (18:00:00 UTC) como Postman lo hace
    // El input type="date" devuelve "YYYY-MM-DD", lo convertimos a ISO con hora
    // El backend acepta formato ISO y devuelve solo la fecha
    const fechaString = formValue.fechaMaximaEntrega; // Formato: "YYYY-MM-DD"
    const [year, month, day] = fechaString.split('-').map(Number);
    // Crear fecha a las 18:00:00 UTC del día seleccionado (igual que Postman)
    const fechaDate = new Date(Date.UTC(year, month - 1, day, 18, 0, 0, 0));
    
    const donationData: CreateDonationDTO = {
      postId: this.postId,
      lugarRecogida: formValue.lugarRecogida.trim(),
      lugarDonacion: formValue.lugarDonacion.trim(),
      fechaMaximaEntrega: fechaDate.toISOString(), // Formato: "YYYY-MM-DDTHH:mm:ss.sssZ"
      articles: selectedArticles,
      comments: comments.length > 0 ? comments : [],
      statusDonation: 1 // Pendiente por defecto
    };

    this.donationService.createDonation(donationData).subscribe({
      next: (newDonation) => {
        this.loading = false;
        this.successMessage = '¡Donación creada exitosamente!';
        
        // Redirigir a la lista de donaciones después de 2 segundos
        setTimeout(() => {
          this.router.navigate(['/organization/dashboard']);
        }, 2000);
      },
      error: (error) => {
        this.loading = false;
        console.error('Error al crear donación:', error);
        
        if (error.status === 400) {
          this.errorMessage = 'Datos inválidos. Por favor verifica los campos.';
        } else if (error.status === 401) {
          this.errorMessage = 'Sesión expirada. Por favor inicia sesión nuevamente.';
        } else if (error.status === 403) {
          // Organización no verificada
          this.errorMessage = error.error?.message || 'Solo organizaciones verificadas pueden crear donaciones. Por favor espera a que tu cuenta sea verificada por un administrador.';
        } else if (error.status === 404) {
          this.errorMessage = 'Endpoint no encontrado. Verifica la configuración del servidor.';
        } else if (error.status === 500) {
          this.errorMessage = 'Error del servidor. Por favor intenta más tarde.';
        } else {
          this.errorMessage = error.error?.message || 'Error al crear la donación. Por favor intenta nuevamente.';
        }
      }
    });
  }

  // Cancelar y volver
  onCancel(): void {
    if (confirm('¿Estás seguro de cancelar? Se perderán los datos ingresados.')) {
      this.router.navigate(['/organization/dashboard']);
    }
  }

  // Limpiar mensajes
  clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }
}
