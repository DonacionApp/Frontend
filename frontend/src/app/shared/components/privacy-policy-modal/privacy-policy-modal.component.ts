import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

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
    private http: HttpClient,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadPolicy();
  }

  async loadPolicy(): Promise<void> {
    // Configurar opciones de marked para mejor renderizado
    marked.setOptions({
      breaks: true,      // Convierte \n en <br>
      gfm: true          // GitHub Flavored Markdown
    });
    
    console.log('🔧 Marked configurado para Privacy Policy');

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 2000)
    );

    const httpPromise = this.http.get('http://localhost:5000/system/policies').toPromise();

    Promise.race([httpPromise, timeoutPromise])
      .then(async (data: any) => {
        try {
          console.log('✅ Policy data received:', data);
          
          let policyText = '';

          if (typeof data === 'object' && data !== null) {
            policyText = data.content || data.text || data.policy || data.data || '';
          } else {
            policyText = String(data);
          }

          // Validar que el contenido tenga markdown real
          const hasMarkdown = policyText.includes('#') || policyText.includes('**') || policyText.includes('-') || policyText.includes('*');
          
          if (!policyText || policyText.length < 100 || !hasMarkdown) {
            console.log('⚠️ Contenido del backend no válido, usando default');
            policyText = this.getDefaultPolicy();
          }

          console.log('📝 Policy text (first 200 chars):', policyText.substring(0, 200));

          const html = await marked.parse(policyText);
          console.log('✅ HTML parseado (first 200 chars):', html.substring(0, 200));
          
          this.policyContent = this.sanitizer.bypassSecurityTrustHtml(html);
          this.loading = false;
        } catch (err) {
          console.error('❌ Error parsing markdown:', err);
          this.loadDefaultPolicy();
        }
      })
      .catch((err) => {
        console.error('❌ Error loading policy from backend:', err);
        console.log('⚠️ Usando política por defecto');
        this.loadDefaultPolicy();
      });
  }

  private async loadDefaultPolicy(): Promise<void> {
    try {
      const defaultHtml = await marked.parse(this.getDefaultPolicy());
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
}

