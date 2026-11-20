import { createClient } from '@supabase/supabase-js';
import { HttpError } from '@fish-tank/service-core';
import { BUCKET, MAX_UPLOAD_BYTES } from './config.js';

const options = {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal || AbortSignal.timeout(20_000) }) },
};
export const createAuthClient = (config) => createClient(config.supabaseUrl, config.publicKey, options);

export function createDrawingRepository(config, adminClient) {
  if (!config.secretKey) return null;
  // Exclusivo del backend. Ningún JWT de usuario se instala en este cliente.
  const admin = adminClient || createClient(config.supabaseUrl, config.secretKey, options);
  const bucket = admin.storage.from(BUCKET);
  let bucketReady = false;
  const fields = 'id,name,image_url,creator_id,created_at';
  return {
    async ensureBucket() {
      if (bucketReady) return;
      let { data, error } = await admin.storage.getBucket(BUCKET);
      if (error && String(error.statusCode || error.status) !== '404' && error.code !== 'NoSuchBucket') {
        throw new HttpError(503, 'STORAGE_UNAVAILABLE', 'No se pudo acceder al almacenamiento.');
      }
      if (!data) {
        const created = await admin.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_UPLOAD_BYTES, allowedMimeTypes: ['image/png'] });
        if (created.error && !['409', '400'].includes(String(created.error.statusCode || created.error.status))) {
          throw new HttpError(503, 'STORAGE_UNAVAILABLE', 'No se pudo preparar el almacenamiento.');
        }
        ({ data, error } = await admin.storage.getBucket(BUCKET));
      }
      if (error || !data?.public) throw new HttpError(503, 'BUCKET_NOT_READY', 'El bucket fish-sprites debe existir y ser público.');
      bucketReady = true;
    },
    async getCreator(id) {
      const { data, error } = await admin.from('profiles').select('id,username,avatar_color').eq('id', id).maybeSingle();
      if (error) throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'No se pudo consultar al creador.');
      if (!data) throw new HttpError(409, 'PROFILE_REQUIRED', 'Tu cuenta necesita un perfil antes de publicar. Revisa el registro en Supabase.');
      return data;
    },
    async findFish(id, creatorId) {
      const { data, error } = await admin.from('fish').select(fields).eq('id', id).eq('creator_id', creatorId).maybeSingle();
      if (error) throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'No se pudo comprobar el estado del envío. Reintenta sin modificar el dibujo.');
      return data;
    },
    async upload(path, png) {
      await this.ensureBucket();
      const { error } = await bucket.upload(path, png, { contentType: 'image/png', cacheControl: '31536000', upsert: false });
      if (error) {
        if (String(error.statusCode || error.status) === '409' || /already exists|duplicate/i.test(error.message)) {
          throw new HttpError(409, 'SUBMISSION_PENDING', 'Este envío ya está en proceso. Espera unos segundos y vuelve a intentarlo.');
        }
        throw new HttpError(503, 'UPLOAD_FAILED', 'No pudimos guardar el PNG. Tu dibujo sigue en el lienzo.');
      }
      return bucket.getPublicUrl(path).data.publicUrl;
    },
    async insertFish(fish) {
      const { data, error } = await admin.from('fish').insert(fish).select(fields).single();
      if (error) throw new HttpError(503, 'SAVE_FAILED', 'No pudimos guardar el pez. Reintenta sin modificar el dibujo.');
      return data;
    },
    async removeSprite(path) {
      const { error } = await bucket.remove([path]);
      if (error) throw new Error('No se pudo limpiar el sprite sin registro.');
    },
  };
}
