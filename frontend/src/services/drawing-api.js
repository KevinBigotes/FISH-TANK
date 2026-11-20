import { config } from '../lib/config.js';
import { supabase } from '../lib/supabase.js';

export async function drawingCapabilities(signal) {
  if (!config.drawingServiceUrl) return { ready: false, reason: 'El servicio de dibujos todavía no está conectado a esta versión de la exposición.' };
  try {
    const response = await fetch(`${config.drawingServiceUrl}/api/v1/capabilities`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    });
    const result = await response.json();
    if (!response.ok || typeof result.data?.ready !== 'boolean') throw new Error();
    return { ...result.data, reason: result.data.ready ? '' : 'El servicio necesita completar su configuración de almacenamiento o moderación.' };
  } catch (error) {
    if (signal.aborted) throw error;
    return { ready: false, reason: 'No pudimos conectar al servicio de dibujos. Revisa que esté encendido y reintenta.' };
  }
}

export async function publishFish({ name, png, submissionId }) {
  if (!config.drawingServiceUrl) throw new Error('El servicio de dibujos aún no está conectado.');
  // getSession renueva el token cuando hace falta; nunca aceptar creator_id del formulario.
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) throw new Error('Inicia sesión de nuevo antes de publicar.');
  const form = new FormData();
  form.set('name', name.trim());
  form.set('submission_id', submissionId);
  form.set('image', png, 'fish.png');
  let response;
  try {
    response = await fetch(`${config.drawingServiceUrl}/api/v1/drawings`, {
      method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: form,
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    throw new Error('Se interrumpió el envío. Tu dibujo sigue aquí: reintenta sin modificarlo para recuperar el mismo pez.');
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.data?.fish) throw new Error(result?.error?.message || 'No se pudo publicar el pez. Intenta de nuevo.');
  return result.data;
}

export async function downloadFish(fish) {
  const response = await fetch(fish.image_url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error('No se pudo descargar el PNG. Inténtalo de nuevo.');
  const blob = await response.blob();
  if (!blob.type.includes('image/png')) throw new Error('El archivo recibido no es un PNG.');
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `${fish.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 60) || 'mi-pez'}.png`;
  document.body.appendChild(anchor);
  anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}
