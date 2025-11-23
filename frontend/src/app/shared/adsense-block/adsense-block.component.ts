import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-adsense-block',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './adsense-block.component.html',
  styleUrls: ['./adsense-block.component.scss']
})
export class AdsenseBlockComponent {
// El ID que obtuviste de AdSense para este bloque (ej. 'YYYYYYYYYY')
  @Input() adSlot!: string;
  
  // Variable para controlar si estamos en modo de desarrollo o producción
  isInDevelopmentMode = !environment.production;

  constructor() { }

  ngAfterViewInit(): void {
    // Esto asegura que el código de AdSense se ejecute *después* de que
    // el componente se haya cargado en el DOM
    if (typeof (window as any)['adsbygoogle'] !== 'undefined') {
      (window as any)['adsbygoogle'] = (window as any)['adsbygoogle'] || [];
      
      // Intentamos cargar el anuncio
      (window as any)['adsbygoogle'].push({});
    }
  }
}
