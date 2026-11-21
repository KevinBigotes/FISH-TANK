import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import request from 'supertest';
import { io } from 'socket.io-client';
import { createAquariumServer } from '../services/aquarium-ecosystem-service/src/app.js';
import { createEcosystem } from '../services/aquarium-ecosystem-service/src/ecosystem.js';
import { createWeatherService } from '../services/aquarium-ecosystem-service/src/weather.js';
import { readAquariumConfig } from '../services/aquarium-ecosystem-service/src/config.js';
import { createEcosystemPublisher } from '../services/drawing-processing-service/src/ecosystem-publisher.js';
import { createDrawingApp } from '../services/drawing-processing-service/src/app.js';
import { advanceSwimmer, createSwimmer, drawingJoinUrl, environmentFor, mergeFish } from '../frontend/src/aquarium/model.js';
import { readPublicConfig } from '../frontend/src/lib/config.js';
import { submissionUuid } from '../frontend/src/lib/network.js';

const sharp = createRequire(new URL('../services/drawing-processing-service/package.json', import.meta.url))('sharp');
const id = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const token = 'a'.repeat(64);
const fish = { id, name: 'Burbuja', creator_id: userId, image_url: 'https://example.com/fish.png', created_at: '2026-11-20T00:00:00Z' };
const weatherConfig = { apiKey: 'test-key', lat: 20.5, lon: -86.95, location: 'Cozumel, México', timezone: 'America/Cancun', pollMs: 600_000 };
const emptyWeather = () => createWeatherService({ ...weatherConfig, apiKey: '' });
function once(socket, event, label = event) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No llegó ${label}; conectado=${socket.connected}`)), 4000);
    socket.once(event, (data) => { clearTimeout(timer); resolve(data); });
  });
}
async function setup(t, rows = new Map()) {
  const repository = { latest: async () => [...rows.values()], byId: async (id) => rows.get(id) };
  const ecosystem = createEcosystem({ repository, weather: emptyWeather() });
  await ecosystem.refresh();
  const service = createAquariumServer({ ecosystem, serviceToken: token, corsOrigins: ['http://localhost:5173'] });
  await new Promise((resolve) => service.server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => service.io.close(resolve)));
  return { ...service, ecosystem, repository, rows, url: `http://127.0.0.1:${service.server.address().port}` };
}
function client(t, url, options = {}) {
  const socket = io(url, { transports: ['websocket'], reconnection: false, autoConnect: false, ...options });
  t.after(() => socket.close()); return socket;
}

test('publicar por HTTP avisa por Socket.io solo después de persistir; un reintento no duplica peces', { timeout: 10_000 }, async (t) => {
  const service = await setup(t);
  const viewer = client(t, service.url);
  const initial = once(viewer, 'aquarium:snapshot'); viewer.connect();
  assert.equal((await initial).fish.length, 0);
  const publisher = createEcosystemPublisher({ url: service.url, token }); t.after(() => publisher.close());
  const repository = {
    getCreator: async () => ({ id: userId, username: 'alice' }), findFish: async (id) => service.rows.get(id),
    upload: async () => fish.image_url, insertFish: async (data) => { const saved = { ...data, created_at: fish.created_at }; service.rows.set(saved.id, saved); return saved; },
  };
  const app = createDrawingApp({ repository, notifier: publisher, authClient: { auth: { getUser: async () => ({ data: { user: { id: userId } } }) } }, moderator: { ready: true, simulated: true, check: async () => ({ approved: true, simulated: true }) } });
  const png = await sharp({ create: { width: 20, height: 10, channels: 4, background: '#ff6b6b' } }).png().toBuffer();
  let broadcasts = 0; viewer.on('fish:added', () => broadcasts++);
  const added = once(viewer, 'fish:added');
  const send = () => request(app).post('/api/v1/drawings').set('Authorization', 'Bearer test').field('name', 'Burbuja').field('submission_id', id).attach('image', png, { filename: 'fish.png', contentType: 'image/png' });
  await send().expect(201);
  assert.equal((await added).fish.creator_id, userId);
  assert.equal(service.rows.size, 1);
  await send().expect(200);
  assert.equal(await service.ecosystem.publish(id), true);
  assert.equal(broadcasts, 1);
  viewer.disconnect();
  const restored = once(viewer, 'aquarium:snapshot', 'snapshot tras reconexión'); viewer.connect();
  assert.deepEqual((await restored).fish.map((f) => f.id), [id]);
});

