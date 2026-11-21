import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createGalleryApp } from '../services/gallery-collection-service/src/app.js';
import { hitSprite } from '../frontend/src/aquarium/hit-test.js';
const alice = '11111111-1111-4111-8111-111111111111', bob = '22222222-2222-4222-8222-222222222222';
const mine = { id: '33333333-3333-4333-8333-333333333333', creator_id: alice, name: 'Mío', created_at: '2026-01-01' };
const other = { id: '44444444-4444-4444-8444-444444444444', creator_id: bob, name: 'Ajeno', created_at: '2026-01-02' };
function fixture() {
  const fish = [mine, other], saved = [], calls = [];
  function client(token) {
    return { from(table) {
      let filters = [], operation = 'select', value, columns = '', range;
      const query = {
        select(c) { columns = c; return this; }, eq(k, v) { filters.push([k, v]); return this; }, order() { return this; }, range(a, b) { range = [a, b]; return this; },
        insert(row) { operation = 'insert'; value = row; return this; }, delete() { operation = 'delete'; return this; },
        async execute(single = false) {
          calls.push({ token, table, operation, filters: [...filters], value });
          if (operation === 'insert') { if (saved.some((r) => r.user_id === value.user_id && r.fish_id === value.fish_id)) return { error: { code: '23505' } }; saved.push({ ...value, id: 'saved', saved_at: '2026-02-01' }); return { error: null }; }
          const rows = table === 'fish' ? fish : saved;
          const matches = rows.filter((r) => filters.every(([k, v]) => r[k] === v));
          if (operation === 'delete') { for (const row of matches) saved.splice(saved.indexOf(row), 1); return { error: null }; }
          let result = matches.map((r) => columns.includes('fish:') ? { ...r, fish: fish.find((f) => f.id === r.fish_id) } : r);
          if (range) result = result.slice(range[0], range[1] + 1);
          return { data: single ? result[0] || null : result, error: null };
        },
        maybeSingle() { return this.execute(true); }, then(resolve, reject) { return this.execute().then(resolve, reject); },
      }; return query;
    } };
  }
  const publicClient = { ...client(null), auth: { getUser: async (token) => token === 'alice' || token === 'bob' ? { data: { user: { id: token === 'alice' ? alice : bob } } } : { error: { status: 401 } } } };
  return { app: createGalleryApp({ publicClient, forToken: client }), saved, calls };
}
test('guardar es idempotente, solo admite peces ajenos y deriva el dueño del JWT', async () => {
  const { app, saved, calls } = fixture();
  await request(app).post(`/api/personal-aquarium/${other.id}`).expect(401);
  await request(app).post(`/api/personal-aquarium/${other.id}`).set('Authorization', 'Bearer forged').expect(401);
  await request(app).post(`/api/personal-aquarium/${mine.id}`).set('Authorization', 'Bearer alice').expect(409);
  await request(app).post(`/api/personal-aquarium/${other.id}`).set('Authorization', 'Bearer alice').send({ user_id: bob }).expect(400);
  await request(app).post(`/api/personal-aquarium/${other.id}`).set('Authorization', 'Bearer alice').expect(201);
  await request(app).post(`/api/v1/personal-aquarium/${other.id}`).set('Authorization', 'Bearer alice').expect(200);
  assert.equal(saved.length, 1); assert.equal(saved[0].user_id, alice);
  assert.ok(calls.filter((c) => c.operation === 'insert').every((c) => c.token === 'alice'));
});
test('la pecera combina propios y adoptados; eliminar afecta solo al guardado propio', async () => {
  const { app, saved } = fixture();
  saved.push({ id: 'a', user_id: alice, fish_id: other.id }, { id: 'b', user_id: bob, fish_id: mine.id });
  let result = await request(app).get('/api/personal-aquarium').set('Authorization', 'Bearer alice').expect(200);
  assert.deepEqual(result.body.data.map((f) => f.kind), ['created', 'adopted']);
  await request(app).delete(`/api/personal-aquarium/${mine.id}`).set('Authorization', 'Bearer alice').expect(204);
  assert.equal(saved.length, 2);
  await request(app).delete(`/api/personal-aquarium/${other.id}`).set('Authorization', 'Bearer alice').expect(204);
  assert.equal(saved.length, 1); assert.equal(saved[0].user_id, bob);
  result = await request(app).get('/api/personal-aquarium').set('Authorization', 'Bearer alice').expect(200);
  assert.deepEqual(result.body.data.map((f) => f.id), [mine.id]);
});
test('galería por creador pública, paginada y con validación de identificadores', async () => {
  const { app } = fixture();
  const result = await request(app).get(`/api/creators/${bob}/fish?limit=1`).expect(200);
  assert.deepEqual(result.body.data.map((f) => f.id), [other.id]);
  await request(app).get(`/api/creators/${bob}/fish?limit=10000`).expect(400);
  await request(app).post('/api/personal-aquarium/invalid').set('Authorization', 'Bearer alice').expect(400);
  await request(app).post(`/api/personal-aquarium/${alice}`).set('Authorization', 'Bearer alice').expect(404);
});
test('hit testing ignora transparencia y respeta rotación, espejo, escala y giro de canto', () => {
  const sprite = { x: 100, y: 100, angle: 0, sx: 1, sy: 1, width: 100, height: 100, mask: { width: 2, height: 2, alpha: new Uint8Array([255, 0, 0, 0]) } };
  assert.equal(hitSprite({ x: 75, y: 75 }, sprite), true);
  assert.equal(hitSprite({ x: 125, y: 75 }, sprite), false);
  assert.equal(hitSprite({ x: 125, y: 75 }, { ...sprite, sx: -1 }), true);
  assert.equal(hitSprite({ x: 125, y: 75 }, { ...sprite, angle: Math.PI / 2 }), true);
  assert.equal(hitSprite({ x: 100, y: 100 }, { ...sprite, sx: 0 }), false);
  assert.equal(hitSprite({ x: 0, y: 0 }, sprite), false);
});
