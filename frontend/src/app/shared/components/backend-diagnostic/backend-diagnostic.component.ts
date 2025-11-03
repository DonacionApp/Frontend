import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DonationConnectionService, DonationConnectionStatus } from '../../../core/services/donation-connection.service';

@Component({
  selector: 'app-backend-diagnostic',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-900">Verificación de Conexión - Donaciones</h2>
        <button
          (click)="checkConnection()"
          [disabled]="loading"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span *ngIf="!loading">🔄 Verificar</span>
          <span *ngIf="loading">⏳ Verificando...</span>
        </button>
      </div>

      <!-- Estado de Conexión -->
      <div *ngIf="connectionStatus" class="space-y-4">
        <!-- Indicador de Estado -->
        <div class="border rounded-lg p-6" [ngClass]="getStatusClass()">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-3">
              <div 
                class="w-5 h-5 rounded-full"
                [ngClass]="{
                  'bg-green-500': connectionStatus.connected,
                  'bg-red-500': !connectionStatus.connected
                }"
              ></div>
              <span class="text-xl font-semibold" [ngClass]="getStatusTextClass()">
                {{ connectionStatus.connected ? '✅ Conectado' : '❌ Desconectado' }}
              </span>
            </div>
            <span *ngIf="connectionStatus.responseTime" class="text-sm text-gray-500">
              {{ connectionStatus.responseTime }}ms
            </span>
          </div>
          
          <p class="mb-4" [ngClass]="getStatusTextClass()">
            {{ connectionStatus.message }}
          </p>

          <!-- Información del Endpoint -->
          <div class="bg-gray-50 rounded p-3">
            <p class="text-xs text-gray-600 mb-1">Endpoint:</p>
            <code class="text-sm text-blue-600 font-mono">{{ getEndpointUrl() }}</code>
          </div>
        </div>

        <!-- Mensajes de Ayuda -->
        <div *ngIf="!connectionStatus.connected" class="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 class="font-semibold text-red-900 mb-2">⚠️ No se pudo conectar</h4>
          <ul class="list-disc list-inside space-y-1 text-sm text-red-700">
            <li>Verifica que el servidor backend esté ejecutándose en el puerto 5000</li>
            <li>Revisa la configuración en <code class="bg-red-100 px-1 rounded">environment.ts</code></li>
            <li>Comprueba los logs del servidor backend</li>
            <li>Verifica que el endpoint <code class="bg-red-100 px-1 rounded">/post</code> esté disponible</li>
            <li>Revisa que no haya problemas de firewall o CORS</li>
          </ul>
        </div>

        <!-- Detalles del Error -->
        <div *ngIf="!connectionStatus.connected && connectionStatus.error" class="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 class="font-semibold text-gray-900 mb-2 text-sm">Detalles del Error:</h4>
          <pre class="text-xs text-gray-600 overflow-auto">{{ getErrorDetails() }}</pre>
        </div>
      </div>

      <!-- Estado inicial -->
      <div *ngIf="!connectionStatus && !loading" class="text-center text-gray-500 py-8">
        <p>Presiona el botón "Verificar" para comprobar la conexión</p>
      </div>
    </div>
  `
})
export class BackendDiagnosticComponent implements OnInit {
  connectionStatus: DonationConnectionStatus | null = null;
  loading = false;

  constructor(private donationConnectionService: DonationConnectionService) {}

  ngOnInit(): void {
    this.checkConnection();
  }

  checkConnection(): void {
    this.loading = true;
    this.donationConnectionService.checkConnection().subscribe({
      next: (status) => {
        this.connectionStatus = status;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al verificar conexión:', error);
        this.connectionStatus = {
          connected: false,
          message: '❌ Error al verificar la conexión',
          error: error
        };
        this.loading = false;
      }
    });
  }

  getEndpointUrl(): string {
    return this.donationConnectionService.getEndpointUrl();
  }

  getStatusClass(): string {
    if (!this.connectionStatus) return 'border-gray-200';
    return this.connectionStatus.connected 
      ? 'border-green-200 bg-green-50' 
      : 'border-red-200 bg-red-50';
  }

  getStatusTextClass(): string {
    if (!this.connectionStatus) return 'text-gray-700';
    return this.connectionStatus.connected 
      ? 'text-green-700' 
      : 'text-red-700';
  }

  getErrorDetails(): string {
    if (!this.connectionStatus?.error) return 'No hay detalles disponibles';
    return JSON.stringify(this.connectionStatus.error, null, 2);
  }
}

