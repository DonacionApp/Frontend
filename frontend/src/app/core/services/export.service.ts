import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
// @ts-ignore - jspdf-autotable puede tener problemas de tipos
import autoTable from 'jspdf-autotable';

// Extender el tipo de jsPDF para incluir autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export interface ExportMetadata {
  totalRecords: number;
  exportedRecords: number;
  format: 'csv' | 'excel' | 'pdf';
  timestamp: string;
  filters?: any;
  errors?: string[];
}

export interface ExportOptions {
  filename?: string;
  sheetName?: string;
  includeHeaders?: boolean;
  columns?: string[];
  onProgress?: (progress: number) => void;
}

@Injectable({
  providedIn: 'root'
})
export class ExportService {
  
  constructor() {}

  /**
   * Exportar datos a CSV
   */
  exportToCSV(data: any[], options: ExportOptions = {}): void {
    const { filename = 'export', includeHeaders = true, columns, onProgress } = options;
    
    if (onProgress) onProgress(10);

    if (!data || data.length === 0) {
      throw new Error('No hay datos para exportar');
    }

    // Determinar columnas a exportar
    const exportColumns = columns || (data.length > 0 ? Object.keys(data[0]) : []);
    
    if (onProgress) onProgress(30);

    // Crear filas CSV
    const csvRows: string[] = [];
    
    // Agregar encabezados
    if (includeHeaders) {
      csvRows.push(exportColumns.map(col => this.escapeCSV(col)).join(','));
    }
    
    if (onProgress) onProgress(50);

    // Agregar datos
    data.forEach((row, index) => {
      const values = exportColumns.map(col => {
        const value = this.getNestedValue(row, col);
        return this.escapeCSV(value);
      });
      csvRows.push(values.join(','));
      
      if (onProgress && index % 10 === 0) {
        onProgress(50 + (index / data.length) * 40);
      }
    });

    if (onProgress) onProgress(90);

    // Crear archivo CSV con BOM UTF-8 para Excel
    const BOM = '\uFEFF';
    const csvContent = BOM + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    this.downloadFile(blob, `${filename}.csv`, 'text/csv');
    
    if (onProgress) onProgress(100);
  }

