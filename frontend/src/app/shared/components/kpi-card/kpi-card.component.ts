import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Componente reutilizable para mostrar tarjetas de KPI (Key Performance Indicators)
 * 
 * @example
 * ```html
 * <app-kpi-card
 *   title="Total Usuarios"
 *   [value]="1234"
 *   subtitle="Usuarios activos"
 *   iconPath="M12 4.354a4 4 0 110 5.292..."
 *   colorClass="bg-gradient-to-br from-blue-500 to-blue-600"
 *   trend="+12.5%"
 *   trendDirection="up"
 *   [loading]="false"
 *   [clickable]="true"
 *   (cardClick)="handleCardClick()">
 * </app-kpi-card>
 * ```
 */
@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kpi-card.component.html',
  styleUrls: ['./kpi-card.component.scss']
})
export class KpiCardComponent {
  /** Título principal de la tarjeta KPI */
  @Input() title: string = '';
  
  /** Valor a mostrar (puede ser número o string formateado) */
  @Input() value: string | number = 0;
  
  /** Subtítulo o descripción adicional */
  @Input() subtitle?: string;
  
  /** Path SVG del icono a mostrar */
  @Input() iconPath: string = '';
  
  /** Clases CSS para el color de fondo (gradientes de Tailwind) */
  @Input() colorClass: string = 'bg-gradient-to-br from-blue-500 to-blue-600';
  
  /** Texto de la tendencia (ej: "+12.5%", "-3.2%") */
  @Input() trend?: string;
  
  /** Dirección de la tendencia para el icono */
  @Input() trendDirection?: 'up' | 'down' | 'neutral' = 'neutral';
  
  /** Estado de carga - muestra skeleton cuando es true */
  @Input() loading: boolean = false;
  
  /** Habilita el cursor pointer y emite eventos de click */
  @Input() clickable: boolean = false;
  
  /** Muestra una sección de footer adicional */
  @Input() showFooter: boolean = false;
  
  /** Prefijo para el valor (ej: "$", "€") */
  @Input() valuePrefix?: string;
  
  /** Sufijo para el valor (ej: "%", "K", "M") */
  @Input() valueSuffix?: string;
  
  /** Evento emitido cuando se hace click en la tarjeta (si clickable es true) */
  @Output() cardClick = new EventEmitter<void>();

  /**
   * Obtiene el path SVG del icono de tendencia según la dirección
   */
  getTrendIconPath(): string {
    if (this.trendDirection === 'up') {
      return 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6';
    } else if (this.trendDirection === 'down') {
      return 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6';
    }
    return 'M5 12h14';
  }

  /**
   * Formatea el valor con prefijo y sufijo si están definidos
   */
  formatValue(value: string | number): string {
    const prefix = this.valuePrefix || '';
    const suffix = this.valueSuffix || '';
    
    // Si es número, formatearlo con separadores de miles
    if (typeof value === 'number') {
      const formatted = value.toLocaleString('es-ES');
      return `${prefix}${formatted}${suffix}`;
    }
    
    return `${prefix}${value}${suffix}`;
  }

  /**
   * Maneja el evento click en la tarjeta
   */
  handleClick(): void {
    if (this.clickable && !this.loading) {
      this.cardClick.emit();
    }
  }
}
