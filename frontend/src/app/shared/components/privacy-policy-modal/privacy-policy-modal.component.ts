import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { SystemService } from '../../../core/services/system.service';
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
    private systemService: SystemService,
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
      this.loadDefaultPolicy();
    }
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

