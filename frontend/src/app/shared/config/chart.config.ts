/**
 * Configuración global para Chart.js
 * 
 * Este archivo centraliza todas las configuraciones de gráficos
 * para mantener consistencia visual en toda la aplicación.
 */

import { ChartConfiguration, ChartOptions, TooltipItem } from 'chart.js';

/**
 * Colores predefinidos para los gráficos
 * Siguiendo la paleta de colores de Tailwind CSS
 */
export const CHART_COLORS = {
  primary: {
    background: 'rgba(59, 130, 246, 0.2)',    // blue-500 con alpha
    border: 'rgb(59, 130, 246)',              // blue-500
  },
  success: {
    background: 'rgba(34, 197, 94, 0.2)',     // green-500 con alpha
    border: 'rgb(34, 197, 94)',               // green-500
  },
  warning: {
    background: 'rgba(251, 146, 60, 0.2)',    // orange-500 con alpha
    border: 'rgb(251, 146, 60)',              // orange-500
  },
  danger: {
    background: 'rgba(239, 68, 68, 0.2)',     // red-500 con alpha
    border: 'rgb(239, 68, 68)',               // red-500
  },
  info: {
    background: 'rgba(99, 102, 241, 0.2)',    // indigo-500 con alpha
    border: 'rgb(99, 102, 241)',              // indigo-500
  },
  purple: {
    background: 'rgba(168, 85, 247, 0.2)',    // purple-500 con alpha
    border: 'rgb(168, 85, 247)',              // purple-500
  },
  pink: {
    background: 'rgba(236, 72, 153, 0.2)',    // pink-500 con alpha
    border: 'rgb(236, 72, 153)',              // pink-500
  },
  cyan: {
    background: 'rgba(6, 182, 212, 0.2)',     // cyan-500 con alpha
    border: 'rgb(6, 182, 212)',               // cyan-500
  }
};

/**
 * Configuración base para todos los gráficos
 */
export const BASE_CHART_OPTIONS: ChartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      display: true,
      position: 'top',
      labels: {
        color: '#4B5563',              // gray-600
        font: {
          family: "'Inter', sans-serif",
          size: 12,
          weight: 500
        },
        padding: 15,
        usePointStyle: true,
        pointStyle: 'circle'
      }
    },
    tooltip: {
      enabled: true,
      backgroundColor: 'rgba(17, 24, 39, 0.95)',  // gray-900
      titleColor: '#F9FAFB',           // gray-50
      bodyColor: '#F9FAFB',            // gray-50
      borderColor: '#374151',          // gray-700
      borderWidth: 1,
      padding: 12,
      displayColors: true,
      boxPadding: 6,
      titleFont: {
        size: 13,
        weight: 'bold'
      },
      bodyFont: {
        size: 12
      },
      cornerRadius: 8
    }
  },
  animation: {
    duration: 750,
    easing: 'easeInOutQuart'
  }
};

/**
 * Opciones específicas para gráficos de líneas
 */
export const LINE_CHART_OPTIONS: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      display: true,
      position: 'top',
      labels: {
        color: '#4B5563',
        font: { family: "'Inter', sans-serif", size: 12, weight: 500 },
        padding: 15,
        usePointStyle: true,
        pointStyle: 'circle'
      }
    },
    tooltip: {
      enabled: true,
      backgroundColor: 'rgba(17, 24, 39, 0.95)',
      titleColor: '#F9FAFB',
      bodyColor: '#F9FAFB',
      borderColor: '#374151',
      borderWidth: 1,
      padding: 12,
      displayColors: true,
      boxPadding: 6,
      titleFont: { size: 13, weight: 'bold' },
      bodyFont: { size: 12 },
      cornerRadius: 8
    }
  },
  animation: { duration: 750, easing: 'easeInOutQuart' },
  scales: {
    x: {
      grid: { display: true, color: 'rgba(229, 231, 235, 0.5)' },
      ticks: { color: '#6B7280', font: { size: 11 } }
    },
    y: {
      beginAtZero: true,
      grid: { display: true, color: 'rgba(229, 231, 235, 0.5)' },
      ticks: { color: '#6B7280', font: { size: 11 } }
    }
  },
  elements: {
    line: { tension: 0.4, borderWidth: 2 },
    point: { radius: 4, hitRadius: 10, hoverRadius: 6, hoverBorderWidth: 2 }
  }
};

