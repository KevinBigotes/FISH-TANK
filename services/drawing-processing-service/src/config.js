export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_SIDE = 2048;
export const BUCKET = 'fish-sprites';

export function readDrawingConfig(env) {
  const supabaseUrl = env.SUPABASE_URL?.trim();
  const publicKey = (env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY)?.trim();
  const secretKey = (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!supabaseUrl || !publicKey || supabaseUrl.includes('TU-PROYECTO')) {
    throw new Error('Configura SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY en el servicio de dibujos.');
  }
  if (secretKey && !secretKey.startsWith('sb_secret_')) {
    let role;
    try { role = JSON.parse(Buffer.from(secretKey.split('.')[1], 'base64url').toString()).role; } catch { /* Validado abajo. */ }
    if (role !== 'service_role') throw new Error('SUPABASE_SECRET_KEY debe ser una clave secreta de servidor.');
  }
  if (env.MOCK_EXTERNAL_APIS && !['true', 'false'].includes(env.MOCK_EXTERNAL_APIS)) {
    throw new Error('MOCK_EXTERNAL_APIS debe ser true o false.');
  }
  return {
    supabaseUrl, publicKey, secretKey,
    mockExternalApis: env.MOCK_EXTERNAL_APIS === 'true',
    sightengineUser: env.SIGHTENGINE_API_USER?.trim(),
    sightengineSecret: env.SIGHTENGINE_API_SECRET?.trim(),
  };
}
