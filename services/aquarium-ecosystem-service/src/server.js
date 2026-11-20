import { readServerConfig, startService } from '@fish-tank/service-core';
import { createAquariumServer } from './app.js';
import { readAquariumConfig } from './config.js';
import { createAquariumRepository } from './repository.js';
import { createWeatherService } from './weather.js';
import { createEcosystem } from './ecosystem.js';

const config = readServerConfig(process.env, 3003);
const aquarium = readAquariumConfig(process.env);
const ecosystem = createEcosystem({ repository: createAquariumRepository(aquarium), weather: createWeatherService(aquarium.weather), maxFish: aquarium.maxFish, syncMs: aquarium.syncMs, weatherPollMs: aquarium.weather.pollMs });
const { server, close } = createAquariumServer({ ...config, serviceToken: aquarium.serviceToken, ecosystem });
if (!aquarium.serviceToken) console.log('Publicación entre servicios pendiente de configurar; sincronización periódica activa.');
if (!aquarium.weather.apiKey) console.log('Clima pendiente de configurar: OPENWEATHER_API_KEY.');
ecosystem.start();
startService(server, config, 'aquarium-ecosystem-service', close);
