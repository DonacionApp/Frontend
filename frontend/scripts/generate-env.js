const fs = require('fs');
const path = require('path');

if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
    console.log(' Variables de entorno cargadas desde .env');
  } catch (error) {
    console.log(' No se pudo cargar dotenv, usando process.env');
  }
}

const production = process.env.PRODUCTION ||'false';
const apiUrl= process.env.API_URL_DEV || 'http://localhost:5000';
const apiBaseUrl= process.env.API_BASE_URL_DEV || 'http://localhost:5000/auth';
const apiBackendUrl= process.env.API_BACKEND_URL_DEV || 'http://localhost:5000';
const socketUrl= process.env.SOCKET_URL_DEV || 'http://localhost:5000';
const apiKeyGoogleMaps= process.env.API_KEY_GOOGLE_MAPS || 'tu api key';

console.log('🔧 Generando archivos de environment con las siguientes configuraciones:');
console.log(`- Producción: ${production}`);
console.log(`- API URL: ${apiUrl}`);
console.log(`- API Base URL: ${apiBaseUrl}`);
console.log(`- API Backend URL: ${apiBackendUrl}`);
console.log(`- Socket URL: ${socketUrl}`);
console.log(`- API Key Google Maps: ${apiKeyGoogleMaps}`);

const devEnv = `export const environment = {
  production: false,
  apiUrl: '${apiUrl}',
  apiBaseUrl: '${apiBaseUrl}',
  apiBackendUrl: '${apiBackendUrl}',
  socketUrl: '${socketUrl}',
  apiKeyGoogleMaps: '${apiKeyGoogleMaps}'
};
`;

const prodEnv = `export const environment = {
  production: true,
  apiUrl: '${apiUrl}',
  apiBaseUrl: '${apiBaseUrl}',
  apiBackendUrl: '${apiBackendUrl}',
  socketUrl: '${socketUrl}',
  apiKeyGoogleMaps: '${apiKeyGoogleMaps}'
};
`;

fs.writeFileSync(path.join(__dirname, '../src/environments/environment.ts'), devEnv);
fs.writeFileSync(path.join(__dirname, '../src/environments/environment.prod.ts'), prodEnv);

console.log('Archivos de environment generados correctamente.');