  /**
   * Exportar datos a Excel (XLSX)
   */
  exportToExcel(data: any[], options: ExportOptions = {}): void {
    const { filename = 'export', sheetName = 'Datos', includeHeaders = true, columns, onProgress } = options;
    
    if (onProgress) onProgress(10);

    if (!data || data.length === 0) {
      throw new Error('No hay datos para exportar');
    }

    // Determinar columnas a exportar
    const exportColumns = columns || (data.length > 0 ? Object.keys(data[0]) : []);
    
    if (onProgress) onProgress(20);

    // Preparar datos para Excel
    const worksheetData: any[] = [];
    
    // Agregar encabezados
    if (includeHeaders) {
      worksheetData.push(exportColumns.map(col => this.formatHeader(col)));
    }
    
    if (onProgress) onProgress(30);

    // Agregar datos
    data.forEach((row, index) => {
      const values = exportColumns.map(col => {
        return this.getNestedValue(row, col);
      });
      worksheetData.push(values);
      
      if (onProgress && index % 10 === 0) {
        onProgress(30 + (index / data.length) * 50);
      }
    });

    if (onProgress) onProgress(80);

    // Crear workbook y worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // Ajustar ancho de columnas
    const colWidths = exportColumns.map((col, idx) => {
      const maxLength = Math.max(
        col.length,
        ...data.map(row => {
          const value = this.getNestedValue(row, col);
          return String(value || '').length;
        })
      );
      return { wch: Math.min(maxLength + 2, 50) };
    });
    worksheet['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    if (onProgress) onProgress(90);

    // Generar archivo
    XLSX.writeFile(workbook, `${filename}.xlsx`);
    
    if (onProgress) onProgress(100);
  }

  /**
   * Exportar datos a PDF
   */
  exportToPDF(data: any[], options: ExportOptions = {}): void {
    const { filename = 'export', includeHeaders = true, columns, onProgress } = options;
    
    if (onProgress) onProgress(10);

    if (!data || data.length === 0) {
      throw new Error('No hay datos para exportar');
    }

    // Determinar columnas a exportar
    const exportColumns = columns || (data.length > 0 ? Object.keys(data[0]) : []);
    
    if (onProgress) onProgress(20);

    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const usableWidth = pageWidth - (margin * 2);
    
    // Preparar datos para la tabla
    const tableData: any[][] = [];
    
    if (includeHeaders) {
      tableData.push(exportColumns.map(col => this.formatHeader(col)));
    }
    
    if (onProgress) onProgress(30);

    // Agregar datos (limitar a 100 filas para evitar PDFs muy grandes)
    const maxRows = 100;
    const dataToExport = data.slice(0, maxRows);
    
    dataToExport.forEach((row, index) => {
      const values = exportColumns.map(col => {
        const value = this.getNestedValue(row, col);
        return String(value || '').substring(0, 50); // Limitar longitud
      });
      tableData.push(values);
      
      if (onProgress && index % 10 === 0) {
        onProgress(30 + (index / dataToExport.length) * 50);
      }
    });

    if (onProgress) onProgress(80);

    // Agregar tabla al PDF usando autoTable
    // En jspdf-autotable v5, se usa como función con el doc como primer parámetro
    try {
      autoTable(doc, {
        head: includeHeaders ? [tableData[0]] : [],
        body: includeHeaders ? tableData.slice(1) : tableData,
        startY: margin + 10,
        margin: { top: margin, right: margin, bottom: margin, left: margin },
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [66, 139, 202], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: exportColumns.reduce((acc, col, idx) => {
          acc[idx] = { cellWidth: 'auto' };
          return acc;
        }, {} as any)
      });
    } catch (error: any) {
      // Si autoTable falla, intentar con doc.autoTable
      if (typeof (doc as any).autoTable === 'function') {
        (doc as any).autoTable({
          head: includeHeaders ? [tableData[0]] : [],
          body: includeHeaders ? tableData.slice(1) : tableData,
          startY: margin + 10,
          margin: { top: margin, right: margin, bottom: margin, left: margin },
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [66, 139, 202], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          columnStyles: exportColumns.reduce((acc, col, idx) => {
            acc[idx] = { cellWidth: 'auto' };
            return acc;
          }, {} as any)
        });
      } else {
        throw new Error('jspdf-autotable no está disponible. Error: ' + (error?.message || 'Desconocido'));
      }
    }

    // Agregar nota si se limitaron las filas
    if (data.length > maxRows) {
      doc.setFontSize(8);
      doc.text(
        `Nota: Se exportaron ${maxRows} de ${data.length} registros.`,
        margin,
        pageHeight - margin
      );
    }

    if (onProgress) onProgress(90);

    // Guardar PDF
    doc.save(`${filename}.pdf`);
    
    if (onProgress) onProgress(100);
  }

  /**
   * Generar log de exportación
   */
  generateExportLog(metadata: ExportMetadata): string {
    const logLines: string[] = [];
    
    logLines.push('=== LOG DE EXPORTACIÓN ===');
    logLines.push(`Fecha y hora: ${metadata.timestamp}`);
    logLines.push(`Formato: ${metadata.format.toUpperCase()}`);
    logLines.push(`Total de registros: ${metadata.totalRecords}`);
    logLines.push(`Registros exportados: ${metadata.exportedRecords}`);
    
    if (metadata.filters) {
      logLines.push('');
      logLines.push('=== FILTROS APLICADOS ===');
      Object.entries(metadata.filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          logLines.push(`${key}: ${value}`);
        }
      });
    }
    
    if (metadata.errors && metadata.errors.length > 0) {
      logLines.push('');
      logLines.push('=== ERRORES ===');
      metadata.errors.forEach((error, index) => {
        logLines.push(`${index + 1}. ${error}`);
      });
    }
    
    logLines.push('');
    logLines.push('=== FIN DEL LOG ===');
    
    return logLines.join('\n');
  }

  /**
   * Descargar log como archivo
   */
  downloadLog(metadata: ExportMetadata, filename: string = 'export-log'): void {
    const logContent = this.generateExportLog(metadata);
    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8;' });
    this.downloadFile(blob, `${filename}.txt`, 'text/plain');
  }

  /**
   * Descargar archivo
   */
  private downloadFile(blob: Blob, filename: string, mimeType: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Obtener valor anidado de un objeto
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => {
      return current && current[prop] !== undefined ? current[prop] : '';
    }, obj);
  }

  /**
   * Escapar valores para CSV
   */
  private escapeCSV(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    const stringValue = String(value);
    
    // Si contiene comas, comillas o saltos de línea, envolver en comillas
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
  }

  /**
   * Formatear encabezado para mostrar
   */
  private formatHeader(header: string): string {
    // Convertir camelCase o snake_case a título legible
    return header
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
}

