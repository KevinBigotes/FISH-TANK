import { createClient } from '@supabase/supabase-js';

export function createSupabaseClients(env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !key || url.includes('TU-PROYECTO') || key.includes('REEMPLAZAR')) {
    throw new Error('Configura SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY en gallery-collection-service/.env.');
  }
  const legacyRole = key.startsWith('eyJ')
    ? JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role : null;
  if (key.startsWith('sb_secret_') || legacyRole === 'service_role') {
    throw new Error('Este servicio requiere una clave publishable/anon para respetar RLS.');
  }
  const client = (token) => createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: {
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      fetch: (input, init) => fetch(input, { ...init, signal: init?.signal || AbortSignal.timeout(10_000) }),
    },
  });
  return { publicClient: client(), forToken: client };
}
