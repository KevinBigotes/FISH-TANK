import { readServerConfig, startService } from '@fish-tank/service-core';
import { createDrawingApp } from './app.js';
import { readDrawingConfig } from './config.js';
import { createModerator } from './moderation.js';
import { createAuthClient, createDrawingRepository } from './repository.js';
import { createEcosystemPublisher } from './ecosystem-publisher.js';

const config = readServerConfig(process.env, 3002);
const drawingConfig = readDrawingConfig(process.env);
const moderator = createModerator(drawingConfig);
const repository = createDrawingRepository(drawingConfig);
if (moderator.simulated) console.log('Moderación simulada activa. Storage y base de datos son reales.');
if (!repository || !moderator.ready) console.log('El servicio necesita configuración antes de permitir publicaciones.');
const notifier = createEcosystemPublisher({ url: process.env.AQUARIUM_ECOSYSTEM_SERVICE_URL, token: process.env.ECOSYSTEM_SERVICE_TOKEN });
startService(createDrawingApp({ ...config, repository, moderator, notifier, authClient: createAuthClient(drawingConfig) }), config, 'drawing-processing-service', () => notifier.close());
