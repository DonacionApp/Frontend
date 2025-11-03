import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, finalize } from 'rxjs';
import { ModalComponent } from '../modal/modal.component';
import { DonationService } from '../../../core/services/donation.service';
import { SpinnerComponent } from '../spinner/spinner.component';

interface UserLike {
  id?: string;
  userId: string;
  user?: {
    id: string;
    username: string;
    email: string;
    profilePhoto?: string;
  };
  createdAt?: string;
}

/**
 * Componente modal para mostrar la lista de usuarios que dieron like a una donación
 */
@Component({
  selector: 'app-likes-modal',
  standalone: true,
  imports: [CommonModule, ModalComponent, SpinnerComponent],
  template: `
    <app-modal
      [isOpen]="isOpen"
      [title]="modalTitle"
      [size]="'sm'"
      (onClose)="handleClose()"
    >
      <div class="space-y-3">
        <!-- Loading State -->
        <div *ngIf="loading" class="flex justify-center py-8" role="status" aria-live="polite">
          <app-spinner aria-label="Cargando usuarios"></app-spinner>
        </div>

        <!-- Error State -->
        <div 
          *ngIf="error && !loading" 
          class="bg-red-50 border border-red-200 rounded-lg p-4"
          role="alert"
        >
          <div class="flex items-start">
            <svg class="w-5 h-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
            </svg>
            <div>
              <p class="text-sm font-medium text-red-800">{{ error }}</p>
              <button 
                *ngIf="canRetry"
                (click)="retryLoad()"
                class="mt-2 text-sm text-red-600 hover:text-red-800 underline focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
              >
                Intentar nuevamente
              </button>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div 
          *ngIf="showEmptyState" 
          class="text-center py-8"
        >
          <svg 
            class="w-16 h-16 text-gray-300 mx-auto mb-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path 
              stroke-linecap="round" 
              stroke-linejoin="round" 
              stroke-width="2" 
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
          <p class="text-gray-500 text-sm">Aún no hay personas que hayan dado like</p>
        </div>

        <!-- Users List -->
        <div 
          *ngIf="showUsersList" 
          class="space-y-2 max-h-96 overflow-y-auto custom-scrollbar"
          role="list"
        >
          <article
            *ngFor="let userLike of users; trackBy: trackByUserId"
            class="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-blue-500"
            role="listitem"
          >
            <!-- Avatar -->
            <div class="flex-shrink-0">
              <img
                [src]="getUserAvatar(userLike)"
                [alt]="getUsername(userLike)"
                class="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                (error)="handleImageError($event)"
                loading="lazy"
              />
            </div>

            <!-- User Info -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 truncate">
                {{ getUsername(userLike) }}
              </p>
              <p 
                *ngIf="getUserEmail(userLike)" 
                class="text-xs text-gray-500 truncate"
              >
                {{ getUserEmail(userLike) }}
              </p>
            </div>

            <!-- Verified Badge -->
            <div 
              *ngIf="isVerified(userLike)" 
              class="flex-shrink-0"
              [attr.aria-label]="'Usuario verificado'"
              [attr.title]="'Usuario verificado'"
            >
              <svg 
                class="w-4 h-4 text-blue-500" 
                fill="currentColor" 
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path 
                  fill-rule="evenodd" 
                  d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                  clip-rule="evenodd"
                />
              </svg>
            </div>
          </article>
        </div>
      </div>
    </app-modal>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar {
      width: 8px;
    }
    
    .custom-scrollbar::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 4px;
    }
    
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #cbd5e0;
      border-radius: 4px;
    }
    
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #a0aec0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LikesModalComponent implements OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Input() donationId = '';
  @Input() likesCount = 0;
  @Output() onClose = new EventEmitter<void>();

  users: UserLike[] = [];
  loading = false;
  error = '';
  canRetry = false;

  private readonly destroy$ = new Subject<void>();
  private readonly DEFAULT_AVATAR = this.generateDefaultAvatar();

  constructor(
    private readonly donationService: DonationService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    const isOpenChange = changes['isOpen'];
    const donationIdChange = changes['donationId'];
    const likesCountChange = changes['likesCount'];

    // Cargar datos cuando el modal se abre o cambia el donationId
    if ((isOpenChange?.currentValue && this.donationId) || 
        (donationIdChange && this.isOpen && donationIdChange.currentValue)) {
      this.loadUsers();
      return;
    }

    // Recargar si el conteo de likes aumenta (indica nuevo like)
    if (likesCountChange && this.isOpen && this.donationId) {
      const newCount = likesCountChange.currentValue ?? 0;
      const oldCount = likesCountChange.previousValue ?? 0;
      
      if (newCount > oldCount) {
        this.loadUsers();
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga la lista de usuarios que dieron like
   */
  private loadUsers(): void {
    if (!this.donationId) {
      this.setError('ID de donación no válido');
      return;
    }

    this.loading = true;
    this.error = '';
    this.canRetry = false;
    this.cdr.markForCheck();

    this.donationService.getUsersWhoLikedPost(this.donationId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (users) => {
          this.users = users || [];
          this.error = '';
        },
        error: (error) => {
          console.error('Error al cargar usuarios que dieron like:', error);
          this.setError('No se pudo cargar la lista de usuarios');
          this.canRetry = true;
        }
      });
  }

  /**
   * Reintenta cargar los usuarios
   */
  retryLoad(): void {
    this.loadUsers();
  }

  /**
   * Maneja el cierre del modal
   */
  handleClose(): void {
    this.resetState();
    this.onClose.emit();
  }

  /**
   * Resetea el estado del componente
   */
  private resetState(): void {
    this.users = [];
    this.error = '';
    this.loading = false;
    this.canRetry = false;
  }

  /**
   * Establece un mensaje de error
   */
  private setError(message: string): void {
    this.error = message;
    this.users = [];
    this.cdr.markForCheck();
  }

  /**
   * Obtiene el nombre de usuario
   */
  getUsername(userLike: UserLike): string {
    return userLike.user?.username || userLike.user?.email?.split('@')[0] || 'Usuario';
  }

  /**
   * Obtiene el email del usuario
   */
  getUserEmail(userLike: UserLike): string {
    return userLike.user?.email || '';
  }

  /**
   * Obtiene la URL del avatar del usuario
   */
  getUserAvatar(userLike: UserLike): string {
    return userLike.user?.profilePhoto || this.DEFAULT_AVATAR;
  }

  /**
   * Verifica si el usuario está verificado
   */
  isVerified(userLike: UserLike): boolean {
    return !!userLike.user?.email;
  }

  /**
   * Maneja errores de carga de imagen
   */
  handleImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    target.src = this.DEFAULT_AVATAR;
  }

  /**
   * Genera un avatar por defecto en base64
   */
  private generateDefaultAvatar(): string {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <circle cx="50" cy="50" r="50" fill="#e5e7eb"/>
        <g fill="#9ca3af">
          <circle cx="50" cy="35" r="15"/>
          <path d="M 25 70 Q 25 55 35 52 L 65 52 Q 75 55 75 70 L 75 85 Q 75 90 70 90 L 30 90 Q 25 90 25 85 Z"/>
        </g>
      </svg>
    `.trim();
    
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  /**
   * TrackBy function para mejorar el rendimiento de *ngFor
   */
  trackByUserId(index: number, userLike: UserLike): string {
    return userLike.id || userLike.userId || index.toString();
  }

  /**
   * Getter para el título del modal
   */
  get modalTitle(): string {
    const count = this.users.length || this.likesCount || 0;
    return `Personas a las que les gusta (${count})`;
  }

  /**
   * Getter para mostrar el estado vacío
   */
  get showEmptyState(): boolean {
    return !this.loading && !this.error && this.users.length === 0;
  }

  /**
   * Getter para mostrar la lista de usuarios
   */
  get showUsersList(): boolean {
    return !this.loading && !this.error && this.users.length > 0;
  }
}