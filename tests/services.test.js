import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createAuthApp } from '../services/auth-user-service/src/app.js';
import { createSupabaseClients } from '../services/auth-user-service/src/supabase.js';
import { createGalleryApp } from '../services/gallery-collection-service/src/app.js';

const id = '11111111-1111-4111-8111-111111111111';
function setup() {
  const profile = { id, username: 'alice', bio: '', avatar_color: '#36b6aa', created_at: '2026-01-01T00:00:00Z' };
  const calls = [];
  function database(token) {
    return { from(table) {
      calls.push({ token, table });
      const query = {
        select(columns) { calls.push({ columns }); return this; },
        eq(column, value) { calls.push({ column, value }); return this; },
        order() { return this; }, range() { return this; }, ilike() { return this; },
        update(data) { calls.push({ update: data }); Object.assign(profile, data); return this; },
        maybeSingle: async () => ({ data: { ...profile }, error: null }),
        then(resolve, reject) { return Promise.resolve({ data: [{ ...profile }], error: null }).then(resolve, reject); },
      };
      return query;
    } };
  }
  const publicClient = { ...database(null), auth: { async getUser(token) {
    calls.push({ verified: token });
    return token === 'valid-token' ? { data: { user: { id, email: 'alice@example.com' } }, error: null }
      : { data: { user: null }, error: { status: 401 } };
  } } };
  return { app: createAuthApp({ publicClient, forToken: database, corsOrigins: ['http://localhost:5173'] }), calls };
}

test('rutas privadas rechazan tokens ausentes, malformados e inválidos', async () => {
  const { app } = setup();
  await request(app).get('/api/v1/me').expect(401);
  await request(app).get('/api/v1/me').set('Authorization', 'Basic nope').expect(401);
  await request(app).get('/api/v1/me').set('Authorization', 'Bearer forged-token').expect(401);
});

test('se valida el token en Supabase y se consulta solo el perfil del usuario con su JWT', async () => {
  const { app, calls } = setup();
  const response = await request(app).get('/api/v1/me').set('Authorization', 'Bearer valid-token').expect(200);
  assert.equal(response.body.data.id, id);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.ok(calls.some((call) => call.verified === 'valid-token'));
  assert.ok(calls.some((call) => call.token === 'valid-token' && call.table === 'profiles'));
  assert.ok(calls.some((call) => call.column === 'id' && call.value === id));
  const session = await request(app).get('/api/v1/session').set('Authorization', 'Bearer valid-token').expect(200);
  assert.equal(session.body.data.user.email, 'alice@example.com');
});

test('PATCH permite campos de perfil y bloquea cambiar propietario o inyectar campos', async () => {
  const { app } = setup();
  const response = await request(app).patch('/api/v1/me').set('Authorization', 'Bearer valid-token').send({ bio: 'Hola' }).expect(200);
  assert.equal(response.body.data.bio, 'Hola');
  for (const body of [{ id }, { username: '!' }, { bio: 'x'.repeat(281) }, { avatar_color: 'red' }, {}]) {
    await request(app).patch('/api/v1/me').set('Authorization', 'Bearer valid-token').send(body).expect(400);
  }
});

test('consulta pública de creadores paginada con campos explícitos y parámetros validados', async () => {
  const { app, calls } = setup();
  await request(app).get('/api/v1/creators?q=alice&limit=10').expect(200);
  assert.ok(calls.some((call) => call.columns === 'id,username,avatar_color,bio,created_at'));
  for (const query of ['limit=500', 'offset=-1', 'q=bad%25value']) {
    await request(app).get(`/api/v1/creators?${query}`).expect(400);
  }
  await request(app).get('/api/v1/creators/not-a-uuid').expect(400);
});

test('CORS exacto, JSON inválido y rutas desconocidas devuelven errores controlados', async () => {
  const { app } = setup();
  await request(app).get('/health').set('Origin', 'https://untrusted.example').expect(403);
  await request(app).options('/api/v1/me').set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'PATCH').expect(204);
  await request(app).patch('/api/v1/me').set('Content-Type', 'application/json').send('{bad').expect(400);
  await request(app).get('/not-found').expect(404);
});

test('el servicio de usuarios rechaza claves que omiten RLS', () => {
  const common = { SUPABASE_URL: 'https://example.supabase.co' };
  assert.throws(() => createSupabaseClients({ ...common, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_nope' }), /publishable/);
  const payload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url');
  assert.throws(() => createSupabaseClients({ ...common, SUPABASE_PUBLISHABLE_KEY: `eyJhbGciOiJIUzI1NiJ9.${payload}.fake` }), /publishable/);
});

test('el servicio de colecciones expone salud y exige autenticación', async () => {
  for (const app of [createGalleryApp()]) {
    const health = await request(app).get('/health').expect(200);
    assert.equal(health.body.status, 'ok');
    await request(app).get('/api/personal-aquarium').expect(401);
  }
});
