import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface PrometheusMetric {
  name: string;
  type: string;
  help: string;
  value: string | number;
  labels?: Record<string, string>;
}

import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'admin-metrics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './metrics.component.html',
  styleUrls: ['./metrics.component.scss']
})
export class MetricsComponent implements OnInit {
  metrics: PrometheusMetric[] = [];
  loading = true;
  error = '';
   private apiBackend=environment.apiBackendUrl

  constructor(
    private http: HttpClient,
   
) {}

  ngOnInit() {
    this.fetchMetrics();
  }

  fetchMetrics() {
    this.loading = true;
    this.http.get(`${this.apiBackend}/metrics`, { responseType: 'text' }).subscribe({
      next: (data) => {
        this.metrics = this.parsePrometheusText(data);
        this.loading = false;
      },
      error: (err) => {
        this.error = 'No se pudo cargar las métricas';
        this.loading = false;
      }
    });
  }

  parsePrometheusText(text: string): PrometheusMetric[] {
    const lines = text.split('\n');
    const metrics: PrometheusMetric[] = [];
    let help = '', type = '', name = '';
    for (const line of lines) {
      if (line.startsWith('# HELP')) {
        const [, n, h] = line.split(/\s+/, 3);
        name = n;
        help = h;
      } else if (line.startsWith('# TYPE')) {
        const [, n, t] = line.split(/\s+/, 3);
        name = n;
        type = t;
      } else if (line && !line.startsWith('#')) {
        // metric line
        const match = line.match(/^(\w+)(\{[^}]+\})?\s+([\d.eE+-]+)$/);
        if (match) {
          const [, metricName, labelStr, value] = match;
          let labels: Record<string, string> = {};
          if (labelStr) {
            labelStr.replace(/[{}]/g, '').split(',').forEach(pair => {
              const [k, v] = pair.split('=');
              labels[k] = v.replace(/"/g, '');
            });
          }
          metrics.push({
            name: metricName,
            type,
            help,
            value: Number(value),
            labels: Object.keys(labels).length ? labels : undefined
          });
        }
      }
    }
    return metrics;
  }
}
