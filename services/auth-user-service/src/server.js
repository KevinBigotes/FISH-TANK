import { readServerConfig, startService } from '@fish-tank/service-core';
import { createAuthApp } from './app.js';
import { createSupabaseClients } from './supabase.js';

const config = readServerConfig(process.env, 3001);
const app = createAuthApp({ ...config, ...createSupabaseClients(process.env) });
startService(app, config, 'auth-user-service');
