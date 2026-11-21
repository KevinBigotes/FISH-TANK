import { config } from '../lib/config.js';

async function request(path, { token, method = 'GET', body, signal } = {}) {
  if (!config.authServiceUrl) {
    throw new Error('Tu sesión está activa. La consulta y edición del perfil estarán disponibles cuando se conecte el servicio de usuarios.');
  }
  let response;
  try {
    response = await fetch(`${config.authServiceUrl}/api/v1${path}`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12_000)]) : AbortSignal.timeout(12_000),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('No se pudo conectar al servicio de usuarios. Comprueba que esté encendido.');
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw new Error(result?.error?.message || 'El servicio devolvió una respuesta no válida.');
  return result.data;
}

export const authUserApi = {
  getCreator: (id, signal) => request(`/creators/${id}`, { signal }),
  getProfile: (token, signal) => request('/me', { token, signal }),
  updateProfile: (token, body) => request('/me', { token, body, method: 'PATCH' }),
  getSession: (token, signal) => request('/session', { token, signal }),
  getCreators: (query = '', signal) => request(`/creators?q=${encodeURIComponent(query)}`, { signal }),
};
