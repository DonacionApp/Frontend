import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { DonationService, Donation } from '../../../core/services/donation.service';
import { PostDonationArticleService, PostDonationArticle, AddArticleDTO, UpdateQuantityDTO } from '../../../core/services/post-donation-article.service';
import { PostsService, Post, PostArticle as AvailablePostArticle } from '../../../core/services/posts.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-manage-donation-articles',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './manage-donation-articles.component.html',
  styleUrls: ['./manage-donation-articles.component.scss']
})
export class ManageDonationArticlesComponent implements OnInit, OnDestroy {
  donation: Donation | null = null;
  donationArticles: PostDonationArticle[] = [];
  availablePostArticles: AvailablePostArticle[] = [];
  
  articlesForm!: FormGroup;
  loading = false;
  errorMessage = '';
  successMessage = '';
  
  private destroy$ = new Subject<void>();
  private donationId = 0;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private donationService: DonationService,
    private articleService: PostDonationArticleService,
    private postsService: PostsService,
    private authService: AuthService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.donationId = id ? parseInt(id) : 0;
    
    if (this.donationId) {
      this.loadData();
    } else {
      this.errorMessage = 'ID de donación no válido';
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.articlesForm = this.fb.group({
      currentArticles: this.fb.array([]),
      newArticleId: [null],
      newArticleQuantity: [1, [Validators.required, Validators.min(1)]]
    });
  }

  get currentArticles(): FormArray {
    return this.articlesForm.get('currentArticles') as FormArray;
  }

