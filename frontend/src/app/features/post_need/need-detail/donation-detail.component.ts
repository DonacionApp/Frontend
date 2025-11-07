import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, BehaviorSubject, takeUntil, catchError, of, combineLatest } from 'rxjs';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { DonationService, Donation } from '../../../core/services/post.service';
import { AuthService } from '../../../core/services/auth.service';

interface DonationPermissions {
  canEdit: boolean;
  canDelete: boolean;
  canExtendDate: boolean;
}

interface LoadingState {
  main: boolean;
  action: boolean;
}

interface DonationStatus {
  daysRemaining: number;
  statusClass: 'expired' | 'urgent' | 'warning' | 'normal';
  statusLabel: string;
  isExpired: boolean;
  isUrgent: boolean;
}

interface ImageValidation {
  isValid: boolean;
  url: string | null;
  error?: string;
}

/**
 * Componente de detalle de donación
 * Muestra información completa de una donación con opciones de edición/eliminación
 * Incluye validación de imágenes y manejo robusto de errores
 */
@Component({
  selector: 'app-donation-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './donation-detail.component.html',
  styleUrls: ['./donation-detail.component.scss']
})
export class DonationDetailComponent implements OnInit, OnDestroy {
  // Estado reactivo
  donation$ = new BehaviorSubject<Donation | null>(null);
  loading$ = new BehaviorSubject<LoadingState>({ main: false, action: false });
  errorMessage$ = new BehaviorSubject<string>('');
  permissions$ = new BehaviorSubject<DonationPermissions>({
    canEdit: false,
    canDelete: false,
    canExtendDate: false
  });
  
  // Información del usuario actual
  private currentUser$ = new BehaviorSubject<any>(null);
  
  // Subject para limpieza
  private destroy$ = new Subject<void>();
  