/**
 * Opciones específicas para gráficos de barras
 */
export const BAR_CHART_OPTIONS: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      display: true,
      position: 'top',
      labels: {
        color: '#4B5563',
        font: { family: "'Inter', sans-serif", size: 12, weight: 500 },
        padding: 15,
        usePointStyle: true,
        pointStyle: 'circle'
      }
    },
    tooltip: {
      enabled: true,
      backgroundColor: 'rgba(17, 24, 39, 0.95)',
      titleColor: '#F9FAFB',
      bodyColor: '#F9FAFB',
      borderColor: '#374151',
      borderWidth: 1,
      padding: 12,
      displayColors: true,
      boxPadding: 6,
      titleFont: { size: 13, weight: 'bold' },
      bodyFont: { size: 12 },
      cornerRadius: 8
    }
  },
  animation: { duration: 750, easing: 'easeInOutQuart' },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#6B7280', font: { size: 11 } }
    },
    y: {
      beginAtZero: true,
      grid: { display: true, color: 'rgba(229, 231, 235, 0.5)' },
      ticks: { color: '#6B7280', font: { size: 11 } }
    }
  },
  elements: {
    bar: { borderWidth: 0, borderRadius: 6, borderSkipped: false }
  }
};

/**
 * Opciones específicas para gráficos de dona/pie
 */
export const DOUGHNUT_CHART_OPTIONS: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: true,
  cutout: '65%',                            // Para efecto de dona
  plugins: {
    legend: {
      display: true,
      position: 'right',
      labels: {
        color: '#4B5563',
        font: {
          family: "'Inter', sans-serif",
          size: 12,
          weight: 500
        },
        padding: 15,
        usePointStyle: true,
        pointStyle: 'circle'
      }
    },
    tooltip: {
      enabled: true,
      backgroundColor: 'rgba(17, 24, 39, 0.95)',
      titleColor: '#F9FAFB',
      bodyColor: '#F9FAFB',
      borderColor: '#374151',
      borderWidth: 1,
      padding: 12,
      displayColors: true,
      boxPadding: 6,
      titleFont: {
        size: 13,
        weight: 'bold'
      },
      bodyFont: {
        size: 12
      },
      cornerRadius: 8
    }
  },
  animation: {
    duration: 750,
    easing: 'easeInOutQuart'
  }
};

/**
 * Utilidad para formatear números en tooltips
 */
export const formatTooltipNumber = (value: number, label?: string): string => {
  if (label?.toLowerCase().includes('porcentaje') || label?.toLowerCase().includes('%')) {
    return `${value.toFixed(1)}%`;
  }
  
  if (label?.toLowerCase().includes('dinero') || label?.toLowerCase().includes('$')) {
    return `$${value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  
  return value.toLocaleString('es-ES');
};

/**
 * Utilidad para generar gradientes en canvas
 */
export const createGradient = (
  ctx: CanvasRenderingContext2D,
  height: number,
  colorStart: string,
  colorEnd: string
): CanvasGradient => {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, colorStart);
  gradient.addColorStop(1, colorEnd);
  return gradient;
};

/**
 * Dataset predefinido para gráfico de línea con estilo profesional
 */
export const createLineDataset = (
  label: string,
  data: number[],
  colorScheme: keyof typeof CHART_COLORS = 'primary'
) => {
  return {
    label,
    data,
    backgroundColor: CHART_COLORS[colorScheme].background,
    borderColor: CHART_COLORS[colorScheme].border,
    fill: true,
    tension: 0.4,
    pointBackgroundColor: CHART_COLORS[colorScheme].border,
    pointBorderColor: '#fff',
    pointBorderWidth: 2,
    pointRadius: 4,
    pointHoverRadius: 6
  };
};

/**
 * Dataset predefinido para gráfico de barras con estilo profesional
 */
export const createBarDataset = (
  label: string,
  data: number[],
  colorScheme: keyof typeof CHART_COLORS = 'primary'
) => {
  return {
    label,
    data,
    backgroundColor: CHART_COLORS[colorScheme].background,
    borderColor: CHART_COLORS[colorScheme].border,
    borderWidth: 2,
    borderRadius: 6,
    hoverBackgroundColor: CHART_COLORS[colorScheme].border
  };
};
