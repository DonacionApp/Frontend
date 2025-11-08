import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { AuthService, User } from '../../../core/services/auth.service';
import { UserProfileService } from '../../../core/services/user-profile.service';
import { OrganizationProfileService } from '../../../core/services/organization-profile.service';
import { Subject, takeUntil, filter } from 'rxjs';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './nav.component.html',
  styleUrls: []
})
export class NavComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  isMobileMenuOpen = false;
  
  // Estado del usuario
  isAuthenticated = false;
  user: User | null = null;
  userProfileImage: string | null = null;
  userFullName: string = '';
  isOnProfilePage = false;
  isDocumentVerified = false;
  
  constructor(
    private router: Router,
    private authService: AuthService,
    private profileService: UserProfileService,
    private organizationProfileService: OrganizationProfileService
  ) {}

  ngOnInit(): void {
    // Suscribirse al estado del usuario
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.user = user;
        this.isAuthenticated = !!user;
        this.userFullName = user?.name || 'Usuario';
        this.isDocumentVerified = user?.isDocumentVerified || false;
        
        // Cargar foto de perfil si el usuario está autenticado
        if (user) {
          this.loadUserProfile();
        } else {
          this.userProfileImage = null;
          this.userFullName = '';
        }
      });
    
    // Detectar cambios de ruta para saber si estamos en la página de perfil
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: any) => {
        this.isOnProfilePage = event.url.includes('/profile');
      });
    
    // Verificar ruta inicial
    this.isOnProfilePage = this.router.url.includes('/profile');
    
    // Suscribirse a cambios en el perfil para actualizar la foto y nombre
    this.profileService.profile$
      .pipe(takeUntil(this.destroy$))
      .subscribe(profile => {
        if (profile) {
          this.userProfileImage = profile.profileImage || null;
          this.userFullName = profile.name || this.user?.name || 'Usuario';
        }
      });
    
    // Suscribirse a cambios en el perfil de organización para verificación
    this.organizationProfileService.profile$
      .pipe(takeUntil(this.destroy$))
      .subscribe(orgProfile => {
        if (orgProfile && this.user?.role === 'organization') {
          // Actualizar estado de verificación desde el perfil de organización
          this.isDocumentVerified = orgProfile.isVerified || false;
        }
      });
  }
  
  private loadUserProfile(): void {
    if (this.user?.role === 'donor') {
      this.profileService.getMyProfile().subscribe({
        next: (profile) => {
          this.userProfileImage = profile.profileImage || null;
          this.userFullName = profile.name || this.user?.name || 'Usuario';
        },
        error: (error) => {
          console.error('Error loading user profile:', error);
          // Si falla la carga del perfil, usar el nombre del usuario del auth
          this.userFullName = this.user?.name || 'Usuario';
        }
      });
    } else if (this.user?.role === 'organization') {
      this.organizationProfileService.getMyOrganizationProfile().subscribe({
        next: (profile) => {
          this.userProfileImage = profile.logo || null;
          this.userFullName = profile.name || this.user?.name || 'Organización';
          // Actualizar estado de verificación desde el perfil
          this.isDocumentVerified = profile.isVerified || false;
        },
        error: (error) => {
          console.error('Error loading organization profile:', error);
          this.userFullName = this.user?.name || 'Organización';
        }
      });
    }
  }
  
  get displayName(): string {
    return this.userFullName || this.user?.name || 'Usuario';
  }
  
  get userInitial(): string {
    const name = this.displayName;
    return name ? name.charAt(0).toUpperCase() : 'U';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
  }

  onHomeClick(): void {
    this.closeMobileMenu();
    this.router.navigate(['/']);
  }

  onAboutClick(): void {
    this.closeMobileMenu();
    this.router.navigate(['/']);
  }

  onLoginClick(): void {
    this.closeMobileMenu();
    this.router.navigate(['/auth/login']);
  }

  onRegisterClick(): void {
    this.closeMobileMenu();
    this.router.navigate(['/donor/register']);
  }

  onOrganizationRegisterClick(): void {
    this.closeMobileMenu();
    this.router.navigate(['/organization/register']);
  }

  onProfileClick(): void {
    this.closeMobileMenu();
    if (this.user?.role === 'donor') {
      this.router.navigate(['/donor/profile']);
    } else if (this.user?.role === 'organization') {
      this.router.navigate(['/organization/profile']);
    }
  }

  onLogoutClick(): void {
    this.closeMobileMenu();
    this.authService.logout();
    this.router.navigate(['/']);
  }

  getProfileRoute(): string {
    if (this.user?.role === 'donor') {
      return '/donor/profile';
    } else if (this.user?.role === 'organization') {
      return '/organization/profile';
    }
    return '/';
  }

  onVerificationBadgeClick(): void {
    this.closeMobileMenu();
    if (this.user?.role === 'donor') {
      this.router.navigate(['/donor/profile']);
    } else if (this.user?.role === 'organization') {
      this.router.navigate(['/organization/profile']);
    }
  }

  // Cerrar menú móvil al hacer clic fuera
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const mobileMenu = document.querySelector('.mobile-menu');
    const mobileMenuButton = document.querySelector('.mobile-menu-button');
    
    if (this.isMobileMenuOpen && 
        !mobileMenu?.contains(target) && 
        !mobileMenuButton?.contains(target)) {
      this.closeMobileMenu();
    }
  }
}
