import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import request from 'supertest';
import { createDrawingApp } from '../services/drawing-processing-service/src/app.js';
import { cropTransparentPng } from '../services/drawing-processing-service/src/image.js';
import { createModerator, evaluateModeration } from '../services/drawing-processing-service/src/moderation.js';
import { createDrawingRepository } from '../services/drawing-processing-service/src/repository.js';
import { publishDrawing } from '../services/drawing-processing-service/src/pipeline.js';
import { readDrawingConfig, MAX_UPLOAD_BYTES } from '../services/drawing-processing-service/src/config.js';

const require = createRequire(new URL('../services/drawing-processing-service/package.json', import.meta.url));
const sharp = require('sharp');
const userId = '11111111-1111-4111-8111-111111111111';
const submissionId = '22222222-2222-4222-8222-222222222222';
const creator = { id: userId, username: 'creadora', avatar_color: '#36b6aa' };
const safeScores = () => ({ status: 'success', nudity: { sexual_activity: 0.01, sexual_display: 0.01, erotica: 0.01, very_suggestive: 0.01 }, offensive: { prob: 0.01 }, gore: { prob: 0.01 } });

async function makePng({ empty = false, white = false } = {}) {
  const rgba = Buffer.alloc(12 * 10 * 4);
  if (!empty) for (let y = 3; y <= 6; y += 1) for (let x = 2; x <= 8; x += 1) {
    const index = (y * 12 + x) * 4;
    rgba[index] = 255; rgba[index + 1] = white ? 255 : 100; rgba[index + 2] = white ? 255 : 40;
    rgba[index + 3] = x === 2 && y === 3 ? 1 : 255;
  }
  return sharp(rgba, { raw: { width: 12, height: 10, channels: 4 } }).png().toBuffer();
}

function fixture() {
  const events = [], files = new Map(), fish = new Map();
  const repository = {
    async getCreator(id) { assert.equal(id, userId); return creator; },
    async findFish(id, owner) { return fish.get(id)?.creator_id === owner ? fish.get(id) : null; },
    async upload(path, png) { events.push('upload'); files.set(path, png); return `https://example.com/${path}`; },
    async insertFish(row) { events.push('insert'); const saved = { ...row, created_at: '2026-11-20T00:00:00Z' }; fish.set(row.id, saved); return saved; },
    async removeSprite(path) { events.push('remove'); files.delete(path); },
  };
  const moderator = { ready: true, simulated: true, async check(png) {
    events.push('moderate'); assert.equal((await sharp(png).metadata()).width, 7);
    return { approved: true, provider: 'mock', simulated: true };
  } };
  const authClient = { auth: { async getUser(token) { return token === 'valid' ? { data: { user: { id: userId } } } : { data: {}, error: { status: 401 } }; } } };
  return { events, files, fish, repository, moderator, authClient };
}
const publish = async (fixture, overrides = {}) => publishDrawing({ userId, submissionId, name: 'Burbuja', image: await makePng(), ...fixture, ...overrides });

test('recorta exactamente por alfa, conserva blanco y el píxel semitransparente del borde', async () => {
  const sprite = await cropTransparentPng(await makePng({ white: true }));
  assert.deepEqual([sprite.width, sprite.height], [7, 4]);
  const { data, info } = await sharp(sprite.buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 4);
  assert.equal(data[3], 1);
  assert.equal(data[4], 255);
});

test('rechaza dibujos vacíos, falsos PNG, archivos corruptos y dimensiones excesivas', async () => {
  await assert.rejects(cropTransparentPng(await makePng({ empty: true })), { code: 'EMPTY_DRAWING' });
  await assert.rejects(cropTransparentPng(Buffer.from('<svg/>')), { code: 'PNG_REQUIRED' });
  await assert.rejects(cropTransparentPng(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1])), { code: 'INVALID_IMAGE' });
  const large = await sharp({ create: { width: 2049, height: 1, channels: 4, background: '#ff0000' } }).png().toBuffer();
  await assert.rejects(cropTransparentPng(large), { code: 'IMAGE_TOO_LARGE' });
});

test('pipeline modera antes de subir e insertar, y deriva al creador de la identidad verificada', async () => {
  const f = fixture();
  const result = await publish(f);
  assert.deepEqual(f.events, ['moderate', 'upload', 'insert']);
  assert.equal(result.fish.creator_id, userId);
  assert.equal(result.creator.username, 'creadora');
  assert.equal(result.sprite.width, 7);
  assert.equal(f.files.size, 1);
});

test('un rechazo o fallo de moderación no sube ni inserta', async () => {
  const f = fixture();
  f.moderator.check = async () => ({ approved: false });
  await assert.rejects(publish(f), { code: 'DRAWING_REJECTED' });
  assert.deepEqual(f.events, []);
  f.moderator.check = async () => { throw new Error('provider unavailable'); };
  await assert.rejects(publish(f), /provider unavailable/);
  assert.deepEqual(f.events, []);
});

test('compensa un fallo confirmado de DB; no borra un PNG si el INSERT pudo haberse completado', async () => {
  const f = fixture();
  f.repository.insertFish = async () => { throw new Error('db down'); };
  await assert.rejects(publish(f), /db down/);
  assert.equal(f.files.size, 0);
  assert.equal(f.events.at(-1), 'remove');

  const recovered = fixture();
  const save = recovered.repository.insertFish;
  recovered.repository.insertFish = async (row) => { await save(row); throw new Error('response lost'); };
  const result = await publish(recovered);
  assert.equal(result.replayed, true);
  assert.equal(recovered.files.size, 1);
  assert.ok(!recovered.events.includes('remove'));
});

