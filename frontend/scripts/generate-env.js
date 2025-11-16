const fs = require('fs');
const path = require('path');

// Get configuration from environment variables or use defaults
const API_URL = process.env['API_URL'] || 'http://localhost:5000';
const SOCKET_URL = process.env['SOCKET_URL'] || 'http://localhost:5000';
const GOOGLE_MAPS_API_KEY = process.env['GOOGLE_MAPS_API_KEY'] || 'AIzaSyC55ytCYBbBKrqbm10kHQBmwXNyYoxCogE';
const GOOGLE_MAPS_MAP_ID = process.env['GOOGLE_MAPS_MAP_ID'] || 'a576f9d07a3eb6be92fc5da3';

// Create environment configuration with all required properties
const createEnvConfig = (production = false) => `export const environment = {
  production: ${production},
  apiUrl: '${API_URL}',
  apiBaseUrl: '${API_URL}/auth',
  apiBackendUrl: '${API_URL}',
  socketUrl: '${SOCKET_URL}',
  apiKeyGoogleMaps: '${GOOGLE_MAPS_API_KEY}',
  mapsMapId: '${GOOGLE_MAPS_MAP_ID}'
};
`;

const envPath = path.join(__dirname, '../src/environments/environment.ts');
const envProdPath = path.join(__dirname, '../src/environments/environment.prod.ts');

// Ensure environments directory exists
const envDir = path.dirname(envPath);
if (!fs.existsSync(envDir)) {
  fs.mkdirSync(envDir, { recursive: true });
}

// Write environment files if they don't exist
if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, createEnvConfig(false));
  console.log('Generated environment.ts');
}

if (!fs.existsSync(envProdPath)) {
  fs.writeFileSync(envProdPath, createEnvConfig(true));
  console.log('Generated environment.prod.ts');
}