  /**
   * Cargar donación y artículos
   */
  private loadData(): void {
    this.loading = true;
    
    this.donationService.getDonationById(this.donationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (donation) => {
          this.donation = donation;
          
          // Verificar permisos
          if (!this.canManageArticles()) {
            this.errorMessage = 'No tienes permiso para gestionar los artículos de esta donación.';
            setTimeout(() => this.onCancel(), 2000);
            return;
          }

          // Cargar artículos actuales y disponibles del post
          this.loadArticles();
        },
        error: (error) => {
          this.loading = false;
          console.error('Error al cargar donación:', error);
          
          if (error.status === 404) {
            this.errorMessage = 'Donación no encontrada';
          } else if (error.status === 403) {
            this.errorMessage = 'No tienes permiso para acceder a esta donación';
          } else {
            this.errorMessage = 'Error al cargar la donación. Verifica tu conexión';
          }
          setTimeout(() => this.onCancel(), 2000);
        }
      });
  }

  /**
   * Cargar artículos de la donación y del post
   */
  private loadArticles(): void {
    if (!this.donation) return;

    // Los artículos de la donación ya vienen en donation.articles
    // Solo necesitamos cargar los artículos disponibles del post
    this.postsService.getPostById(this.donation.post.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (postData) => {
          // Convertir los artículos de la donación al formato PostDonationArticle
          this.donationArticles = this.donation!.articles.map(article => ({
            id: article.id,
            quantity: article.quantity,
            postArticleId: article.postArticleId || 0,
            article: article.article,
            status: undefined
          }));
          
          this.availablePostArticles = postData.postArticle || [];
          
          // Poblar formulario con artículos actuales
          this.populateCurrentArticles();
          this.loading = false;
        },
        error: (error) => {
          this.loading = false;
          console.error('Error al cargar artículos:', error);
          
          if (error.status === 404) {
            this.errorMessage = 'No se encontraron los artículos del post';
          } else {
            this.errorMessage = 'Error al cargar artículos disponibles. Verifica tu conexión';
          }
        }
      });
  }

  /**
   * Poblar FormArray con artículos actuales
   */
  private populateCurrentArticles(): void {
    this.currentArticles.clear();
    
    this.donationArticles.forEach(article => {
      const maxAvailable = this.getMaxQuantityForArticle(article.postArticleId);
      
      this.currentArticles.push(this.fb.group({
        id: [article.id],
        postArticleId: [article.postArticleId],
        articleName: [article.article.name],
        articleDescription: [article.article.descripcion],
        quantity: [parseInt(article.quantity), [
          Validators.required,
          Validators.min(1),
          Validators.max(maxAvailable)
        ]],
        maxQuantity: [maxAvailable],
        originalQuantity: [parseInt(article.quantity)]
      }));
    });
  }

  /**
   * Obtener cantidad máxima disponible para un artículo del post
   */
  private getMaxQuantityForArticle(postArticleId: number): number {
    const postArticle = this.availablePostArticles.find(a => a.id === postArticleId);
    return postArticle ? parseInt(postArticle.quantity) : 1;
  }

  /**
   * Verificar si el usuario puede gestionar artículos
   */
  private canManageArticles(): boolean {
    if (!this.donation) return false;

    const currentUser = this.authService.currentUserValue;
    if (!currentUser) return false;

    const currentUserId = String(currentUser.id);
    const beneficiaryId = String(this.donation.beneficiary?.id);
    const donatorId = String(this.donation.donator?.id);
    
    const isBeneficiary = currentUserId === beneficiaryId;
    const isDonator = currentUserId === donatorId;
    const isPending = this.donation.statusDonation?.status?.toLowerCase() === 'pendiente';

    return (isBeneficiary || isDonator) && isPending;
  }

  /**
   * Actualizar cantidad de un artículo existente
   */
  onUpdateQuantity(index: number): void {
    const articleGroup = this.currentArticles.at(index) as FormGroup;
    const articleId = articleGroup.get('id')?.value;
    const newQuantity = articleGroup.get('quantity')?.value;
    const originalQuantity = articleGroup.get('originalQuantity')?.value;

    if (newQuantity === originalQuantity) {
      return; // No hay cambios
    }

    if (articleGroup.get('quantity')?.invalid) {
      this.errorMessage = 'Cantidad inválida';
      return;
    }

    this.loading = true;
    const updateData: UpdateQuantityDTO = {
      postDonationArticleId: articleId,
      newQuantity: newQuantity
    };

    this.articleService.updateQuantity(updateData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loading = false;
          articleGroup.get('originalQuantity')?.setValue(newQuantity);
          this.successMessage = 'Cantidad actualizada correctamente';
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: (error) => {
          this.loading = false;
          console.error('Error al actualizar cantidad:', error);
          
          if (error.status === 400) {
            this.errorMessage = error.error?.message || 'La cantidad solicitada no es válida o excede la disponible';
          } else if (error.status === 404) {
            this.errorMessage = 'El artículo ya no existe en la donación';
          } else {
            this.errorMessage = 'Error al actualizar cantidad. Intenta nuevamente';
          }
          setTimeout(() => this.errorMessage = '', 4000);
        }
      });
  }

  /**
   * Eliminar un artículo
   */
  onRemoveArticle(index: number): void {
    const articleGroup = this.currentArticles.at(index) as FormGroup;
    const articleId = articleGroup.get('id')?.value;
    const articleName = articleGroup.get('articleName')?.value;

    if (!confirm(`¿Estás seguro de eliminar "${articleName}" de la donación?`)) {
      return;
    }

    this.loading = true;
    this.articleService.removeArticle(articleId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loading = false;
          this.currentArticles.removeAt(index);
          this.donationArticles = this.donationArticles.filter(a => a.id !== articleId);
          this.successMessage = 'Artículo eliminado correctamente';
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: (error) => {
          this.loading = false;
          console.error('Error al eliminar artículo:', error);
          this.errorMessage = error.error?.message || 'Error al eliminar artículo';
          setTimeout(() => this.errorMessage = '', 3000);
        }
      });
  }

  /**
   * Agregar nuevo artículo
   */
  onAddArticle(): void {
    const newArticleId = this.articlesForm.get('newArticleId')?.value;
    const newArticleQuantity = this.articlesForm.get('newArticleQuantity')?.value;

    if (!newArticleId) {
      this.errorMessage = 'Selecciona un artículo';
      return;
    }

    // Verificar si ya existe
    const alreadyExists = this.donationArticles.some(a => a.postArticleId === parseInt(newArticleId));
    if (alreadyExists) {
      this.errorMessage = 'Este artículo ya está en la donación. Edita la cantidad si necesitas cambiarla.';
      setTimeout(() => this.errorMessage = '', 3000);
      return;
    }

    this.loading = true;
    const addData: AddArticleDTO = {
      donationId: this.donationId,
      postArticleId: parseInt(newArticleId),
      quantity: newArticleQuantity
    };

    this.articleService.addArticle(addData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (newArticle) => {
          this.loading = false;
          this.donationArticles.push(newArticle);
          
          // Resetear formulario de agregar
          this.articlesForm.patchValue({
            newArticleId: null,
            newArticleQuantity: 1
          });
          
          // Recargar lista
          this.populateCurrentArticles();
          
          this.successMessage = 'Artículo agregado correctamente';
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: (error) => {
          this.loading = false;
          console.error('Error al agregar artículo:', error);
          this.errorMessage = error.error?.message || 'Error al agregar artículo';
          setTimeout(() => this.errorMessage = '', 3000);
        }
      });
  }

  /**
   * Obtener artículos disponibles para agregar (que no estén ya en la donación)
   */
  getAvailableArticlesToAdd(): AvailablePostArticle[] {
    const existingIds = this.donationArticles.map(a => a.postArticleId);
    return this.availablePostArticles.filter(a => 
      !existingIds.includes(a.id) && a.status?.status?.toLowerCase() === 'disponible'
    );
  }

  /**
   * Actualizar máximo de cantidad al seleccionar artículo nuevo
   */
  onNewArticleChange(): void {
    const selectedId = this.articlesForm.get('newArticleId')?.value;
    if (selectedId) {
      const article = this.availablePostArticles.find(a => a.id === parseInt(selectedId));
      if (article) {
        const maxQ = parseInt(article.quantity);
        this.articlesForm.get('newArticleQuantity')?.setValidators([
          Validators.required,
          Validators.min(1),
          Validators.max(maxQ)
        ]);
        this.articlesForm.get('newArticleQuantity')?.updateValueAndValidity();
      }
    }
  }

  /**
   * Obtener máximo para artículo seleccionado
   */
  getMaxForNewArticle(): number {
    const selectedId = this.articlesForm.get('newArticleId')?.value;
    if (!selectedId) return 1;
    
    const article = this.availablePostArticles.find(a => a.id === parseInt(selectedId));
    return article ? parseInt(article.quantity) : 1;
  }

  /**
   * Cancelar y volver
   */
  onCancel(): void {
    this.location.back();
  }
}
