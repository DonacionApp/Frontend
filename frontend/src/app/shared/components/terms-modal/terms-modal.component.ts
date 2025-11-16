import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

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
    private http: HttpClient,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadTerms();
  }

  async loadTerms(): Promise<void> {
    this.http.get('http://localhost:5000/system/terms')
      .subscribe({
        next: async (data: any) => {
          try {
            // Extraer el contenido de texto
            let termsText = '';

            // Si es un objeto, buscar el campo de contenido
            if (typeof data === 'object' && data !== null) {
              termsText = data.content || data.text || data.terms || data.data || JSON.stringify(data);
            } else {
              // Si es texto plano
              termsText = String(data);
            }

            // Procesar markdown a HTML
            const html = await marked.parse(termsText);
            this.termsContent = this.sanitizer.bypassSecurityTrustHtml(html);
            this.loading = false;
          } catch (err) {
            console.error('Error parsing markdown:', err);
            // Si hay error, mostrar el contenido como plain text
            this.termsContent = this.sanitizer.bypassSecurityTrustHtml(`<pre>${JSON.stringify(data)}</pre>`);
            this.loading = false;
          }
        },
        error: (err) => {
          console.error('Error loading terms:', err);
          this.error = 'Error al cargar los términos y condiciones';
          this.loading = false;
        }
      });
  }

  close(): void {
    this.dialogRef.close();
  }
}