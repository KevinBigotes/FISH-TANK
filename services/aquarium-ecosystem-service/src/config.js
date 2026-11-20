export function readAquariumConfig(env) {
  const supabaseUrl = env.SUPABASE_URL?.trim();
  const publicKey = (env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY)?.trim();
  let role;
  try { role = JSON.parse(Buffer.from(publicKey.split('.')[1], 'base64url')).role; } catch { /* Clave publishable. */ }
  if (!supabaseUrl || !publicKey || publicKey.startsWith('sb_secret_') || role === 'service_role') {
    throw new Error('La pecera necesita SUPABASE_URL y una clave publishable/anon de solo lectura.');
  }
  const number = (name, fallback, min, max) => {
    const value = Number(env[name] || fallback);
    if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} no válido.`);
    return value;
  };
  const timezone = env.WEATHER_TIMEZONE || 'America/Cancun';
  new Intl.DateTimeFormat('es-MX', { timeZone: timezone });
  const serviceToken = env.ECOSYSTEM_SERVICE_TOKEN?.trim() || '';
  if (serviceToken && serviceToken.length < 32) throw new Error('ECOSYSTEM_SERVICE_TOKEN requiere al menos 32 caracteres.');
  return {
    supabaseUrl, publicKey, serviceToken,
    maxFish: Math.floor(number('AQUARIUM_MAX_FISH', 200, 1, 1000)),
    syncMs: number('AQUARIUM_SYNC_SECONDS', 30, 5, 600) * 1000,
    weather: {
      apiKey: env.OPENWEATHER_API_KEY?.trim() || '',
      lat: number('WEATHER_LAT', 20.5, -90, 90), lon: number('WEATHER_LON', -86.95, -180, 180),
      location: env.WEATHER_LOCATION || 'Cozumel, México', timezone,
      pollMs: number('WEATHER_POLL_SECONDS', 600, 600, 3600) * 1000,
    },
  };
}
