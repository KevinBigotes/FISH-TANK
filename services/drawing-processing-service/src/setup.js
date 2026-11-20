import { readDrawingConfig } from './config.js';
import { createDrawingRepository } from './repository.js';

const repository = createDrawingRepository(readDrawingConfig(process.env));
if (!repository) throw new Error('Configura SUPABASE_SECRET_KEY en el .env del servicio de dibujos.');
await repository.ensureBucket();
console.log('Bucket fish-sprites preparado: público, PNG, máximo 5 MB.');
