import { readPublicConfig } from '../frontend/src/lib/config.js';

const { errors } = readPublicConfig(process.env);
if (errors.length) {
  console.error('No se puede publicar el frontend sin configuración válida:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('Configuración pública válida.');
