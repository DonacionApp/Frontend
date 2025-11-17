import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExportService, ExportMetadata } from '../../../core/services/export.service';
import { ToastService } from '../../../core/services/toast.service';

export type ExportFormat = 'csv' | 'excel' | 'pdf';

@Component({
  selector: 'app-export-data',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './export-data.component.html',
  styleUrls: ['./export-data.component.scss']
})
export class ExportDataComponent implements OnInit {
  @Input() data: any[] = [];
  @Input() filename: string = 'export';
  @Input() sheetName: string = 'Datos';
  @Input() columns?: string[];
  @Input() filters?: any;
  @Input() visible: boolean = false;
  
  @Output() close = new EventEmitter<void>();
  @Output() exportComplete = new EventEmitter<ExportMetadata>();

  selectedFormat: ExportFormat = 'csv';
  exporting = false;
  progress = 0;
  errorMessage = '';

  constructor(
    private exportService: ExportService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    if (this.data.length === 0) {
      this.errorMessage = 'No hay datos para exportar';
    }
  }

  onFormatSelect(format: ExportFormat): void {
    this.selectedFormat = format;
  }

  onExport(): void {
    if (this.data.length === 0) {
      this.toastService.error('Error', 'No hay datos para exportar');
      return;
    }

    this.exporting = true;
    this.progress = 0;
    this.errorMessage = '';

    try {
      const options = {
        filename: this.filename,
        sheetName: this.sheetName,
        columns: this.columns,
        includeHeaders: true,
        onProgress: (progress: number) => {
          this.progress = progress;
        }
      };

      // Ejecutar exportación según formato
      switch (this.selectedFormat) {
        case 'csv':
          this.exportService.exportToCSV(this.data, options);
          break;
        case 'excel':
          this.exportService.exportToExcel(this.data, options);
          break;
        case 'pdf':
          this.exportService.exportToPDF(this.data, options);
          break;
      }

      // Generar metadata y log
      const metadata: ExportMetadata = {
        totalRecords: this.data.length,
        exportedRecords: this.data.length,
        format: this.selectedFormat,
        timestamp: new Date().toISOString(),
        filters: this.filters
      };

      // Descargar log
      setTimeout(() => {
        this.exportService.downloadLog(metadata, `${this.filename}-log`);
      }, 500);

      this.exportComplete.emit(metadata);
      this.toastService.success(
        'Exportación exitosa',
        `Se exportaron ${this.data.length} registros en formato ${this.selectedFormat.toUpperCase()}`
      );

      // Cerrar modal después de un breve delay
      setTimeout(() => {
        this.onClose();
      }, 1000);

    } catch (error: any) {
      console.error('Error al exportar:', error);
      this.errorMessage = error.message || 'Error al exportar los datos';
      this.toastService.error('Error de exportación', this.errorMessage);
    } finally {
      this.exporting = false;
      this.progress = 0;
    }
  }

  onClose(): void {
    this.visible = false;
    this.selectedFormat = 'csv';
    this.exporting = false;
    this.progress = 0;
    this.errorMessage = '';
    this.close.emit();
  }

  getFormatLabel(format: ExportFormat): string {
    const labels: Record<ExportFormat, string> = {
      csv: 'CSV',
      excel: 'Excel (XLSX)',
      pdf: 'PDF'
    };
    return labels[format];
  }

  getFormatDescription(format: ExportFormat): string {
    const descriptions: Record<ExportFormat, string> = {
      csv: 'Formato de texto separado por comas. Compatible con Excel y Google Sheets.',
      excel: 'Formato nativo de Microsoft Excel. Incluye formato y múltiples hojas.',
      pdf: 'Documento PDF. Ideal para compartir y imprimir.'
    };
    return descriptions[format];
  }
}