test('solo el servicio autenticado puede anunciar UUID existentes; no acepta datos de peces inyectados', { timeout: 10_000 }, async (t) => {
  const service = await setup(t, new Map([[id, fish]]));
  const impostor = client(t, service.url + '/publishers', { auth: { token: 'wrong' } });
  const denied = once(impostor, 'connect_error'); impostor.connect(); assert.equal((await denied).data.code, 'UNAUTHORIZED');
  const browserPublisher = client(t, service.url + '/publishers', { auth: { token }, extraHeaders: { Origin: 'http://localhost:5173' } });
  const browserDenied = once(browserPublisher, 'connect_error'); browserPublisher.connect(); assert.equal((await browserDenied).data.code, 'UNAUTHORIZED');
  const trusted = client(t, service.url + '/publishers', { auth: { token } }); const connected = once(trusted, 'connect'); trusted.connect(); await connected;
  assert.equal((await trusted.timeout(2000).emitWithAck('fish:published', { id, image_url: 'https://attacker.invalid' })).code, 'INVALID_INPUT');
  assert.equal((await trusted.timeout(2000).emitWithAck('fish:published', { id: userId })).ok, false);
  assert.equal((await trusted.timeout(2000).emitWithAck('fish:published', { id })).ok, true);
  await request(service.app).get('/api/v1/aquarium').expect(200);
  await request(service.app).post('/api/v1/fish').send(fish).expect(404);
  await request(service.app).get('/api/v1/weather').set('Origin', 'https://attacker.invalid').expect(403);
});

test('la reconciliación conserva altas concurrentes, recupera avisos perdidos y conserva datos si Supabase cae', async () => {
  let release, fail = false;
  const repository = { latest: () => fail ? Promise.reject(new Error()) : new Promise((resolve) => { release = resolve; }), byId: async () => fish };
  const ecosystem = createEcosystem({ repository, weather: emptyWeather() });
  const refreshing = ecosystem.refresh(); await ecosystem.publish(id); release([]); await refreshing;
  assert.equal(ecosystem.snapshot().fish[0].id, id);
  const catchUp = ecosystem.refresh(); release([fish, { ...fish, id: userId }]); await catchUp;
  assert.equal(ecosystem.snapshot().fish.length, 2);
  fail = true; await ecosystem.refresh(); assert.equal(ecosystem.snapshot().source, 'unavailable'); assert.equal(ecosystem.snapshot().fish.length, 2);
});

test('OpenWeatherMap usa coordenadas y unidades métricas; cambia a noche según amanecer/ocaso, no según la PC', async () => {
  let now = Date.UTC(2026, 10, 20, 22, 59), calls = 0;
  const body = { main: { temp: 27.4 }, wind: { speed: 8 }, weather: [{ id: 501, description: 'lluvia moderada' }], rain: { '1h': 2 }, clouds: { all: 80 }, dt: now / 1000, sys: { sunrise: (now - 40_000_000) / 1000, sunset: (now + 60_000) / 1000 } };
  const service = createWeatherService(weatherConfig, { now: () => now, fetchImpl: async (url) => {
    assert.equal(url.origin, 'https://api.openweathermap.org');
    assert.equal(url.pathname, '/data/2.5/weather');
    calls++; assert.equal(url.hostname, 'api.openweathermap.org'); assert.equal(url.searchParams.get('lat'), '20.5'); assert.equal(url.searchParams.get('units'), 'metric'); assert.equal(url.searchParams.get('lang'), 'es');
    return { ok: true, json: async () => body };
  } });
  const [first] = await Promise.all([service.refresh(), service.refresh()]); assert.equal(calls, 1);
  assert.equal(first.isNight, false); assert.equal(first.rainy, true); assert.equal(first.temperatureC, 27.4);
  now += 120_000; assert.equal(service.snapshot().isNight, true); assert.equal(service.snapshot().timezone, 'America/Cancun');
  assert.doesNotMatch(JSON.stringify(first), /test-key|appid/);
});

