import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { catchError, timeout } from 'rxjs/operators';
import { of } from 'rxjs';

interface TermsResponse {
  content?: string;
  text?: string;
  terms?: string;
  data?: string;
  markdown?: string;
}

@Component({
  selector: 'app-terms-modal',
  standalone: true,
  imports: [
    CommonModule, 
    MatDialogModule,
    MatButtonModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './terms-modal.component.html',
  styleUrls: ['./terms-modal.component.scss']
})
export class TermsModalComponent implements OnInit {
  termsContent: SafeHtml = '';
  loading: boolean = true;
  error: string = '';
  lastUpdated: string = '';

  constructor(
    public dialogRef: MatDialogRef<TermsModalComponent>,
    private http: HttpClient,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.configureMarked();
    this.loadTerms();
  }

  /**
   * Configura marked con opciones optimizadas para mejor renderizado
   */
  private configureMarked(): void {
    // Configuración avanzada de marked
    marked.setOptions({
      gfm: true,              // GitHub Flavored Markdown
      breaks: true            // Convertir saltos de línea en <br>
    });

    // Personalizar el renderer para mejor control
    const renderer = new marked.Renderer();

    // Personalizar enlaces para abrir en nueva pestaña
    renderer.link = ({ href, title, text }) => {
      const titleAttr = title ? `title="${title}"` : '';
      return `<a href="${href}" ${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
    };

    // Personalizar encabezados para agregar anclas
    const originalHeading = renderer.heading.bind(renderer);
    renderer.heading = ({ tokens, depth }) => {
      const text = this.parseInline(tokens);
      const id = text.toLowerCase().replace(/[^\w]+/g, '-');
      return `<h${depth} id="${id}">${text}</h${depth}>`;
    };

    // Personalizar listas de tareas
    renderer.listitem = ({ text, task, checked }) => {
      if (task) {
        const checkbox = checked 
          ? '<input type="checkbox" checked disabled class="task-checkbox">'
          : '<input type="checkbox" disabled class="task-checkbox">';
        return `<li class="task-item">${checkbox} ${text}</li>`;
      }
      return `<li>${text}</li>`;
    };

    marked.setOptions({ renderer });
  }

  /**
   * Parsea tokens inline a texto
   */
  private parseInline(tokens: any[]): string {
    return tokens.map(token => {
      if (token.type === 'text') return token.text;
      if (token.type === 'strong') return token.text;
      if (token.type === 'em') return token.text;
      return token.raw || '';
    }).join('');
  }

  /**
   * Carga los términos desde el backend con fallback a términos por defecto
   */
  async loadTerms(): Promise<void> {
    this.loading = true;
    this.error = '';

    try {
      // Intentar cargar desde el backend con timeout de 3 segundos
      const response = await this.http
        .get<TermsResponse>('http://localhost:5000/system/terms')
        .pipe(
          timeout(3000),
          catchError(err => {
            console.warn('⚠️ Error al cargar términos del backend:', err.message);
            return of(null);
          })
        )
        .toPromise();

      console.log('📥 Respuesta del backend:', response);

      // Extraer el contenido de markdown
      const markdownContent = this.extractMarkdownContent(response);

      if (this.isValidMarkdown(markdownContent)) {
        console.log('✅ Markdown válido recibido del backend');
        await this.renderMarkdown(markdownContent);
      } else {
        console.log('⚠️ Markdown inválido, usando términos por defecto');
        await this.renderMarkdown(this.getDefaultTerms());
      }

    } catch (err) {
      console.error('❌ Error inesperado:', err);
      this.error = 'Error al cargar los términos. Mostrando versión por defecto.';
      await this.renderMarkdown(this.getDefaultTerms());
    } finally {
      this.loading = false;
    }
  }

  /**
   * Extrae el contenido de markdown de diferentes formatos de respuesta
   */
  private extractMarkdownContent(response: TermsResponse | null | undefined): string {
    if (!response) return '';

    // Intentar diferentes campos comunes
    const possibleFields = [
      'markdown',
      'content',
      'text',
      'terms',
      'data',
      'body'
    ];

    for (const field of possibleFields) {
      const value = (response as any)[field];
      if (value && typeof value === 'string' && value.trim().length > 0) {
        console.log(`✅ Contenido encontrado en campo: ${field}`);
        return value;
      }
    }

    // Si la respuesta es directamente un string
    if (typeof response === 'string') {
      return response;
    }

    // Si no se encontró nada, intentar JSON.stringify para debugging
    console.log('⚠️ No se encontró campo de markdown. Estructura recibida:', Object.keys(response));
    return '';
  }

  /**
   * Valida que el contenido sea markdown válido y tenga contenido real
   */
  private isValidMarkdown(content: string): boolean {
    if (!content || typeof content !== 'string') {
      console.log('❌ Contenido vacío o no es string');
      return false;
    }

    // Debe tener al menos 100 caracteres
    if (content.trim().length < 100) {
      console.log('❌ Contenido muy corto:', content.length, 'caracteres');
      return false;
    }

    // Debe contener al menos algún elemento markdown común
    const markdownPatterns = [
      /#\s/,           // Encabezados
      /\*\*/,          // Negrita
      /\*/,            // Cursiva o listas
      /-\s/,           // Listas
      /\d+\.\s/,       // Listas numeradas
      /\[.+\]\(.+\)/,  // Enlaces
      /```/,           // Bloques de código
    ];

    const hasMarkdownSyntax = markdownPatterns.some(pattern => pattern.test(content));
    
    if (!hasMarkdownSyntax) {
      console.log('❌ No se detectó sintaxis Markdown');
    }

    return hasMarkdownSyntax;
  }

  /**
   * Renderiza el markdown a HTML y lo sanitiza
   */
  private async renderMarkdown(markdownText: string): Promise<void> {
    try {
      console.log('🔄 Renderizando markdown...', markdownText.substring(0, 100));

      // Procesar el markdown a HTML
      const html = await marked.parse(markdownText);
      
      console.log('✅ HTML generado:', html.substring(0, 200));

      // Sanitizar y marcar como seguro
      this.termsContent = this.sanitizer.bypassSecurityTrustHtml(html);

      // Actualizar fecha (si viene del backend, podrías recibirla)
      this.lastUpdated = new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

    } catch (err) {
      console.error('❌ Error al renderizar markdown:', err);
      this.error = 'Error al procesar el contenido';
      throw err;
    }
  }

  /**
   * Retorna los términos por defecto en formato Markdown
   */
  private getDefaultTerms(): string {
    return `# Términos y Condiciones de Uso

*Última actualización: ${new Date().toLocaleDateString('es-ES')}*

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

> **IMPORTANTE**: En la máxima medida permitida por la ley aplicable, [Nombre de la Plataforma] **no será responsable**, bajo ninguna circunstancia, por daños directos, indirectos, incidentales, consecuentes, especiales o ejemplares.

Esto incluye, pero no se limita a:

- ❌ El uso o la imposibilidad de usar la Plataforma
- ❌ Transacciones o comunicaciones fallidas o fraudulentas entre usuarios
- ❌ El manejo o uso de los bienes donados o los fondos recaudados
- ❌ Fallas en la seguridad o fugas de datos derivadas de ataques externos
- ❌ Pérdida de datos o información
- ❌ Interrupciones del servicio

### 3.2 Exención de Garantías

La Plataforma se proporciona **"TAL CUAL"** y **"SEGÚN DISPONIBILIDAD"**, sin garantías de ningún tipo, ya sean expresas o implícitas.

---

## 4. Monitoreo y Bloqueo

### 4.1 Cláusula de Auditoría

El usuario otorga **consentimiento expreso e irrevocable** para:

- 📊 El monitoreo de toda su actividad en la Plataforma
- 💬 El registro de sus comunicaciones
- 🔍 La auditoría de sus transacciones
- 📝 El almacenamiento de logs de actividad

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

---

## 6. Propiedad Intelectual

Todo el contenido de la Plataforma, incluyendo:

- Diseño
- Logotipos
- Textos
- Código fuente
- Bases de datos

Es propiedad exclusiva de [Nombre de la Plataforma] o de sus licenciantes.

---

## 7. Modificaciones

Nos reservamos el derecho de modificar estos T&C en cualquier momento. Los cambios entrarán en vigor inmediatamente después de su publicación en la Plataforma.

### 7.1 Notificación

Los usuarios serán notificados de cambios significativos mediante:

- ✉️ Correo electrónico
- 🔔 Notificaciones en la Plataforma
- 📱 Mensajes push (app móvil)

---

## 8. Ley Aplicable y Jurisdicción

Estos T&C se rigen por las leyes de [País/Jurisdicción]. Cualquier disputa será resuelta en los tribunales de [Ciudad/Jurisdicción].

---

## 9. Contacto

Para preguntas sobre estos Términos y Condiciones:

- **Email**: legal@plataforma.com
- **Teléfono**: +1 (555) 123-4567
- **Dirección**: Calle Principal #123, Ciudad, País

---

## 10. Aceptación

Al hacer clic en "Aceptar" o al continuar usando la Plataforma, usted confirma que:

- ✅ Ha leído estos Términos y Condiciones
- ✅ Los comprende completamente
- ✅ Acepta estar legalmente vinculado por ellos

---

*© ${new Date().getFullYear()} [Nombre de la Plataforma]. Todos los derechos reservados.*`;
  }

  /**
   * Recargar los términos manualmente
   */
  reload(): void {
    this.loadTerms();
  }

  /**
   * Cerrar el modal
   */
  close(): void {
    this.dialogRef.close();
  }

  /**
   * Imprimir los términos
   */
  print(): void {
    window.print();
  }

  /**
   * Descargar los términos como texto
   */
  downloadAsText(): void {
    // Extraer el texto del HTML renderizado
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = this.termsContent as string;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';

    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terminos-y-condiciones-${Date.now()}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}