import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SystemService } from '../../core/services/system.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './privacy-policy.component.html',
  styleUrls: ['./privacy-policy.component.scss']
})
export class PrivacyPolicyComponent implements OnInit {
  policyContent: SafeHtml = '';
  loading: boolean = true;
  error: string = '';

  constructor(
    private systemService: SystemService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadPolicy();
  }

  async loadPolicy(): Promise<void> {
    this.loading = true;
    this.error = '';

    // Configurar marked para mejor renderizado
    marked.setOptions({
      breaks: true,
      gfm: true
    });

    try {
      const response = await this.systemService.getPolicies().toPromise();
      
      if (!response || !response.policies) {
        throw new Error('No se recibió contenido');
      }

      const policyText = response.policies;

      // Validar que el contenido tenga markdown real
      const hasMarkdown = policyText.includes('#') || 
                         policyText.includes('**') || 
                         policyText.includes('-') || 
                         policyText.includes('*') ||
                         policyText.includes('`');

      if (!policyText || policyText.trim().length < 50) {
        throw new Error('Contenido inválido o vacío');
      }

      // Convertir markdown a HTML
      const html = await marked.parse(policyText) as string;
      
      // Sanitizar el HTML para prevenir XSS
      this.policyContent = this.sanitizer.bypassSecurityTrustHtml(html);
      this.loading = false;
    } catch (err: any) {
      console.error('Error loading privacy policy:', err);
      this.error = 'No se pudo cargar la política de privacidad. Por favor, intenta más tarde.';
      this.loading = false;
      // Cargar contenido por defecto
      this.loadDefaultContent();
    }
  }

  private async loadDefaultContent(): Promise<void> {
    const defaultContent = `
# Política de Privacidad

## Lo sentimos

No pudimos cargar la política de privacidad en este momento. Esto puede deberse a:

- Problemas temporales de conexión
- El servidor está en mantenimiento
- Actualizaciones en curso

## ¿Qué puedes hacer?

1. **Intenta nuevamente** en unos momentos
2. **Recarga la página** para volver a intentar
3. **Contacta al soporte** si el problema persiste

## Información de Contacto

Si tienes preguntas sobre nuestra política de privacidad o necesitas asistencia, puedes contactarnos a través de:

- **Email:** privacidad@donaapp.com
- **Teléfono:** [Número de contacto]
- **Horario de atención:** Lunes a Viernes, 9:00 AM - 6:00 PM

---

**Nota:** Esta es una versión temporal. La política de privacidad completa estará disponible nuevamente pronto.
    `;

    const html = await marked.parse(defaultContent) as string;
    this.policyContent = this.sanitizer.bypassSecurityTrustHtml(html);
  }
}

