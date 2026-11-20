import { projectConfig } from '../frontend/src/lib/project-config.js';

const headers = { apikey: projectConfig.supabaseKey };
let failed = false;
for (const [name, endpoint] of [
  ['Supabase Auth', '/auth/v1/settings'],
  ['Tabla profiles', '/rest/v1/profiles?select=id&limit=0'],
  ['Tabla fish', '/rest/v1/fish?select=id&limit=0'],
]) {
  try {
    const response = await fetch(`${projectConfig.supabaseUrl}${endpoint}`, { headers, signal: AbortSignal.timeout(12_000) });
    console.log(`${name}: HTTP ${response.status}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.log(`  ${error.code || ''} ${error.message || error.msg || 'Revisa la configuración del proyecto.'}`);
      failed = true;
    } else if (endpoint.endsWith('/settings')) {
      const data = await response.json();
      console.log(`  Registro habilitado: ${!data.disable_signup}. Confirmación de correo: ${!data.mailer_autoconfirm}.`);
    }
  } catch (error) {
    console.log(`${name}: no se pudo conectar (${error.cause?.code || error.name}).`);
    failed = true;
  }
}
process.exitCode = failed ? 1 : 0;
