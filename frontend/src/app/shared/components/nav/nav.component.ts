import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService, User } from '../../../core/services/auth.service';
import { Subject, takeUntil } from 'rxjs';

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
  
  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Suscribirse al estado del usuario
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.user = user;
        this.isAuthenticated = !!user;
      });
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
