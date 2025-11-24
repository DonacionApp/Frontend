import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { SystemService } from '../../../core/services/system.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-terms-modal',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './terms-modal.component.html',
  styleUrls: ['./terms-modal.component.scss']
})
export class TermsModalComponent implements OnInit {
  termsContent: SafeHtml = '';
  loading: boolean = true;
  error: string = '';
  

  constructor(
    public dialogRef: MatDialogRef<TermsModalComponent>,
    private systemService: SystemService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadTerms();
  }

  async loadTerms(): Promise<void> {
    // Configurar opciones de marked para mejor renderizado
    marked.setOptions({
      breaks: true,      // Convierte \n en <br>
      gfm: true          // GitHub Flavored Markdown
    });
    
  

    try {
      // Pedimos la respuesta completa para poder leer headers (Last-Modified) o metadata
      let httpResp = await this.systemService.getTermsWithResponse().toPromise();
      let responseBody = httpResp?.body;

      // Debug: mostrar status, header Last-Modified y body (solo en desarrollo)
      if (!environment.production) {
        console.log('[TermsModal] initial httpResp.status=', httpResp?.status, 'last-modified=', httpResp?.headers?.get?.('last-modified'));
        console.log('[TermsModal] initial response body preview:', responseBody ? (typeof responseBody === 'object' ? { hasTerms: !!responseBody.terms } : responseBody) : responseBody);
      }

      if (!httpResp || !responseBody || !responseBody.terms) {
        // Si el servidor responde 304 (Not Modified) puede venir sin body.
        // Intentamos forzar una petición sin caché para obtener el body real.
        if (httpResp && httpResp.status === 304) {
          if (!environment.production) {
            console.log('[TermsModal] initial response was 304 — retrying with cache-buster...');
          }
          const forced = await this.systemService.getTermsWithResponse(true).toPromise();
          const forcedBody = forced?.body;
          if (!environment.production) {
            console.log('[TermsModal] forced httpResp.status=', forced?.status, 'last-modified=', forced?.headers?.get?.('last-modified'));
            console.log('[TermsModal] forced response body preview:', forcedBody ? (typeof forcedBody === 'object' ? { hasTerms: !!forcedBody.terms } : forcedBody) : forcedBody);
          }
          if (forced && forcedBody && forcedBody.terms) {
            // reasignar las variables para continuar el flujo con la respuesta forzada
            httpResp = forced;
            responseBody = forcedBody;
          } else {
            throw new Error('No se recibió contenido (304 y sin body)');
          }
        } else {
          throw new Error('No se recibió contenido');
        }
      }

      const termsText = responseBody.terms;

      // Validar que el contenido tenga markdown real
      const hasMarkdown = termsText.includes('#') || 
                         termsText.includes('**') || 
                         termsText.includes('-') || 
                         termsText.includes('*') ||
                         termsText.includes('`');

      if (!termsText || termsText.trim().length < 50) {
        throw new Error('Contenido inválido o vacío');
      }

      // Convertir markdown a HTML
      const html = await marked.parse(termsText) as string;

      // Sanitizar el HTML para prevenir XSS
      this.termsContent = this.sanitizer.bypassSecurityTrustHtml(html);

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
      console.error('Error loading terms:', err);
      this.loadDefaultTerms();
    }
  }

