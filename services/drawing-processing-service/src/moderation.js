import sharp from 'sharp';
import { HttpError } from '@fish-tank/service-core';

const unavailable = () => new HttpError(503, 'MODERATION_UNAVAILABLE', 'No pudimos revisar el dibujo. No se ha publicado; inténtalo más tarde.');

export function evaluateModeration(result) {
  const scores = [
    [result?.nudity?.sexual_activity, 0.2],
    [result?.nudity?.sexual_display, 0.2],
    [result?.nudity?.erotica, 0.4],
    [result?.nudity?.very_suggestive, 0.7],
    [result?.offensive?.prob, 0.5],
    [result?.gore?.prob, 0.5],
  ];
  // Una respuesta incompleta nunca equivale a una aprobación.
  if (result?.status !== 'success' || scores.some(([score]) => typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1)) {
    throw unavailable();
  }
  return { approved: !scores.some(([score, threshold]) => score >= threshold), provider: 'sightengine', simulated: false };
}

export function createModerator(config, fetchImpl = fetch) {
  const ready = config.mockExternalApis || Boolean(config.sightengineUser && config.sightengineSecret);
  return {
    ready,
    simulated: config.mockExternalApis,
    async check(png) {
      if (config.mockExternalApis) return { approved: true, provider: 'mock', simulated: true };
      if (!ready) throw unavailable();
      try {
        // El proveedor ve el dibujo sobre blanco; el sprite guardado conserva transparencia.
        const preview = await sharp(png).flatten({ background: '#ffffff' }).png().toBuffer();
        const form = new FormData();
        form.set('media', new Blob([preview], { type: 'image/png' }), 'drawing.png');
        form.set('models', 'nudity-2.1,offensive,gore-2.0');
        form.set('api_user', config.sightengineUser);
        form.set('api_secret', config.sightengineSecret);
        const response = await fetchImpl('https://api.sightengine.com/1.0/check.json', {
          method: 'POST', body: form, signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw unavailable();
        return evaluateModeration(await response.json());
      } catch { throw unavailable(); }
    },
  };
}
