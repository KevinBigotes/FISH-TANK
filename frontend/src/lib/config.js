import { projectConfig } from './project-config.js';
import { isPrivateHost } from './network.js';

export function readPublicConfig(env, defaults = projectConfig, hostname = globalThis.location?.hostname || 'localhost') {
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim() || defaults.supabaseUrl || '';
  const supabaseKey = (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY)?.trim() || defaults.supabaseKey || '';
  const lan = env.DEV === true && env.VITE_LAN_MODE === 'true';
  const serviceUrl = (key, port) => lan ? `http://${hostname}:${port}` : env[key]?.trim().replace(/\/+$/, '') || '';
  const authServiceUrl = serviceUrl('VITE_AUTH_USER_SERVICE_URL', 3001);
  const drawingServiceUrl = serviceUrl('VITE_DRAWING_PROCESSING_SERVICE_URL', 3002);
  const aquariumServiceUrl = serviceUrl('VITE_AQUARIUM_ECOSYSTEM_SERVICE_URL', 3003);
  const galleryServiceUrl = serviceUrl('VITE_GALLERY_COLLECTION_SERVICE_URL', 3004);
  const errors = [];
  for (const [name, value] of [['VITE_SUPABASE_URL', supabaseUrl], ['VITE_AUTH_USER_SERVICE_URL', authServiceUrl], ['VITE_DRAWING_PROCESSING_SERVICE_URL', drawingServiceUrl], ['VITE_AQUARIUM_ECOSYSTEM_SERVICE_URL', aquariumServiceUrl]]) {
    // Pages puede autenticar con Supabase sin un servicio Node desplegado todavía.
    if (name !== 'VITE_SUPABASE_URL' && !value) continue;
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || value.includes('TU-PROYECTO')) throw new Error();
      if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && !(lan && name !== 'VITE_SUPABASE_URL' && isPrivateHost(url.hostname))) throw new Error();
    } catch { errors.push(`Configura ${name} con una URL válida (HTTPS en producción).`); }
  }
  if (!supabaseKey || supabaseKey.includes('REEMPLAZAR')) {
    errors.push('Configura VITE_SUPABASE_PUBLISHABLE_KEY con la clave pública de tu proyecto.');
  }
  let role;
  try {
    if (supabaseKey.startsWith('eyJ')) role = JSON.parse(atob(supabaseKey.split('.')[1].replaceAll('-', '+').replaceAll('_', '/'))).role;
  } catch { errors.push('La clave anon no es válida.'); }
  if (supabaseKey.startsWith('sb_secret_') || role === 'service_role') {
    errors.push('Usa una clave publishable o anon. Las claves secret y service_role no pertenecen al frontend.');
  }
  if (galleryServiceUrl) {
    try { const url = new URL(galleryServiceUrl); if (url.username || url.password || url.search || url.hash || !['https:', 'http:'].includes(url.protocol) || (url.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(url.hostname) && !(lan && isPrivateHost(url.hostname)))) throw new Error(); }
    catch { errors.push('Configura VITE_GALLERY_COLLECTION_SERVICE_URL con HTTPS en producción.'); }
  }
  return { supabaseUrl, supabaseKey, authServiceUrl, drawingServiceUrl, aquariumServiceUrl, galleryServiceUrl, errors };
}

export const config = readPublicConfig(import.meta.env || {});
