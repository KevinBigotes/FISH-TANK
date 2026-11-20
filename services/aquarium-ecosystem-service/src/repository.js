import { createClient } from '@supabase/supabase-js';
export function createAquariumRepository(config) {
  const client = createClient(config.supabaseUrl, config.publicKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(15_000) }) },
  });
  const fields = 'id,name,image_url,creator_id,created_at';
  return {
    async latest(limit) {
      const { data, error } = await client.from('fish').select(fields).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit);
      if (error) throw new Error('No se pudo sincronizar la pecera.');
      return data.reverse();
    },
    async byId(id) {
      const { data, error } = await client.from('fish').select(fields).eq('id', id).maybeSingle();
      if (error) throw new Error('No se pudo consultar el pez publicado.');
      return data;
    },
  };
}
