import { projectConfig } from './project-config.js';

export function readPublicConfig(env, defaults = projectConfig) {
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim() || defaults.supabaseUrl || '';
  const supabaseKey = (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY)?.trim() || defaults.supabaseKey || '';
  const authServiceUrl = env.VITE_AUTH_USER_SERVICE_URL?.trim().replace(/\/+$/, '') || '';
  const errors = [];
  for (const [name, value] of [['VITE_SUPABASE_URL', supabaseUrl], ['VITE_AUTH_USER_SERVICE_URL', authServiceUrl]]) {
    // Pages puede autenticar con Supabase sin un servicio Node desplegado todavía.
    if (name === 'VITE_AUTH_USER_SERVICE_URL' && !value) continue;
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || value.includes('TU-PROYECTO')) throw new Error();
      if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error();
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
  return { supabaseUrl, supabaseKey, authServiceUrl, errors };
}

export const config = readPublicConfig(import.meta.env || {});
