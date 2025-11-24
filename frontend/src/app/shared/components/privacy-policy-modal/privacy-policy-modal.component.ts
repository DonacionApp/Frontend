import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { SystemService } from '../../../core/services/system.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-privacy-policy-modal',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './privacy-policy-modal.component.html',
  styleUrls: ['./privacy-policy-modal.component.scss']
})
export class PrivacyPolicyModalComponent implements OnInit {
  policyContent: SafeHtml = '';
  loading: boolean = true;
  error: string = '';
  

  constructor(
    public dialogRef: MatDialogRef<PrivacyPolicyModalComponent>,
    private systemService: SystemService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadPolicy();
  }

  async loadPolicy(): Promise<void> {
    this.loading = true;
    this.error = '';
    
    // Configurar opciones de marked para mejor renderizado
    marked.setOptions({
      breaks: true,      // Convierte \n en <br>
      gfm: true          // GitHub Flavored Markdown
    });
    
    

    try {
      // Pedimos la respuesta completa para poder leer headers (Last-Modified) o metadata
      let httpResp = await this.systemService.getPoliciesWithResponse().toPromise();
      let responseBody = httpResp?.body;

      // Debug: mostrar status, header Last-Modified y body (solo en desarrollo)
      if (!environment.production) {
        console.log('[PrivacyPolicyModal] initial httpResp.status=', httpResp?.status, 'last-modified=', httpResp?.headers?.get?.('last-modified'));
        console.log('[PrivacyPolicyModal] initial response body preview:', responseBody ? (typeof responseBody === 'object' ? { hasPolicies: !!responseBody.policies } : responseBody) : responseBody);
      }

      if (!httpResp || !responseBody || !responseBody.policies) {
        // Si el servidor responde 304 (Not Modified) puede venir sin body.
        // Intentamos forzar una petición sin caché para obtener el body real.
        if (httpResp && httpResp.status === 304) {
          if (!environment.production) {
            console.log('[PrivacyPolicyModal] initial response was 304 — retrying with cache-buster...');
          }
          const forced = await this.systemService.getPoliciesWithResponse(true).toPromise();
          const forcedBody = forced?.body;
          if (!environment.production) {
            console.log('[PrivacyPolicyModal] forced httpResp.status=', forced?.status, 'last-modified=', forced?.headers?.get?.('last-modified'));
            console.log('[PrivacyPolicyModal] forced response body preview:', forcedBody ? (typeof forcedBody === 'object' ? { hasPolicies: !!forcedBody.policies } : forcedBody) : forcedBody);
          }
          if (forced && forcedBody && forcedBody.policies) {
            // reasignar las variables para continuar el flujo
            httpResp = forced;
            responseBody = forcedBody;
          } else {
            throw new Error('No se recibió contenido (304 y sin body)');
          }
        } else {
          throw new Error('No se recibió contenido');
        }
      }

      const policyText = responseBody.policies;

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

      // Priorizar la fecha que venga desde el servidor: header Last-Modified o campo lastUpdated en body
      let serverDate: string | null = null;
      const lastModifiedHeader = httpResp.headers?.get('last-modified');
      if (lastModifiedHeader) {
        const parsed = Date.parse(lastModifiedHeader);
        serverDate = !isNaN(parsed) ? this.formatDate(new Date(parsed)) : lastModifiedHeader;
      } else if ((responseBody as any).lastUpdated) {
        const parsed = Date.parse((responseBody as any).lastUpdated);
        serverDate = !isNaN(parsed) ? this.formatDate(new Date(parsed)) : (responseBody as any).lastUpdated;
      }
      this.loading = false;
    } catch (err: any) {
      console.error('Error loading privacy policy:', err);
      this.error = err?.message || 'No se pudo cargar la política de privacidad. Por favor, intenta más tarde.';
      this.loadDefaultPolicy();
    }
  }

  private async loadDefaultPolicy(): Promise<void> {
    try {
      const defaultMarkdown = this.getDefaultPolicy();
      const defaultHtml = await marked.parse(defaultMarkdown);
      this.policyContent = this.sanitizer.bypassSecurityTrustHtml(defaultHtml);
      this.loading = false;
    } catch (err) {
      this.error = 'Error al cargar la política de privacidad';
      this.loading = false;
    }
  }