  // Constantes
  private readonly DAYS_URGENT = 3;
  private readonly DAYS_WARNING = 7;
  private readonly DATE_EXTENSION_DAYS = 10;
  private readonly ERROR_DISPLAY_DURATION = 5000;
  private readonly IMAGE_LOAD_TIMEOUT = 10000;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private donationService: DonationService,
    private authService: AuthService,
    private sanitizer: DomSanitizer
  ) {}

  // ==================== GETTERS ====================

  get donation(): Donation | null {
    return this.donation$.value;
  }

  get loading(): LoadingState {
    return this.loading$.value;
  }

  get errorMessage(): string {
    return this.errorMessage$.value;
  }

  get permissions(): DonationPermissions {
    return this.permissions$.value;
  }

  get currentUser(): any {
    return this.currentUser$.value;
  }

  /**
   * Calcula el estado actual de la donación
   */
  get donationStatus(): DonationStatus {
    const daysRemaining = this.getDaysRemaining();
    
    return {
      daysRemaining,
      statusClass: this.getStatusClass(),
      statusLabel: this.getStatusLabel(daysRemaining),
      isExpired: daysRemaining < 0,
      isUrgent: daysRemaining >= 0 && daysRemaining <= this.DAYS_URGENT
    };
  }

  /**
   * Verifica si hay imágenes válidas en la donación
   */
  get hasImages(): boolean {
    return this.getValidImages().length > 0;
  }

  /**
   * Obtiene las imágenes válidas de la donación
   */
  get validImages(): ImageValidation[] {
    return this.getValidImages();
  }

  /**
   * Obtiene la imagen principal (primera válida)
   */
  get primaryImage(): ImageValidation | null {
    const images = this.getValidImages();
    return images.length > 0 ? images[0] : null;
  }

  // ==================== LIFECYCLE HOOKS ====================

  ngOnInit(): void {
    this.initializeComponent();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  // ==================== INICIALIZACIÓN ====================

  /**
   * Inicializa el componente
   */
  private initializeComponent(): void {
    this.setupUserSubscription();
    this.loadDonationFromRoute();
  }

  /**
   * Configura la suscripción al usuario actual
   */
  private setupUserSubscription(): void {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser$.next(user);
        this.updatePermissions();
      });
  }

  /**
   * Carga la donación desde los parámetros de la ruta
   */
  private loadDonationFromRoute(): void {
    const id = this.route.snapshot.paramMap.get('id');
    
    if (!id) {
      this.handleInvalidId();
      return;
    }

    this.loadDonation(id);
  }

  /**
   * Maneja el caso de ID inválido
   */
  private handleInvalidId(): void {
    this.setError('ID de donación no válido', false);
    setTimeout(() => this.navigateToFeed(), 2000);
  }

  // ==================== CARGA DE DATOS ====================

  /**
   * Carga los datos de la donación
   */
  private loadDonation(id: string): void {
    this.setMainLoading(true);
    this.clearError();

    console.log('🔄 Cargando donación:', id);

    this.donationService.getDonationById(id)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          this.handleLoadError(error);
          return of(null);
        })
      )
      .subscribe(donation => {
        if (donation) {
          this.handleLoadSuccess(donation);
        }
        this.setMainLoading(false);
      });
  }

  /**
   * Maneja la carga exitosa de la donación
   */
  private handleLoadSuccess(donation: Donation): void {
    console.log('✅ Donación cargada:', donation);
    this.donation$.next(donation);
    this.updatePermissions();
    this.validateImages(donation);
  }

  /**
   * Maneja errores al cargar la donación
   */
  private handleLoadError(error: any): void {
    console.error('❌ Error al cargar donación:', error);
    
    const errorMessage = this.getErrorMessage(error);
    this.setError(errorMessage, false);

    if (error.status === 404) {
      setTimeout(() => this.navigateToFeed(), 3000);
    }
  }

  /**
   * Obtiene el mensaje de error apropiado según el código de estado
   */
  private getErrorMessage(error: any): string {
    switch (error.status) {
      case 404:
        return 'Donación no encontrada. Redirigiendo...';
      case 403:
        return 'No tienes permiso para ver esta donación';
      case 401:
        return 'Debes iniciar sesión para ver esta donación';
      default:
        return 'Error al cargar la donación. Por favor intenta nuevamente.';
    }
  }

  // ==================== VALIDACIÓN DE IMÁGENES ====================

  /**
   * Valida todas las imágenes de la donación
   */
  private validateImages(donation: Donation): void {
    if (!donation) return;

    const imageUrls = this.extractImageUrls(donation);
    
    if (imageUrls.length === 0) {
      console.log('ℹ️ Donación sin imágenes');
      return;
    }

    console.log('🖼️ Validando imágenes:', imageUrls);
    
    imageUrls.forEach((url, index) => {
      this.validateSingleImage(url, index);
    });
  }

  /**
   * Extrae todas las URLs de imágenes de la donación
   */
  private extractImageUrls(donation: Donation): string[] {
    // Fuente única: files mapeado por el servicio (type === 'image')
    const fromFiles = (donation.files || [])
      .filter(f => f && f.type === 'image' && typeof f.url === 'string')
      .map(f => f.url);

    // Compatibilidad por si aún vienen campos legacy (no tipados en Donation)
    const legacy: string[] = [];
    const anyDonation: any = donation as any;
    if (anyDonation.imageUrl && typeof anyDonation.imageUrl === 'string') {
      legacy.push(anyDonation.imageUrl);
    }
    if (Array.isArray(anyDonation.images)) {
      for (const img of anyDonation.images) {
        if (typeof img === 'string') legacy.push(img);
        else if (img && typeof img.url === 'string') legacy.push(img.url);
      }
    }
    if (Array.isArray(anyDonation.additionalImages)) {
      for (const u of anyDonation.additionalImages) {
        if (typeof u === 'string') legacy.push(u);
      }
    }

    return Array.from(new Set([...fromFiles, ...legacy]));
  }

  /**
   * Valida una imagen individual
   */
  private validateSingleImage(url: string, index: number): void {
    const img = new Image();
    const timeoutId = setTimeout(() => {
      console.warn(`⚠️ Timeout cargando imagen ${index}:`, url);
    }, this.IMAGE_LOAD_TIMEOUT);

    img.onload = () => {
      clearTimeout(timeoutId);
      console.log(`✅ Imagen ${index} cargada correctamente:`, url);
    };

    img.onerror = () => {
      clearTimeout(timeoutId);
      console.error(`❌ Error cargando imagen ${index}:`, url);
    };

    img.src = url;
  }

  /**
   * Obtiene las imágenes válidas con validación
   */
  private getValidImages(): ImageValidation[] {
    if (!this.donation) return [];

    const urls = this.extractImageUrls(this.donation);
    
    return urls
      .filter(url => this.isValidImageUrl(url))
      .map(url => ({
        isValid: true,
        url: this.sanitizeImageUrl(url)
      }));
  }

  /**
   * Verifica si una URL de imagen es válida
   */
  private isValidImageUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      // Si falla la validación de URL, verificar si es una ruta relativa válida
      return url.startsWith('/') || url.startsWith('./');
    }
  }

  /**
   * Sanitiza una URL de imagen para uso seguro
   */
  private sanitizeImageUrl(url: string): string {
    return url; // Angular ya sanitiza automáticamente en el template
  }

  /**
   * Obtiene una URL de imagen segura para usar en el template
   */
  getSafeImageUrl(url: string): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  /**
   * Maneja errores al cargar imágenes en el template
   */
  onImageError(event: Event, imageUrl: string): void {
    console.error('❌ Error cargando imagen en el DOM:', imageUrl);
    const imgElement = event.target as HTMLImageElement;
    
    // Ocultar la imagen o mostrar placeholder
    imgElement.style.display = 'none';
    
    // Opcional: Establecer imagen de placeholder
    // imgElement.src = '/assets/images/placeholder.png';
  }

  /**
   * Maneja la carga exitosa de imagen en el template
   */
  onImageLoad(event: Event, imageUrl: string): void {
    console.log('✅ Imagen renderizada correctamente:', imageUrl);
    const imgElement = event.target as HTMLImageElement;
    imgElement.classList.add('loaded');
  }

  // ==================== PERMISOS ====================

  /**
   * Actualiza los permisos del usuario actual
   */
  private updatePermissions(): void {
    const donation = this.donation;
    const user = this.currentUser;

    if (!donation || !user) {
      this.resetPermissions();
      return;
    }

    const permissions: DonationPermissions = {
      canEdit: this.checkEditPermission(donation, user),
      canDelete: this.checkDeletePermission(donation, user),
      canExtendDate: this.checkExtendDatePermission(donation, user)
    };

    this.permissions$.next(permissions);
    console.log('🔒 Permisos actualizados:', permissions);
  }

  /**
   * Verifica permiso de edición
   */
  private checkEditPermission(donation: Donation, user: any): boolean {
    return this.donationService.canEdit(donation, user.id);
  }

  /**
   * Verifica si se puede editar la donación
   */
  canEditDonation(): boolean {
    const donation = this.donation;
    const user = this.currentUser;
    if (!donation || !user) return false;
    return this.checkEditPermission(donation, user);
  }

  /**
   * Verifica permiso de eliminación
   */
  private checkDeletePermission(donation: Donation, user: any): boolean {
    return this.donationService.canDelete(donation, user.id);
  }

  /**
   * Verifica si se puede eliminar la donación
   */
  canDeleteDonation(): boolean {
    const donation = this.donation;
    const user = this.currentUser;
    if (!donation || !user) return false;
    return this.checkDeletePermission(donation, user);
  }

  /**
   * Verifica permiso para extender fecha
   */
  private checkExtendDatePermission(donation: Donation, user: any): boolean {
    // Solo el creador y si la donación aún está activa
    return (
      donation.userId === user.id &&
      !this.donationStatus.isExpired
    );
  }

  /**
   * Resetea los permisos
   */
  private resetPermissions(): void {
    this.permissions$.next({
      canEdit: false,
      canDelete: false,
      canExtendDate: false
    });
  }

  // ==================== ACCIONES ====================

  /**
   * Navega a la página de edición
   */
  onEdit(): void {
    if (!this.donation) return;

    if (!this.permissions.canEdit) {
      this.showPermissionError('editar');
      return;
    }

    this.router.navigate(['/donations/manage', this.donation.id, 'edit']);
  }

  /**
   * Elimina la donación
   */
  onDelete(): void {
    if (!this.donation) return;

    if (!this.permissions.canDelete) {
      this.showPermissionError('eliminar');
      return;
    }

    this.confirmAndDelete();
  }

  /**
   * Confirma y ejecuta la eliminación
   */
  private confirmAndDelete(): void {
    const confirmed = confirm(
      '¿Estás seguro de eliminar esta donación?\n\n' +
      'Esta acción no se puede deshacer y se perderá toda la información.'
    );

    if (!confirmed) return;

    this.performDelete();
  }

  /**
   * Ejecuta la eliminación de la donación
   */
  private performDelete(): void {
    if (!this.donation) return;

    this.setActionLoading(true);
    console.log('🗑️ Eliminando donación:', this.donation.id);

    this.donationService.deletePublication(this.donation.id)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          this.handleDeleteError(error);
          return of(null);
        })
      )
      .subscribe({
        next: () => {
          this.handleDeleteSuccess();
          this.setActionLoading(false);
        },
        error: (error: any) => {
          this.handleDeleteError(error);
          this.setActionLoading(false);
        }
      });
  }

  /**
   * Maneja la eliminación exitosa
   */
  private handleDeleteSuccess(): void {
    console.log('✅ Donación eliminada exitosamente');
    this.router.navigate(['/donations/feed'], {
      queryParams: { message: 'Donación eliminada exitosamente' }
    });
  }

  /**
   * Maneja errores al eliminar
   */
  private handleDeleteError(error: any): void {
    console.error('❌ Error al eliminar donación:', error);
    
    const message = error.status === 403
      ? 'No tienes permiso para eliminar esta donación'
      : 'Error al eliminar la donación. Por favor intenta nuevamente.';
    
    this.setError(message, true);
  }

  /**
   * Extiende la fecha de entrega
   */
  onExtendDate(): void {
    if (!this.donation) return;

    if (!this.permissions.canExtendDate) {
      this.showPermissionError('extender la fecha de');
      return;
    }

    this.confirmAndExtend();
  }

  /**
   * Confirma y ejecuta la extensión de fecha
   */
  private confirmAndExtend(): void {
    const confirmed = confirm(
      `¿Deseas extender la fecha máxima de entrega en ${this.DATE_EXTENSION_DAYS} días?`
    );

    if (!confirmed) return;

    this.performDateExtension();
  }

  /**
   * Ejecuta la extensión de fecha
   */
  private performDateExtension(): void {
    if (!this.donation) return;

    this.setActionLoading(true);
    console.log('📅 Extendiendo fecha de donación:', this.donation.id);

    this.donationService.extendDeliveryDate(this.donation.id)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          this.handleExtendDateError(error);
          return of(null);
        })
      )
      .subscribe(updatedDonation => {
        if (updatedDonation) {
          this.handleExtendDateSuccess(updatedDonation);
        }
        this.setActionLoading(false);
      });
  }

  /**
   * Maneja la extensión exitosa de fecha
   */
  private handleExtendDateSuccess(updatedDonation: Donation): void {
    console.log('✅ Fecha extendida exitosamente');
    this.donation$.next(updatedDonation);
    this.updatePermissions();
    
    this.showSuccessMessage(
      `Fecha extendida ${this.DATE_EXTENSION_DAYS} días. ` +
      `Nueva fecha: ${this.formatDate(updatedDonation.fechaMaximaEntrega)}`
    );
  }

  /**
   * Maneja errores al extender fecha
   */
  private handleExtendDateError(error: any): void {
    console.error('❌ Error al extender fecha:', error);
    this.setError('Error al extender la fecha. Por favor intenta nuevamente.', true);
  }

  /**
   * Navega de regreso al feed
   */
  onBack(): void {
    this.navigateToFeed();
  }

  /**
   * Navega al feed de donaciones
   */
  private navigateToFeed(): void {
    const userRole = this.currentUser?.role;
    
    if (userRole === 'organization') {
      this.router.navigate(['/organization']);
    } else {
      this.router.navigate(['/donations/feed']);
    }
  }

  // ==================== FORMATEO Y ESTADO ====================

  /**
   * Formatea una fecha para mostrar
   */
  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'No especificado';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Fecha inválida';
      
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Fecha inválida';
    }
  }

  /**
   * Formatea una fecha en formato corto
   */
  formatDateShort(dateString: string | undefined): string {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  }

  /**
   * Calcula los días restantes hasta la fecha máxima
   */
  getDaysRemaining(): number {
    if (!this.donation?.fechaMaximaEntrega) return 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const maxDate = new Date(this.donation.fechaMaximaEntrega);
    maxDate.setHours(0, 0, 0, 0);
    
    const diff = maxDate.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Obtiene la clase CSS según el estado
   */
  getStatusClass(): 'expired' | 'urgent' | 'warning' | 'normal' {
    const days = this.getDaysRemaining();
    if (days < 0) return 'expired';
    if (days <= this.DAYS_URGENT) return 'urgent';
    if (days <= this.DAYS_WARNING) return 'warning';
    return 'normal';
  }

  /**
   * Obtiene la etiqueta de estado
   */
  private getStatusLabel(days: number): string {
    if (days < 0) return 'Expirada';
    if (days === 0) return 'Expira hoy';
    if (days === 1) return 'Expira mañana';
    if (days <= this.DAYS_URGENT) return 'Urgente';
    if (days <= this.DAYS_WARNING) return 'Próxima a vencer';
    return 'Activa';
  }

  /**
   * Obtiene el texto descriptivo de días restantes
   */
  getDaysRemainingText(): string {
    const days = this.getDaysRemaining();
    
    if (days < 0) return `Expiró hace ${Math.abs(days)} días`;
    if (days === 0) return 'Expira hoy';
    if (days === 1) return 'Expira mañana';
    return `${days} días restantes`;
  }

  // ==================== UTILIDADES ====================

  /**
   * Establece el estado de carga principal
   */
  private setMainLoading(loading: boolean): void {
    const current = this.loading$.value;
    this.loading$.next({ ...current, main: loading });
  }

  /**
   * Establece el estado de carga de acciones
   */
  private setActionLoading(loading: boolean): void {
    const current = this.loading$.value;
    this.loading$.next({ ...current, action: loading });
  }

  /**
   * Establece un mensaje de error
   */
  private setError(message: string, temporary: boolean = false): void {
    this.errorMessage$.next(message);
    
    if (temporary) {
      setTimeout(() => this.clearError(), this.ERROR_DISPLAY_DURATION);
    }
  }

  /**
   * Limpia el mensaje de error
   */
  private clearError(): void {
    this.errorMessage$.next('');
  }

  /**
   * Muestra un mensaje de error de permisos
   */
  private showPermissionError(action: string): void {
    this.setError(
      `No tienes permiso para ${action} esta donación. Solo el creador puede realizar esta acción.`,
      true
    );
  }

  /**
   * Muestra un mensaje de éxito
   */
  private showSuccessMessage(message: string): void {
    // Aquí puedes implementar un toast o notificación
    alert(message);
  }

  /**
   * Limpia recursos y suscripciones
   */
  private cleanup(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.donation$.complete();
    this.loading$.complete();
    this.errorMessage$.complete();
    this.permissions$.complete();
    this.currentUser$.complete();
  }

  /**
   * TrackBy function para lista de imágenes
   */
  trackByImageUrl(index: number, image: ImageValidation): string {
    return image.url || index.toString();
  }
}