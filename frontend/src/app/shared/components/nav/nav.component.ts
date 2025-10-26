import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './nav.component.html',
  styleUrls: []
})
export class NavComponent {
  isMobileMenuOpen = false;
  
  // Estado simple para el navbar
  isAuthenticated = false;
  user: any = null;
  
  constructor(private router: Router) {}

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

  onLogoutClick(): void {
    this.closeMobileMenu();
    // Simular logout
    this.isAuthenticated = false;
    this.user = null;
    this.router.navigate(['/']);
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