  private getDefaultPolicy(): string {
    return `# Política de Tratamiento de Datos Personales

## 1. Responsable del Tratamiento

**DonaApp** (en adelante, "la Plataforma"), es responsable del tratamiento de tus datos personales conforme a la Ley Estatutaria 1581 de 2012 y el Decreto 1377 de 2013.

## 2. Marco Legal

Esta política se rige por:
- Ley Estatutaria 1581 de 2012
- Decreto 1377 de 2013
- Decreto 1074 de 2015

## 3. Datos que Recopilamos

Recopilamos los siguientes datos personales:

- Nombre completo
- Correo electrónico
- Número de teléfono
- Dirección física
- Documento de identidad
- Fotografías (opcional)
- Información bancaria (para organizaciones)

## 4. Finalidad del Tratamiento

Tus datos serán utilizados para:

- Crear y gestionar tu cuenta en la Plataforma
- Facilitar las donaciones entre usuarios
- Enviar notificaciones sobre donaciones y actividades
- Mejorar nuestros servicios
- Cumplir con obligaciones legales
- Prevenir fraude y proteger la seguridad de la Plataforma

## 5. Tus Derechos (ARCO)

De acuerdo con la Ley 1581 de 2012, tienes derecho a:

- **Acceder:** Conocer qué datos tenemos sobre ti
- **Rectificar:** Solicitar corrección de datos inexactos
- **Cancelar:** Solicitar eliminación de tus datos
- **Oponerte:** Revocar la autorización en cualquier momento

## 6. Cómo Ejercer tus Derechos

Puedes ejercer tus derechos contactándonos en:

- **Email:** privacidad@donaapp.com
- **Dirección:** [Dirección física de la organización]
- **Teléfono:** [Número de contacto]

## 7. Seguridad de los Datos

Implementamos medidas técnicas y administrativas para proteger tu información:

- Cifrado de datos sensibles
- Acceso restringido a información personal
- Monitoreo de seguridad constante
- Protocolos de respuesta ante incidentes

## 8. Conservación de Datos

Tus datos serán conservados durante el tiempo que mantengas tu cuenta activa o según lo requiera la ley.

## 9. Datos Sensibles

No recopilamos datos sensibles sin tu consentimiento expreso y por escrito.

## 10. Transferencias Internacionales

Tus datos permanecen almacenados en servidores ubicados en Colombia. Cualquier transferencia internacional se realizará conforme a la ley.

## 11. Autoridad de Control

Puedes presentar quejas ante la **Superintendencia de Industria y Comercio (SIC)**.

## 12. Modificaciones a esta Política

Nos reservamos el derecho de modificar esta política. Los cambios serán notificados a través de la Plataforma.

## 13. Consentimiento

Al usar la Plataforma, confirmas que has leído y aceptado esta Política de Privacidad.

---

**Última actualización:** Noviembre 2025`;
  }

  close(): void {
    this.dialogRef.close();
  }

  /**
   * Formatea una fecha en español
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Extrae la fecha de "Última actualización" desde el texto Markdown.
   * Si encuentra una fecha en formato legible la normaliza usando `formatDate`.
   * Si no puede parsear la fecha devuelve la cadena encontrada tal cual.
   */
  private extractLastUpdatedFromMarkdown(text: string): string | null {
    if (!text) return null;

    // Buscar una línea tipo: Última actualización: 24 de noviembre de 2025
    const regex = /Última actualización:\s*\*?([^\n\*]+)\*?/i;
    const match = text.match(regex);
    if (match && match[1]) {
      const raw = match[1].trim();
      const parsed = Date.parse(raw);
      if (!isNaN(parsed)) {
        return this.formatDate(new Date(parsed));
      }
      return raw;
    }

    // Buscar metadato tipo YAML o clave lastUpdated: 2025-11-24
    const yamlMatch = text.match(/lastUpdated:\s*([^\n\r]+)/i);
    if (yamlMatch && yamlMatch[1]) {
      const raw = yamlMatch[1].trim();
      const parsed = Date.parse(raw);
      if (!isNaN(parsed)) return this.formatDate(new Date(parsed));
      return raw;
    }

    return null;
  }
}

