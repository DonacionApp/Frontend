import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { marked } from 'marked';

/**
 * Renderiza markdown de forma segura.
 *
 * mode="rich"  -> convierte el markdown a HTML (vistas completas: detalle, feed)
 * mode="plain" -> quita la sintaxis y deja texto plano (tarjetas con line-clamp)
 *
 * El HTML se pasa a [innerHTML] como string normal, de modo que Angular lo
 * sanitiza automáticamente. No se usa bypassSecurityTrustHtml porque el
 * contenido lo escriben los usuarios.
 */
@Component({
  selector: 'app-markdown-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="mode === 'rich'" class="markdown-body" [ngClass]="cssClass" [innerHTML]="renderedHtml"></div>
    <div *ngIf="mode === 'plain'" [ngClass]="cssClass">{{ plainText }}</div>
  `,
  styleUrls: ['./markdown-view.component.scss']
})
export class MarkdownViewComponent implements OnChanges {
  @Input() content: string | null | undefined = '';
  @Input() mode: 'rich' | 'plain' = 'rich';
  @Input() cssClass: string = '';

  renderedHtml: string = '';
  plainText: string = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['content'] || changes['mode']) {
      this.render();
    }
  }

  private render(): void {
    const source = this.content || '';

    if (this.mode === 'plain') {
      this.plainText = this.stripMarkdown(source);
      this.renderedHtml = '';
      return;
    }

    this.plainText = '';

    if (!source.trim()) {
      this.renderedHtml = '';
      return;
    }

    try {
      this.renderedHtml = marked.parse(source, { breaks: true, gfm: true, async: false }) as string;
    } catch (err) {
      console.error('Error renderizando markdown:', err);
      this.renderedHtml = this.escapeHtml(source);
    }
  }

  private stripMarkdown(source: string): string {
    return source
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/`{1,3}([^`]*)`{1,3}/g, '$1')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s{0,3}>\s?/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/~~(.*?)~~/g, '$1')
      .replace(/^\s*([-*_]\s*){3,}$/gm, '')
      .trim();
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
