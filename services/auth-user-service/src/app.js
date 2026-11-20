import { z } from 'zod';
import { createBaseApp, finishApp, HttpError } from '@soaylemer/service-core';

const profileFields = 'id,username,avatar_color,bio,created_at';
const username = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,40}$/);
const profilePatch = z.object({
  username: username.optional(),
  avatar_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  bio: z.string().trim().max(280).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);
const creatorQuery = z.object({
  q: z.string().trim().max(40).regex(/^[a-zA-Z0-9_]*$/).default(''),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, 'INVALID_INPUT', 'Revisa los datos enviados.');
  return result.data;
}

function checkDatabase(error) {
  if (!error) return;
  if (error.code === '23505') throw new HttpError(409, 'USERNAME_TAKEN', 'Ese nombre de creador ya está en uso.');
  throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'No se pudo consultar el perfil. Intenta de nuevo.');
}

export function createAuthApp({ publicClient, forToken, ...config }) {
  const app = createBaseApp({ name: 'auth-user-service', phase: 1, ...config });
  async function requireUser(req, res, next) {
    const match = req.get('authorization')?.match(/^Bearer ([^\s]+)$/i);
    if (!match) throw new HttpError(401, 'UNAUTHORIZED', 'Inicia sesión para continuar.');
    let result;
    try { result = await publicClient.auth.getUser(match[1]); }
    catch { throw new HttpError(503, 'AUTH_UNAVAILABLE', 'No se pudo verificar la sesión. Intenta de nuevo.'); }
    if (result.error && (result.error.status >= 500 || result.error.name === 'AuthRetryableFetchError')) {
      throw new HttpError(503, 'AUTH_UNAVAILABLE', 'No se pudo verificar la sesión. Intenta de nuevo.');
    }
    if (result.error || !result.data?.user) throw new HttpError(401, 'UNAUTHORIZED', 'La sesión no es válida.');
    req.user = result.data.user;
    // Cliente por petición: nunca compartir el JWT de un usuario con otro.
    req.database = forToken(match[1]);
    res.set('Cache-Control', 'no-store');
    next();
  }

  app.get('/api/v1/session', requireUser, (req, res) => res.json({ data: {
    user: { id: req.user.id, email: req.user.email, email_confirmed_at: req.user.email_confirmed_at },
  } }));

  app.get('/api/v1/me', requireUser, async (req, res) => {
    const { data, error } = await req.database.from('profiles').select(profileFields).eq('id', req.user.id).maybeSingle();
    checkDatabase(error);
    if (!data) throw new HttpError(404, 'PROFILE_NOT_FOUND', 'No existe tu perfil. Ejecuta schema.sql antes de registrar usuarios nuevos.');
    res.json({ data });
  });

  app.patch('/api/v1/me', requireUser, async (req, res) => {
    const patch = parse(profilePatch, req.body);
    const { data, error } = await req.database.from('profiles').update(patch).eq('id', req.user.id).select(profileFields).maybeSingle();
    checkDatabase(error);
    if (!data) throw new HttpError(404, 'PROFILE_NOT_FOUND', 'No existe tu perfil.');
    res.json({ data });
  });

  app.get('/api/v1/creators', async (req, res) => {
    const { q, limit, offset } = parse(creatorQuery, req.query);
    let query = publicClient.from('profiles').select(profileFields)
      .order('username').order('id').range(offset, offset + limit - 1);
    if (q) query = query.ilike('username', `%${q.replaceAll('_', '\\_')}%`);
    const { data, error } = await query;
    checkDatabase(error);
    res.json({ data, pagination: { limit, offset } });
  });

  app.get('/api/v1/creators/:id', async (req, res) => {
    const id = parse(z.uuid(), req.params.id);
    const { data, error } = await publicClient.from('profiles').select(profileFields).eq('id', id).maybeSingle();
    checkDatabase(error);
    if (!data) throw new HttpError(404, 'CREATOR_NOT_FOUND', 'No se encontró al creador.');
    res.json({ data });
  });

  return finishApp(app);
}