test('clima ausente, inválido o caído no inventa lecturas; la última lectura caduca', async () => {
  assert.equal((await emptyWeather().refresh()).reason, 'missing_key');
  const rejected = createWeatherService(weatherConfig, { fetchImpl: async () => ({ ok: false, status: 401 }) });
  assert.equal((await rejected.refresh()).reason, 'invalid_key');
  const invalid = createWeatherService(weatherConfig, { fetchImpl: async () => ({ ok: true, json: async () => ({}) }) });
  assert.equal((await invalid.refresh()).status, 'unavailable');
  let now = Date.now(), failed = false;
  const service = createWeatherService(weatherConfig, { now: () => now, fetchImpl: async () => {
    if (failed) throw new Error(); return { ok: true, json: async () => ({ main: { temp: 25 }, wind: { speed: 2 }, weather: [{ id: 800, description: 'despejado' }], dt: now / 1000, sys: { sunrise: now / 1000 - 1000, sunset: now / 1000 + 1000 } }) };
  } });
  await service.refresh(); failed = true; now += 900_000; assert.equal((await service.refresh()).status, 'stale');
  now += 3_600_000; assert.equal(service.snapshot().status, 'unavailable'); assert.equal(service.snapshot().isNight, null);
});

test('los peces giran gradualmente en ambos bordes, mantienen tamaño/profundidad y no saltan tras una pausa', () => {
  const swimmer = createSwimmer(fish); swimmer.x = 0.99; swimmer.direction = swimmer.face = 1;
  let minimumFace = 1, lastFace = 1;
  for (let i = 0; i < 300; i++) {
    advanceSwimmer(swimmer, 1 / 60, 800, 100, 1);
    assert.ok(swimmer.x >= 68 / 800 && swimmer.x <= 1 - 68 / 800);
    assert.ok(Math.abs(swimmer.face - lastFace) < 0.1); lastFace = swimmer.face;
    minimumFace = Math.min(minimumFace, swimmer.face);
  }
  assert.equal(minimumFace, -1);
  swimmer.x = 0; swimmer.direction = swimmer.face = -1; swimmer.turn = null;
  for (let i = 0; i < 100; i++) advanceSwimmer(swimmer, 1 / 60, 320, 90);
  assert.equal(swimmer.direction, 1);
  const before = swimmer.x; advanceSwimmer(swimmer, 600, 320, 90); assert.ok(Math.abs(swimmer.x - before) < 0.02);
  assert.deepEqual(createSwimmer(fish), createSwimmer(fish));
  assert.equal(environmentFor({ status: 'ready', isNight: true, windMps: 12, rainy: true }).night, 1);
  assert.equal(environmentFor({ status: 'unavailable', isNight: true, windMps: 12 }).current, 0);
});

test('QR conserva el subdirectorio de Pages y el anfitrión de LAN; la colección deduplica UUID', () => {
  assert.equal(drawingJoinUrl({ origin: 'https://kevinbigotes.github.io', pathname: '/FISH-TANK/' }), 'https://kevinbigotes.github.io/FISH-TANK/#/dibujar');
  assert.equal(drawingJoinUrl({ origin: 'http://192.168.1.10:5173', pathname: '/' }), 'http://192.168.1.10:5173/#/dibujar');
  assert.equal(mergeFish([fish], [fish, { ...fish, id: userId }]).length, 2);
  assert.equal(mergeFish([fish], [{ ...fish, name: 'Nuevo nombre' }])[0].name, 'Nuevo nombre');
});

test('LAN es explícito y solo en desarrollo; el UUID funciona sin crypto.randomUUID', () => {
  const lan = { DEV: true, VITE_LAN_MODE: 'true' };
  const config = readPublicConfig(lan, undefined, '192.168.1.10');
  assert.equal(config.aquariumServiceUrl, 'http://192.168.1.10:3003'); assert.deepEqual(config.errors, []);
  assert.ok(readPublicConfig(lan, undefined, 'example.com').errors.length);
  assert.ok(readPublicConfig({ VITE_AQUARIUM_ECOSYSTEM_SERVICE_URL: 'http://192.168.1.10:3003' }).errors.length);
  assert.equal(readPublicConfig({ DEV: false, VITE_LAN_MODE: 'true' }).aquariumServiceUrl, '');
  assert.match(submissionUuid({ getRandomValues: (bytes) => crypto.getRandomValues(bytes) }), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.throws(() => readAquariumConfig({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_secret_nope' }), /solo lectura/);
});
