import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

export const supabase = config.errors.length ? null : createClient(config.supabaseUrl, config.supabaseKey, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function emailRedirectUrl() {
  // Se vuelve al index estático. ?code=... usa la query, dejando libre #/ruta.
  return new URL('./', window.location.href).href;
}

export async function bootstrapAuth() {
  if (!supabase) return { session: null, callbackError: null };
  const url = new URL(window.location.href);
  const isCallback = url.searchParams.has('code') || url.searchParams.has('error') || url.hash.includes('error_description=');
  let session = null;
  let callbackError = null;
  try {
    // Esperar la inicialización automática antes de montar HashRouter.
    const initialized = await supabase.auth.initialize();
    if (initialized.error) throw initialized.error;
    const result = await supabase.auth.getSession();
    if (result.error) throw result.error;
    session = result.data.session;
  } catch {
    callbackError = isCallback
      ? 'No pudimos abrir la sesión desde el enlace. Si tu correo ya está confirmado, inicia sesión con tu contraseña. Abre los enlaces nuevos en el navegador donde te registraste.'
      : 'No se pudo recuperar tu sesión. Intenta iniciar sesión de nuevo.';
  }
  if (isCallback) {
    // El SDK realiza el canje PKCE. No se canjea dos veces ni se guarda el código.
    const cleaned = new URL(window.location.href);
    ['code', 'error', 'error_code', 'error_description', 'sb_flow_id'].forEach((key) => cleaned.searchParams.delete(key));
    cleaned.hash = session ? '/pecera' : '/login';
    window.history.replaceState(null, '', cleaned);
  }
  return { session, callbackError };
}
