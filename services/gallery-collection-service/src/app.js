import { createBaseApp, finishApp, HttpError } from '@fish-tank/service-core';
const fields = 'id,name,image_url,creator_id,created_at';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function id(value) { if (!uuid.test(value)) throw new HttpError(400, 'INVALID_ID', 'Identificador inválido.'); return value; }
function check(error) { if (error) throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'No se pudo consultar tu pecera. Intenta de nuevo.'); }
async function all(query) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query().range(offset, offset + 499); check(error);
    rows.push(...data); if (data.length < 500) return rows;
  }
}
export function createGalleryApp({ publicClient, forToken, ...config } = {}) {
  const app = createBaseApp({ ...config, name: 'gallery-collection-service', phase: 4, status: 'ok' });
  async function requireUser(req, res, next) {
    const token = req.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
    if (!token) throw new HttpError(401, 'UNAUTHORIZED', 'Inicia sesión para gestionar tu pecera.');
    let result;
    try { result = await publicClient.auth.getUser(token); }
    catch { throw new HttpError(503, 'AUTH_UNAVAILABLE', 'No se pudo verificar tu sesión.'); }
    if (result.error?.status >= 500 || result.error?.name === 'AuthRetryableFetchError') throw new HttpError(503, 'AUTH_UNAVAILABLE', 'No se pudo verificar tu sesión.');
    if (result.error || !result.data?.user) throw new HttpError(401, 'UNAUTHORIZED', 'Tu sesión no es válida.');
    req.userId = result.data.user.id; req.db = forToken(token);
    res.set('Cache-Control', 'no-store'); next();
  }
  const paths = (path) => ['/api' + path, '/api/v1' + path];
  app.get(paths('/creators/:id/fish'), async (req, res) => {
    const creator = id(req.params.id), offset = Number(req.query.offset || 0), limit = Number(req.query.limit || 40);
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new HttpError(400, 'INVALID_PAGE', 'Página inválida.');
    const { data, error } = await publicClient.from('fish').select(fields).eq('creator_id', creator).order('created_at', { ascending: false }).order('id').range(offset, offset + limit);
    check(error); res.json({ data: data.slice(0, limit), hasMore: data.length > limit });
  });
  app.get(paths('/personal-aquarium'), requireUser, async (req, res) => {
    const [owned, saved] = await Promise.all([
      all(() => req.db.from('fish').select(fields).eq('creator_id', req.userId).order('created_at').order('id')),
      all(() => req.db.from('personal_aquarium_fish').select(`saved_at,fish:fish_id(${fields})`).eq('user_id', req.userId).order('saved_at').order('id')),
    ]);
    const combined = new Map(owned.map((fish) => [fish.id, { ...fish, kind: 'created' }]));
    for (const row of saved) if (row.fish && !combined.has(row.fish.id)) combined.set(row.fish.id, { ...row.fish, kind: 'adopted', saved_at: row.saved_at });
    res.json({ data: [...combined.values()] });
  });
  app.get(paths('/personal-aquarium/:fishId'), requireUser, async (req, res) => {
    const { data, error } = await req.db.from('personal_aquarium_fish').select('id').eq('user_id', req.userId).eq('fish_id', id(req.params.fishId)).maybeSingle();
    check(error); res.json({ data: { saved: Boolean(data) } });
  });
  app.post(paths('/personal-aquarium/:fishId'), requireUser, async (req, res) => {
    const fishId = id(req.params.fishId);
    if (req.body && Object.keys(req.body).length) throw new HttpError(400, 'INVALID_INPUT', 'No envíes datos de propietario.');
    const { data: fish, error: lookupError } = await req.db.from('fish').select(fields).eq('id', fishId).maybeSingle(); check(lookupError);
    if (!fish) throw new HttpError(404, 'FISH_NOT_FOUND', 'Ese pez ya no está disponible.');
    if (fish.creator_id === req.userId) throw new HttpError(409, 'OWN_FISH', 'Tus propios peces ya están en tu pecera.');
    const { error } = await req.db.from('personal_aquarium_fish').insert({ user_id: req.userId, fish_id: fishId });
    if (error?.code === '23503') throw new HttpError(404, 'FISH_NOT_FOUND', 'El pez ya no está disponible o falta tu perfil.');
    if (error?.code !== '23505') check(error);
    res.status(error ? 200 : 201).json({ data: { saved: true } });
  });
  app.delete(paths('/personal-aquarium/:fishId'), requireUser, async (req, res) => {
    const { error } = await req.db.from('personal_aquarium_fish').delete().eq('user_id', req.userId).eq('fish_id', id(req.params.fishId));
    check(error); res.status(204).end();
  });
  return finishApp(app);
}
