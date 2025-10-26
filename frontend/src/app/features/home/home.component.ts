import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, ButtonComponent, FooterComponent, ModalComponent],
  templateUrl: './home.component.html'
})
export class HomeComponent {
  // Modal states
  showInfoModal = false;
  showContactModal = false;

  constructor(private router: Router) {}

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  onDonorRegisterClick(): void {
    this.router.navigate(['/donor/register']);
  }

  onOrganizationRegisterClick(): void {
    this.router.navigate(['/organization/register']);
  }

  onLoginClick(): void {
    this.router.navigate(['/auth/login']);
  }

  // Modal methods
  openInfoModal(): void {
    this.showInfoModal = true;
  }

  closeInfoModal(): void {
    this.showInfoModal = false;
  }

  openContactModal(): void {
    this.showContactModal = true;
  }

  closeContactModal(): void {
    this.showContactModal = false;
  }
}
