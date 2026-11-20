import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { corsOptions, createPlaceholderApp } from '@soaylemer/service-core';

export function createAquariumServer(config = {}) {
  const origins = config.corsOrigins || [];
  const app = createPlaceholderApp({ ...config, name: 'aquarium-ecosystem-service', phase: 3 });
  const server = createServer(app);
  const io = new Server(server, {
    cors: corsOptions(origins),
    maxHttpBufferSize: 16_384,
    allowRequest: (req, callback) => callback(null, !req.headers.origin || origins.includes(req.headers.origin)),
  });
  // Transporte instalado. Sin eventos, presencia, clima ni simulación hasta Fase 3.
  // La futura autenticación se implementará antes de habilitar conexiones.
  io.use((_socket, next) => {
    const error = new Error('La pecera en tiempo real estará disponible en Fase 3.');
    error.data = { code: 'PHASE_NOT_IMPLEMENTED' };
    next(error);
  });
  return { app, server, io };
}
