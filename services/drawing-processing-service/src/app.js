import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { createBaseApp, finishApp, HttpError } from '@fish-tank/service-core';
import { MAX_UPLOAD_BYTES } from './config.js';
import { publishDrawing } from './pipeline.js';

const payload = z.object({
  name: z.string().trim().min(1).max(80),
  submission_id: z.uuid(),
}).strict();

export function createDrawingApp({ authClient, repository, moderator, notifier, ...config } = {}) {
  const ready = Boolean(repository && moderator?.ready && authClient);
  const app = createBaseApp({ ...config, name: 'drawing-processing-service', phase: 2, status: ready ? 'ok' : 'configuration_required' });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 2, parts: 3, fieldSize: 512, fieldNameSize: 40 },
    fileFilter: (_req, file, callback) => callback(file.mimetype === 'image/png' ? null
      : new HttpError(415, 'PNG_REQUIRED', 'Solo se aceptan imágenes PNG.'), true),
  }).single('image');
  const uploadLimit = rateLimit({
    windowMs: 60_000, limit: 10, keyGenerator: (req) => req.user.id,
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'UPLOAD_RATE_LIMITED', message: 'Has enviado varios dibujos. Espera un minuto antes de continuar.' } },
  });
  app.get('/api/v1/capabilities', (_req, res) => res.json({ data: {
    ready, maxUploadBytes: MAX_UPLOAD_BYTES, moderationSimulated: Boolean(moderator?.simulated),
  } }));

  async function requireUser(req, _res, next) {
    const token = req.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
    if (!token) throw new HttpError(401, 'UNAUTHORIZED', 'Inicia sesión para publicar tu pez.');
    if (!authClient) throw new HttpError(503, 'SERVICE_NOT_READY', 'El servicio de dibujos aún no está configurado.');
    let result;
    try { result = await authClient.auth.getUser(token); }
    catch { throw new HttpError(503, 'AUTH_UNAVAILABLE', 'No se pudo verificar tu sesión.'); }
    if (result.error?.status >= 500 || result.error?.name === 'AuthRetryableFetchError') throw new HttpError(503, 'AUTH_UNAVAILABLE', 'No se pudo verificar tu sesión.');
    if (result.error || !result.data?.user) throw new HttpError(401, 'UNAUTHORIZED', 'Tu sesión expiró. Inicia sesión otra vez.');
    req.user = result.data.user;
    next();
  }
  app.post('/api/v1/drawings', requireUser, uploadLimit, (req, res, next) => {
    if (!ready) return next(new HttpError(503, 'SERVICE_NOT_READY', 'Falta configurar el almacenamiento o la moderación del servicio de dibujos.'));
    upload(req, res, (error) => {
      if (error instanceof multer.MulterError) {
        return next(new HttpError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, error.code,
          error.code === 'LIMIT_FILE_SIZE' ? 'El dibujo supera los 5 MB.' : 'El envío debe incluir un PNG, nombre e identificador.'));
      }
      next(error);
    });
  }, async (req, res) => {
    const parsed = payload.safeParse(req.body);
    if (!parsed.success || !req.file) throw new HttpError(400, 'INVALID_INPUT', 'Escribe un nombre de 1 a 80 caracteres y adjunta tu dibujo.');
    const data = await publishDrawing({
      userId: req.user.id, submissionId: parsed.data.submission_id, name: parsed.data.name,
      image: req.file.buffer, repository, moderator,
    });
    // La caída de la exhibición no revierte un pez ya guardado. La cola reintenta el aviso.
    notifier?.publish(data.fish.id);
    res.set('Cache-Control', 'no-store').status(data.replayed ? 200 : 201).json({ data });
  });
  return finishApp(app);
}
