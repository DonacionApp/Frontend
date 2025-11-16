const fs = require('fs');
const path = require('path');

// Create a simple environment configuration
const envConfig = `
export const environment = {
  production: false,
  apiBackendUrl: 'http://localhost:3000/api'
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
  fs.writeFileSync(envPath, envConfig);
  console.log('Generated environment.ts');
}

if (!fs.existsSync(envProdPath)) {
  const prodConfig = envConfig.replace('production: false', 'production: true');
  fs.writeFileSync(envProdPath, prodConfig);
  console.log('Generated environment.prod.ts');
}
