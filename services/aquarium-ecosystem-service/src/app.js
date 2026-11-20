import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { Server } from 'socket.io';
import { corsOptions, createBaseApp, finishApp } from '@fish-tank/service-core';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function authorized(candidate, secret) {
  if (!secret || typeof candidate !== 'string' || candidate.length > 256) return false;
  const a = Buffer.from(candidate), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function createAquariumServer({ ecosystem, serviceToken = '', ...config }) {
  const origins = config.corsOrigins || [];
  const app = createBaseApp({ ...config, name: 'aquarium-ecosystem-service', phase: 3, status: 'ok' });
  app.get('/api/v1/aquarium', (_req, res) => res.set('Cache-Control', 'no-store').json({ data: ecosystem.snapshot() }));
  app.get('/api/v1/weather', (_req, res) => res.set('Cache-Control', 'no-store').json({ data: ecosystem.snapshot().weather }));
  finishApp(app);
  const server = createServer(app);
  const io = new Server(server, {
    cors: corsOptions(origins),
    maxHttpBufferSize: 4096,
    allowRequest: (req, callback) => callback(null, !req.headers.origin || origins.includes(req.headers.origin)),
  });
  // La exhibición solo lee datos públicos. Este namespace no acepta escrituras.
  io.on('connection', (socket) => socket.emit('aquarium:snapshot', ecosystem.snapshot()));
  const publishers = io.of('/publishers');
  publishers.use((socket, next) => {
    if (socket.handshake.headers.origin || !authorized(socket.handshake.auth?.token, serviceToken)) {
      const error = new Error('Servicio no autorizado.'); error.data = { code: 'UNAUTHORIZED' }; return next(error);
    }
    next();
  });
  publishers.on('connection', (socket) => {
    let windowStart = Date.now(), count = 0;
    socket.on('fish:published', async (payload, ack) => {
      if (typeof ack !== 'function') return;
      if (Date.now() - windowStart > 60_000) { windowStart = Date.now(); count = 0; }
      if (++count > 120) return ack({ ok: false, code: 'RATE_LIMITED' });
      if (!uuid.test(payload?.id || '') || Object.keys(payload).length !== 1) return ack({ ok: false, code: 'INVALID_INPUT' });
      try { ack({ ok: await ecosystem.publish(payload.id) }); }
      catch { ack({ ok: false, code: 'DATABASE_UNAVAILABLE' }); }
    });
  });
  const snapshot = (data) => io.emit('aquarium:snapshot', data);
  const fish = (data) => io.emit('fish:added', data);
  const weather = (data) => io.emit('weather:updated', data);
  ecosystem.events.on('snapshot', snapshot).on('fish', fish).on('weather', weather);
  function cleanup() { ecosystem.stop(); ecosystem.events.off('snapshot', snapshot).off('fish', fish).off('weather', weather); }
  server.on('close', cleanup);
  return { app, server, io, close: () => { cleanup(); io.close(); } };
}
