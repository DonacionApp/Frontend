const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv'); // Importar dotenv para usarlo directamente

const environmentDir = path.join(__dirname, '../src/environments');

// 1. Crear el directorio si no existe
try {
  fs.mkdirSync(environmentDir, { recursive: true });
  // Environment directory verified/created
} catch (error) {
  console.error('❌ Error al crear el directorio:', error);
  process.exit(1);
}

dotenv.config();

// Environment variables loaded from .env
const apiUrl = process.env.API_URL || 'http://localhost:5000';
const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:5000/auth';
const apiBackendUrl = process.env.API_BACKEND_URL || 'http://localhost:5000';
const socketUrl = process.env.SOCKET_URL || 'http://localhost:5000';
const apiKeyGoogleMaps = process.env.API_KEY_GOOGLE_MAPS || 'tu api key';
const mapsMapId = process.env.MAPS_MAP_ID || '';

// Generating environment files with current .env values


const devEnv = `export const environment = {
  production: false,
  apiUrl: '${apiUrl}',
  apiBaseUrl: '${apiBaseUrl}',
  apiBackendUrl: '${apiBackendUrl}',
  socketUrl: '${socketUrl}',
  apiKeyGoogleMaps: '${apiKeyGoogleMaps}',
  mapsMapId: '${mapsMapId}'
};
`;

const prodEnv = `export const environment = {
  production: true,
  apiUrl: '${apiUrl}',
  apiBaseUrl: '${apiBaseUrl}',
  apiBackendUrl: '${apiBackendUrl}',
  socketUrl: '${socketUrl}',
  apiKeyGoogleMaps: '${apiKeyGoogleMaps}',
  mapsMapId: '${mapsMapId}'
};
`;

const devPath = path.join(environmentDir, 'environment.ts');
const prodPath = path.join(environmentDir, 'environment.prod.ts');

fs.writeFileSync(devPath, devEnv);
fs.writeFileSync(prodPath, prodEnv);

// Environment files generated: environment.ts (DEV) and environment.prod.ts (PROD)