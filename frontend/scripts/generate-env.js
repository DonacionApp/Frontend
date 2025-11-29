const fs = require('fs');
const path = require('path');

// Load .env if present so that local development can use it
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Get configuration from environment variables (possibly loaded from .env) or use defaults
const API_URL = process.env['API_URL'] || 'http://localhost:8080';
const SOCKET_URL = process.env['SOCKET_URL'] || 'http://localhost:8080';
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

// Always write environment files to ensure they're up to date
fs.writeFileSync(envPath, createEnvConfig(false));
console.log('Generated environment.ts');

fs.writeFileSync(envProdPath, createEnvConfig(true));
console.log('Generated environment.prod.ts');

// Helpful log for debugging where values came from
const envFile = fs.existsSync(path.join(__dirname, '../.env')) ? '.env' : 'process environment';
console.log(`Env values loaded from: ${envFile}`);

// Warn if defaults are used for key values (helps catch missing CI variables)
const defaultsUsed = [];
if (!process.env['API_URL']) defaultsUsed.push('API_URL');
if (!process.env['GOOGLE_MAPS_API_KEY']) defaultsUsed.push('GOOGLE_MAPS_API_KEY');
if (defaultsUsed.length > 0) {
  console.warn(`Warning: using default values for: ${defaultsUsed.join(', ')}. Set these in your CI or in .env to avoid defaults.`);
}
