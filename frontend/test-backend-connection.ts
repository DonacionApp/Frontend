/**
 * Script de prueba para verificar la conexión con el backend
 * Ejecutar desde la consola del navegador o como servicio de prueba
 */

import { HttpClient } from '@angular/common/http';
import { environment } from './src/environments/environment';

export async function testBackendConnection() {
  const backendUrl = environment.apiBackendUrl;
  const testEndpoints = [
    { name: 'Health Check', url: `${backendUrl}/health` },
    { name: 'TypePost', url: `${backendUrl}/typepost` },
    { name: 'Post (All)', url: `${backendUrl}/post/all` },
  ];

  console.log('🔍 Probando conexión con el backend...');
  console.log('📍 URL base:', backendUrl);
  console.log('═══════════════════════════════════════════════════════');

  for (const endpoint of testEndpoints) {
    try {
      console.log(`\n📡 Probando: ${endpoint.name}`);
      console.log(`   URL: ${endpoint.url}`);
      
      const response = await fetch(endpoint.url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ ÉXITO - Status: ${response.status}`);
        console.log(`   📦 Respuesta:`, data);
      } else {
        console.log(`   ⚠️  Respuesta recibida pero con error - Status: ${response.status}`);
        console.log(`   📋 Status Text: ${response.statusText}`);
      }
    } catch (error: any) {
      console.error(`   ❌ ERROR:`, error.message);
      if (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_REFUSED')) {
        console.error(`   🔴 El backend no está respondiendo en ${endpoint.url}`);
        console.error(`   💡 Verifica que el backend esté corriendo en el puerto 5000`);
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✅ Prueba de conexión completada');
}

// Función para probar desde la consola del navegador
(window as any).testBackend = testBackendConnection;

