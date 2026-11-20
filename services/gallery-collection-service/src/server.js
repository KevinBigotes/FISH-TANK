import { readServerConfig, startService } from '@fish-tank/service-core';
import { createGalleryApp } from './app.js';

const config = readServerConfig(process.env, 3004);
startService(createGalleryApp(config), config, 'gallery-collection-service');
