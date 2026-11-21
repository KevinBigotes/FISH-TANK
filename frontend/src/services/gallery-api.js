import { config } from '../lib/config.js';
import { supabase } from '../lib/supabase.js';
async function request(path, { privateRequest = false, method = 'GET', signal } = {}) {
  if (!config.galleryServiceUrl) throw new Error('El servicio de colecciones aún no está conectado a esta versión.');
  let token;
  if (privateRequest) {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw new Error('Inicia sesión para gestionar tu pecera.');
    token = data.session.access_token;
  }
  let response;
  try { response = await fetch(`${config.galleryServiceUrl}/api${path}`, { method, headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) }); }
  catch (error) { if (signal?.aborted) throw error; throw new Error('No se pudo conectar con tu pecera. Reintenta cuando vuelva la conexión.'); }
  if (response.status === 204) return;
  const json = await response.json();
  if (!response.ok) throw new Error(json.error?.message || 'No se pudo completar la operación.');
  return json;
}
export const galleryApi = {
  creator: (id, offset = 0, signal) => request(`/creators/${id}/fish?offset=${offset}`, { signal }),
  personal: (signal) => request('/personal-aquarium', { privateRequest: true, signal }).then((r) => r.data),
  status: (id, signal) => request(`/personal-aquarium/${id}`, { privateRequest: true, signal }).then((r) => r.data),
  save: (id) => request(`/personal-aquarium/${id}`, { privateRequest: true, method: 'POST' }),
  remove: (id) => request(`/personal-aquarium/${id}`, { privateRequest: true, method: 'DELETE' }),
};
