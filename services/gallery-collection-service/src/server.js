import { readServerConfig, startService } from '@soaylemer/service-core';
import { createGalleryApp } from './app.js';

const config = readServerConfig(process.env, 3004);
startService(createGalleryApp(config), config, 'gallery-collection-service');
