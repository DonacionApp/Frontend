import { Component, Input, OnInit, OnDestroy, AfterViewInit, OnChanges, SimpleChanges, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ImpactStats {
  totalDonations: number;
  totalOrganizations: number;
  totalCities: number;
  satisfactionRate: number;
}

@Component({
  selector: 'app-impact-metrics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './impact-metrics.component.html',
  styleUrls: ['./impact-metrics.component.scss']
})
export class ImpactMetricsComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
  @Input() stats: ImpactStats = {
    totalDonations: 0,
    totalOrganizations: 0,
    totalCities: 0,
    satisfactionRate: 0
  };
  
  @Input() isLoading: boolean = false;
  @Input() showAnimation: boolean = true;

  // Valores animados para el count up
  animatedDonations = 0;
  animatedOrganizations = 0;
  animatedCities = 0;
  animatedSatisfaction = 0;

  private observer?: IntersectionObserver;
  private hasAnimated = false;

  constructor(private elementRef: ElementRef) {}

  ngOnInit(): void {}

  ngOnChanges(changes: SimpleChanges): void {
    // Si los stats cambian y ya hemos animado, actualizar sin animación
    if (changes['stats'] && !changes['stats'].firstChange && this.hasAnimated) {
      this.animatedDonations = this.stats.totalDonations;
      this.animatedOrganizations = this.stats.totalOrganizations;
      this.animatedCities = this.stats.totalCities;
      this.animatedSatisfaction = this.stats.satisfactionRate;
    }
  }

  ngAfterViewInit(): void {
    if (this.showAnimation) {
      this.setupIntersectionObserver();
    } else {
      // Si no hay animación, mostrar valores directamente
      this.animatedDonations = this.stats.totalDonations;
      this.animatedOrganizations = this.stats.totalOrganizations;
      this.animatedCities = this.stats.totalCities;
      this.animatedSatisfaction = this.stats.satisfactionRate;
    }
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  /**
   * Configura el Intersection Observer para detectar cuando el componente es visible
   */
  private setupIntersectionObserver(): void {
    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.3 // Activar cuando el 30% del elemento sea visible
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.hasAnimated && !this.isLoading) {
          this.hasAnimated = true;
          this.startCountUpAnimation();
        }
      });
    }, options);

    this.observer.observe(this.elementRef.nativeElement);
  }

  /**
   * Inicia la animación de conteo progresivo
   */
  private startCountUpAnimation(): void {
    const duration = 2000; // 2 segundos
    const frameDuration = 1000 / 60; // 60 FPS
    const totalFrames = Math.round(duration / frameDuration);

    let frame = 0;

    const counter = setInterval(() => {
      frame++;
      const progress = this.easeOutQuad(frame / totalFrames);

      this.animatedDonations = Math.round(this.stats.totalDonations * progress);
      this.animatedOrganizations = Math.round(this.stats.totalOrganizations * progress);
      this.animatedCities = Math.round(this.stats.totalCities * progress);
      this.animatedSatisfaction = Math.round(this.stats.satisfactionRate * progress);

      if (frame === totalFrames) {
        clearInterval(counter);
        // Asegurar valores finales exactos
        this.animatedDonations = this.stats.totalDonations;
        this.animatedOrganizations = this.stats.totalOrganizations;
        this.animatedCities = this.stats.totalCities;
        this.animatedSatisfaction = this.stats.satisfactionRate;
      }
    }, frameDuration);
  }

  /**
   * Función de easing para suavizar la animación
   */
  private easeOutQuad(t: number): number {
    return t * (2 - t);
  }
}
