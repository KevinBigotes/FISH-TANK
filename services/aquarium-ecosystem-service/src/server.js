import { readServerConfig, startService } from '@fish-tank/service-core';
import { createAquariumServer } from './app.js';

const config = readServerConfig(process.env, 3003);
const { server, io } = createAquariumServer(config);
startService(server, config, 'aquarium-ecosystem-service', () => io.close());
