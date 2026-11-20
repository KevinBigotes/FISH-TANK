import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function readServerConfig(env, defaultPort) {
  const port = Number(env.PORT || defaultPort);
  const trustProxyHops = Number(env.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT no válido.');
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) throw new Error('TRUST_PROXY_HOPS no válido.');
  const corsOrigins = (env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',').map((value) => value.trim()).filter(Boolean);
  if (corsOrigins.some((origin) => new URL(origin).origin !== origin)) {
    throw new Error('CORS_ORIGINS debe contener orígenes exactos, sin ruta ni barra final.');
  }
  return { port, host: env.HOST || '127.0.0.1', corsOrigins, trustProxyHops };
}

export function corsOptions(origins) {
  return {
    origin(origin, callback) {
      callback(!origin || origins.includes(origin) ? null
        : new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'Origen no permitido.'), true);
    },
    methods: ['GET', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}

export function createBaseApp({ name, phase, corsOrigins = [], trustProxyHops = 0 }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxyHops);
  app.use(helmet());
  app.use(cors(corsOptions(corsOrigins)));
  app.use(rateLimit({
    windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false,
    skip: (req) => req.path === '/health',
    message: { error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Intenta en un minuto.' } },
  }));
  app.use(express.json({ limit: '32kb' }));
  app.get('/health', (_req, res) => res.json({
    service: name, status: phase === 1 ? 'ok' : 'scaffold', phase,
  }));
  return app;
}

export function finishApp(app) {
  app.use((_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'Ruta no encontrada.')));
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'JSON no válido.' } });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: { code: 'BODY_TOO_LARGE', message: 'Solicitud demasiado grande.' } });
    }
    const known = error instanceof HttpError;
    if (!known) console.error('Error interno del servicio:', error.name);
    res.status(known ? error.status : 500).json({ error: {
      code: known ? error.code : 'INTERNAL_ERROR',
      message: known ? error.message : 'No se pudo completar la solicitud.',
    } });
  });
  return app;
}

export function createPlaceholderApp({ name, phase, ...config }) {
  const app = createBaseApp({ name, phase, ...config });
  app.use('/api/v1', (_req, res) => res.status(501).json({ error: {
    code: 'PHASE_NOT_IMPLEMENTED', message: `Disponible en Fase ${phase}.`,
  } }));
  return finishApp(app);
}

export function startService(appOrServer, config, name, onClose) {
  const server = typeof appOrServer === 'function' ? createServer(appOrServer) : appOrServer;
  server.listen(config.port, config.host, () => console.log(`${name}: http://${config.host}:${config.port}`));
  const shutdown = () => {
    onClose?.();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  return server;
}
