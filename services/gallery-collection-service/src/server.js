import { readServerConfig, startService } from '@fish-tank/service-core';
import { createGalleryApp } from './app.js';
import { createSupabaseClients } from './supabase.js';

const config = readServerConfig(process.env, 3004);
startService(createGalleryApp({ ...config, ...createSupabaseClients(process.env) }), config, 'gallery-collection-service');
