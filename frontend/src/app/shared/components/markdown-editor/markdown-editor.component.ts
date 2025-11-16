import { Component, Input, Output, EventEmitter, forwardRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

interface FormatButton {
  icon: string;
  tooltip: string;
  action: () => void;
}

@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MarkdownEditorComponent),
      multi: true
    }
  ],
  templateUrl: './markdown-editor.component.html',
  styleUrls: ['./markdown-editor.component.scss']
})
export class MarkdownEditorComponent implements ControlValueAccessor {
  @Input() placeholder: string = 'Escribe aquí...';
  @Input() rows: number = 6;
  @Input() maxLength: number = 5000;
  @Input() disabled: boolean = false;
  @Input() showPreview: boolean = false;
  
  @ViewChild('textarea') textareaRef!: ElementRef<HTMLTextAreaElement>;
  
  value: string = '';
  showPreviewMode: boolean = false;
  previewHtml: SafeHtml = '';
  
  // ControlValueAccessor
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private sanitizer: DomSanitizer) {
    // Configurar marked para mejor renderizado
    marked.setOptions({
      breaks: true,
      gfm: true
    });
  }

  formatButtons: FormatButton[] = [
    {
      icon: 'B',
      tooltip: 'Negrita (Ctrl+B)',
      action: () => this.applyFormat('**', '**', 'texto en negrita')
    },
    {
      icon: 'I',
      tooltip: 'Cursiva (Ctrl+I)',
      action: () => this.applyFormat('*', '*', 'texto en cursiva')
    },
    {
      icon: 'H',
      tooltip: 'Encabezado',
      action: () => this.applyFormat('## ', '', 'Encabezado')
    },
    {
      icon: '•',
      tooltip: 'Lista',
      action: () => this.insertList()
    },
    {
      icon: '1.',
      tooltip: 'Lista numerada',
      action: () => this.insertNumberedList()
    },
    {
      icon: '🔗',
      tooltip: 'Enlace',
      action: () => this.insertLink()
    },
    {
      icon: '""',
      tooltip: 'Cita',
      action: () => this.applyFormat('> ', '', 'cita')
    },
    {
      icon: '</>', 
      tooltip: 'Código',
      action: () => this.applyFormat('`', '`', 'código')
    }
  ];

  writeValue(value: string): void {
    this.value = value || '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.value = target.value;
    this.onChange(this.value);
  }

  onBlur(): void {
    this.onTouched();
  }

  applyFormat(prefix: string, suffix: string, placeholder: string): void {
    const textarea = this.textareaRef.nativeElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = this.value.substring(start, end);
    const textToInsert = selectedText || placeholder;
    
    const before = this.value.substring(0, start);
    const after = this.value.substring(end);
    
    this.value = before + prefix + textToInsert + suffix + after;
    this.onChange(this.value);
    
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + textToInsert.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }

  insertList(): void {
    const textarea = this.textareaRef.nativeElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = this.value.substring(start, end);
    
    let listText = '';
    if (selectedText) {
      const lines = selectedText.split('\n');
      listText = lines.map(line => line.trim() ? `- ${line}` : '').join('\n');
    } else {
      listText = '- Elemento 1\n- Elemento 2\n- Elemento 3';
    }
    
    const before = this.value.substring(0, start);
    const after = this.value.substring(end);
    
    this.value = before + listText + after;
    this.onChange(this.value);
    
    setTimeout(() => {
      textarea.focus();
    }, 0);
  }

  insertNumberedList(): void {
    const textarea = this.textareaRef.nativeElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = this.value.substring(start, end);
    
    let listText = '';
    if (selectedText) {
      const lines = selectedText.split('\n');
      listText = lines.map((line, index) => line.trim() ? `${index + 1}. ${line}` : '').join('\n');
    } else {
      listText = '1. Elemento 1\n2. Elemento 2\n3. Elemento 3';
    }
    
    const before = this.value.substring(0, start);
    const after = this.value.substring(end);
    
    this.value = before + listText + after;
    this.onChange(this.value);
    
    setTimeout(() => {
      textarea.focus();
    }, 0);
  }

  insertLink(): void {
    const textarea = this.textareaRef.nativeElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = this.value.substring(start, end);
    
    const linkText = selectedText || 'texto del enlace';
    const linkUrl = 'https://ejemplo.com';
    const markdown = `[${linkText}](${linkUrl})`;
    
    const before = this.value.substring(0, start);
    const after = this.value.substring(end);
    
    this.value = before + markdown + after;
    this.onChange(this.value);
    
    setTimeout(() => {
      textarea.focus();
      const urlStart = start + linkText.length + 3;
      const urlEnd = urlStart + linkUrl.length;
      textarea.setSelectionRange(urlStart, urlEnd);
    }, 0);
  }

  async togglePreview(): Promise<void> {
    this.showPreviewMode = !this.showPreviewMode;
    
    // Si activamos preview, convertir markdown a HTML
    if (this.showPreviewMode && this.value) {
      await this.updatePreview();
    }
  }
  
  private async updatePreview(): Promise<void> {
    if (!this.value) {
      this.previewHtml = '';
      return;
    }
    
    try {
      const html = await marked.parse(this.value);
      this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(html);
      console.log('✅ Markdown convertido a HTML');
    } catch (err) {
      console.error('❌ Error convirtiendo markdown:', err);
      this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(
        '<p class="text-red-500">Error al convertir markdown</p>'
      );
    }
  }

  get characterCount(): number {
    return this.value?.length || 0;
  }

  get characterCountClass(): string {
    const percentage = (this.characterCount / this.maxLength) * 100;
    if (percentage >= 90) return 'text-red-600 font-semibold';
    if (percentage >= 75) return 'text-orange-600';
    return 'text-gray-500';
  }
}
