import { readServerConfig, startService } from '@soaylemer/service-core';
import { createDrawingApp } from './app.js';

const config = readServerConfig(process.env, 3002);
startService(createDrawingApp(config), config, 'drawing-processing-service');
