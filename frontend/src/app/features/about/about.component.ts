import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { SystemService } from '../../core/services/system.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, FooterComponent],
  templateUrl: './about.component.html'
})
export class AboutComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  aboutUsContent: string = 'Bienvenido a DonacionApp. Somos la plataforma que conecta de forma segura y transparente a personas solidarias con organizaciones que necesitan bienes materiales, agilizando cada entrega para generar impacto real y un futuro solidario.';
  isLoading: boolean = true;
  hasError: boolean = false;
  teamMembers: Array<{ name: string; role: string }> = [
    { name: 'Breiner Andres Iles Sambony', role: 'Integrante del proyecto' },
    { name: 'Emerson Esneyder Iles Sambony', role: 'Integrante del proyecto' },
    { name: 'Abel Audino Pantoja Rodriguez', role: 'Integrante del proyecto' },
    { name: 'Kevin Alexander Chanchi Lopez', role: 'Integrante del proyecto' },
    { name: 'Juan Carlos Pastuzan Quinchoa', role: 'Integrante del proyecto' }
  ];

  constructor(private systemService: SystemService) {}

  ngOnInit(): void {
    this.loadAboutUsContent();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Cargar contenido "Acerca de Nosotros" desde el backend
   */
  private loadAboutUsContent(): void {
    this.isLoading = true;
    this.hasError = false;

    this.systemService.getAboutUs()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.aboutUs && response.aboutUs.trim() !== '') {
            // Remover markdown headers si existen
            this.aboutUsContent = response.aboutUs
              .replace(/^##\s+.*$/gm, '') // Remover headers de markdown
              .replace(/^#\s+.*$/gm, '')  // Remover headers h1
              .trim();
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error al cargar contenido "Acerca de":', error);
          this.hasError = true;
          this.isLoading = false;
          // Mantener el contenido por defecto si hay error
        }
      });
  }

  getInitials(fullName: string): string {
    return fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() ?? '')
      .join('');
  }
}
