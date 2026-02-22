import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

// Verificar dependencias críticas del servidor
const requiredPackages = ['express', 'helmet', 'express-rate-limit', 'compression', 'mongoose', 'bcryptjs'];
const missingPackages = [];

for (const pkg of requiredPackages) {
  const packagePath = join(process.cwd(), 'node_modules', pkg);
  if (!existsSync(packagePath)) {
    missingPackages.push(pkg);
  }
}

// Si faltan paquetes, instalar todas las dependencias
if (missingPackages.length > 0) {
  console.log(`Faltan paquetes: ${missingPackages.join(', ')}. Instalando dependencias...`);
  try {
    execSync('npm install', { stdio: 'inherit', cwd: process.cwd() });
    console.log('Dependencias instaladas correctamente');
  } catch (error) {
    console.error('Error instalando dependencias:', error);
    process.exit(1);
  }
}

// Importar y ejecutar el servidor
import('./server.js');