test('reintentar el mismo envío recupera el pez sin duplicar ni volver a moderar', async () => {
  const f = fixture();
  const first = await publish(f);
  const second = await publish(f);
  assert.equal(second.fish.id, first.fish.id);
  assert.equal(second.replayed, true);
  assert.deepEqual(f.events, ['moderate', 'upload', 'insert']);
});

test('Sightengine real usa multipart, se cierra ante fallos y el mock no hace llamadas externas', async () => {
  let calls = 0;
  const png = await makePng();
  const real = createModerator({ mockExternalApis: false, sightengineUser: 'test-user', sightengineSecret: 'test-secret' }, async (url, options) => {
    calls += 1;
    assert.equal(url, 'https://api.sightengine.com/1.0/check.json');
    assert.equal(options.body.get('models'), 'nudity-2.1,offensive,gore-2.0');
    assert.equal(options.body.get('api_secret'), 'test-secret');
    assert.equal(options.body.get('media').type, 'image/png');
    return Response.json(safeScores());
  });
  assert.equal((await real.check(png)).approved, true);
  const mock = createModerator({ mockExternalApis: true }, () => { throw new Error('No llamar'); });
  assert.equal((await mock.check(png)).simulated, true);
  assert.equal(calls, 1);
  assert.equal(evaluateModeration({ ...safeScores(), offensive: { prob: 0.9 } }).approved, false);
  assert.throws(() => evaluateModeration({ status: 'success' }), { code: 'MODERATION_UNAVAILABLE' });
  const broken = createModerator({ sightengineUser: 'x', sightengineSecret: 'y' }, async () => new Response('bad', { status: 500 }));
  await assert.rejects(broken.check(png), { code: 'MODERATION_UNAVAILABLE' });
});

test('Storage crea el bucket ante NoSuchBucket (HTTP 400/statusCode 404) sin habilitar escrituras públicas', async () => {
  let created = false;
  const admin = { storage: {
    from: () => ({}),
    getBucket: async () => created ? { data: { id: 'fish-sprites', public: true } } : { error: { status: 400, statusCode: '404', code: 'NoSuchBucket' } },
    createBucket: async (name, options) => {
      assert.equal(name, 'fish-sprites');
      assert.deepEqual(options, { public: true, fileSizeLimit: MAX_UPLOAD_BYTES, allowedMimeTypes: ['image/png'] });
      created = true; return { data: { name } };
    },
  } };
  await createDrawingRepository({ secretKey: 'test-only' }, admin).ensureBucket();
  assert.ok(created);
});

test('API rechaza tokens ausentes o falsos antes de aceptar imágenes', async () => {
  const f = fixture(); const app = createDrawingApp(f);
  await request(app).post('/api/v1/drawings').expect(401);
  await request(app).post('/api/v1/drawings').set('Authorization', 'Bearer fake').expect(401);
  assert.deepEqual(f.events, []);
});

test('API multipart devuelve la postal persistida y rechaza creator_id inyectado', async () => {
  const f = fixture(); const app = createDrawingApp(f); const png = await makePng();
  const response = await request(app).post('/api/v1/drawings').set('Authorization', 'Bearer valid')
    .field('name', '  Burbuja  ').field('submission_id', submissionId).attach('image', png, { filename: 'fish.png', contentType: 'image/png' });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.data.fish.name, 'Burbuja');
  assert.equal(response.body.data.creator.username, 'creadora');
  assert.equal(response.headers['cache-control'], 'no-store');
  await request(app).post('/api/v1/drawings').set('Authorization', 'Bearer valid')
    .field('name', 'Injected').field('submission_id', submissionId).field('creator_id', submissionId)
    .attach('image', png, { filename: 'fish.png', contentType: 'image/png' }).expect(400);
});

test('API rechaza archivo grande, MIME incorrecto, falta de nombre y servicio incompleto', async () => {
  const f = fixture(); const app = createDrawingApp(f); const png = await makePng();
  await request(app).post('/api/v1/drawings').set('Authorization', 'Bearer valid')
    .field('name', 'Burbuja').field('submission_id', submissionId)
    .attach('image', Buffer.alloc(MAX_UPLOAD_BYTES + 1), { filename: 'fish.png', contentType: 'image/png' }).expect(413);
  await request(app).post('/api/v1/drawings').set('Authorization', 'Bearer valid')
    .field('name', 'Burbuja').field('submission_id', submissionId).attach('image', png, { filename: 'fish.jpg', contentType: 'image/jpeg' }).expect(415);
  await request(app).post('/api/v1/drawings').set('Authorization', 'Bearer valid')
    .field('name', '  ').field('submission_id', submissionId).attach('image', png, { filename: 'fish.png', contentType: 'image/png' }).expect(400);
  const unconfigured = createDrawingApp({ ...f, repository: null });
  const capabilities = await request(unconfigured).get('/api/v1/capabilities').expect(200);
  assert.equal(capabilities.body.data.ready, false);
  await request(unconfigured).post('/api/v1/drawings').set('Authorization', 'Bearer valid').expect(503);
});

test('MOCK_EXTERNAL_APIS es explícito y las claves públicas no sirven como secret key', () => {
  const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
  assert.equal(readDrawingConfig(env).mockExternalApis, false);
  assert.equal(readDrawingConfig({ ...env, MOCK_EXTERNAL_APIS: 'true' }).mockExternalApis, true);
  assert.throws(() => readDrawingConfig({ ...env, MOCK_EXTERNAL_APIS: 'yes' }));
  assert.throws(() => readDrawingConfig({ ...env, SUPABASE_SECRET_KEY: 'sb_publishable_test' }));
});