  private async loadDefaultTerms(): Promise<void> {
    try {
      const defaultMarkdown = this.getDefaultTerms();
      const defaultHtml = await marked.parse(defaultMarkdown);
      this.termsContent = this.sanitizer.bypassSecurityTrustHtml(defaultHtml);
      this.loading = false;
    } catch (err) {
      this.error = 'Error al cargar los términos y condiciones';
      this.loading = false;
    }
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

  /**
   * Recarga los términos manualmente
   */
  reload(): void {
    this.loadTerms();
  }

  close(): void {
    this.dialogRef.close();
  }

  // ============================================
  // TÉRMINOS POR DEFECTO
  // ============================================

  /**
   * Retorna los términos por defecto en formato Markdown
   */
  private getDefaultTerms(): string {
    const currentYear = new Date().getFullYear();
    const currentDate = this.formatDate(new Date());

    return `# Términos y Condiciones de Uso

*Última actualización: ${currentDate}*

---

## 1. Aceptación y Alcance

Al usar la **Plataforma**, usted acepta estos Términos y Condiciones (T&C). La Plataforma es un mero punto de encuentro digital que facilita la conexión entre donantes y beneficiarios; **no somos parte de las transacciones** de donación o entrega de bienes.

### 1.1 Definiciones

Para los efectos de estos T&C, se entenderá por:

- **Plataforma**: El sitio web y/o aplicación móvil que facilita las donaciones
- **Usuario**: Cualquier persona que utilice la Plataforma
- **Donante**: Usuario que ofrece bienes o servicios
- **Beneficiario**: Usuario u organización que recibe donaciones

---

## 2. Descargo de Responsabilidad por Contenido

La Plataforma **no es responsable** por el contenido, la veracidad, la legalidad o la idoneidad de:

- Los **"Artículos para Donar"** publicados por usuarios
- Las **"Necesidades"** publicadas por organizaciones
- La calidad o estado de los bienes donados
- El cumplimiento de las promesas de donación

### 2.1 Responsabilidad del Usuario

El usuario asume **toda la responsabilidad** por:

1. Las publicaciones que realiza
2. Las donaciones que ejecuta
3. La verificación de la identidad de otros usuarios
4. El cumplimiento de las leyes aplicables

---

## 3. Limitación Extrema de Responsabilidad Legal

### 3.1 Límite de Responsabilidad

> **IMPORTANTE**: En la máxima medida permitida por la ley aplicable, la Plataforma **no será responsable**, bajo ninguna circunstancia, por daños directos, indirectos, incidentales, consecuentes, especiales o ejemplares.

Esto incluye, pero no se limita a:

- El uso o la imposibilidad de usar la Plataforma
- Transacciones o comunicaciones fallidas o fraudulentas entre usuarios
- manejo o uso de los bienes donados o los fondos recaudados
- Fallas en la seguridad o fugas de datos derivadas de ataques externos
- Pérdida de datos o información
- Interrupciones del servicio

### 3.2 Exención de Garantías

La Plataforma se proporciona **"TAL CUAL"** y **"SEGÚN DISPONIBILIDAD"**, sin garantías de ningún tipo, ya sean expresas o implícitas.

---

## 4. Monitoreo y Bloqueo

### 4.1 Cláusula de Auditoría

El usuario otorga **consentimiento expreso e irrevocable** para:

- El monitoreo de toda su actividad en la Plataforma
- El registro de sus comunicaciones
- La auditoría de sus transacciones
- El almacenamiento de logs de actividad

### 4.2 Derecho de Bloqueo

Nos reservamos el **derecho exclusivo** de bloquear permanentemente a cualquier Usuario que:

1. Viole estos Términos y Condiciones
2. Incurra en actividades fraudulentas
3. Ponga en riesgo la integridad de la Plataforma
4. Realice acciones que consideremos inapropiadas

**Nota**: Este bloqueo puede realizarse:
- Sin necesidad de aviso previo
- Sin derecho a indemnización
- De forma permanente e irreversible

---

## 5. Privacidad y Protección de Datos

### 5.1 Recopilación de Datos

Recopilamos y procesamos:

- Información de identificación personal
- Datos de contacto
- Historial de donaciones
- Registros de actividad

### 5.2 Uso de Datos

Los datos se utilizan para:

1. Verificar la identidad de usuarios
2. Prevenir fraude
3. Mejorar la Plataforma
4. Cumplir con obligaciones legales

Para más información, consulte nuestra [Política de Privacidad](#privacidad).

---

## 6. Propiedad Intelectual

Todo el contenido de la Plataforma, incluyendo:

- Diseño y marca
- Logotipos e imágenes
- Textos y documentación
- Código fuente
- Bases de datos

Es propiedad exclusiva de la Plataforma o de sus licenciantes y está protegido por leyes de propiedad intelectual.

---

## 7. Modificaciones

Nos reservamos el derecho de modificar estos T&C en cualquier momento. Los cambios entrarán en vigor inmediatamente después de su publicación en la Plataforma.

### 7.1 Notificación de Cambios

Los usuarios serán notificados de cambios significativos mediante:

- Correo electrónico
- Notificaciones en la Plataforma
- Mensajes push (app móvil)

Es responsabilidad del usuario revisar periódicamente estos términos.

---

## 8. Ley Aplicable y Jurisdicción

Estos T&C se rigen por las leyes de [País/Jurisdicción]. Cualquier disputa será resuelta en los tribunales competentes de [Ciudad/Jurisdicción].

---

## 9. Resolución de Disputas

### 9.1 Mediación

Antes de iniciar cualquier acción legal, las partes se comprometen a intentar resolver la disputa mediante mediación.

### 9.2 Arbitraje

Si la mediación falla, las partes acuerdan someter la disputa a arbitraje vinculante.

---

## 10. Contacto

Para preguntas sobre estos Términos y Condiciones:

- **Email**: legal@plataforma.com
- **Teléfono**: +1 (555) 123-4567
- **Dirección**: Calle Principal #123, Ciudad, País
- **Horario**: Lunes a Viernes, 9:00 AM - 6:00 PM

---

## 11. Divisibilidad

Si alguna disposición de estos T&C se considera inválida o inaplicable, las disposiciones restantes seguirán en pleno vigor y efecto.

---

## 12. Aceptación

Al hacer clic en "Aceptar" o al continuar usando la Plataforma, usted confirma que:

- Ha leído estos Términos y Condiciones en su totalidad
- Los comprende completamente
- Acepta estar legalmente vinculado por ellos
- Tiene la capacidad legal para aceptar estos términos

---

*© ${currentYear} Plataforma de Donaciones. Todos los derechos reservados.*

*Este documento fue generado automáticamente y puede estar sujeto a cambios sin previo aviso.*`;
  }
}