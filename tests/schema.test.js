import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const fish = '33333333-3333-4333-8333-333333333333';

test('schema.sql: trigger, privilegios, RLS y colecciones sin duplicados en PostgreSQL', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  // Solo se emula el esquema de Auth. Las restricciones y RLS son PostgreSQL real.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  const schema = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
  await db.exec(schema);
  await db.query('insert into auth.users (id, raw_user_meta_data) values ($1, $2), ($3, $4)',
    [alice, { username: 'Alice', avatar_color: '#36b6aa' }, bob, { username: 'bob' }]);
  await db.exec(schema); // Reejecución sin pérdida de datos.

  async function asUser(id, callback, role = 'authenticated') {
    await db.exec(`begin; set local role ${role};`);
    try {
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [id || '']);
      return await callback();
    } finally { await db.exec('rollback'); }
  }

  await t.test('el registro crea perfil y normaliza el nombre aun sin sesión', async () => {
    const result = await db.query('select * from public.profiles where id = $1', [alice]);
    assert.equal(result.rows[0].username, 'alice');
    assert.equal(result.rows[0].bio, '');
  });
  await t.test('un nombre duplicado revierte también auth.users', async () => {
    await assert.rejects(db.query('insert into auth.users (id, raw_user_meta_data) values ($1, $2)',
      ['44444444-4444-4444-8444-444444444444', { username: 'ALICE' }]), /unique/i);
    assert.equal((await db.query('select count(*)::int as total from auth.users')).rows[0].total, 2);
  });
  await t.test('metadatos inválidos no evaden CHECK y no crean usuarios huérfanos', async () => {
    await assert.rejects(db.query('insert into auth.users (id, raw_user_meta_data) values ($1, $2)',
      ['44444444-4444-4444-8444-444444444444', { username: '<script>' }]), /check/i);
    await assert.rejects(db.query('insert into auth.users (id, raw_user_meta_data) values ($1, $2)',
      ['44444444-4444-4444-8444-444444444444', { username: 'valid', avatar_color: 'red' }]), /check/i);
  });
  await t.test('anon consulta perfiles, pero no modifica ni crea perfiles', async () => {
    await asUser(null, async () => assert.equal((await db.query('select * from public.profiles')).rows.length, 2), 'anon');
    await assert.rejects(asUser(null, () => db.query("update public.profiles set bio = 'hack'"), 'anon'), /permission/i);
    await assert.rejects(asUser(alice, () => db.query("insert into public.profiles(id,username) values ($1,'fake')", [alice])), /permission/i);
  });
  await t.test('solo el propietario puede modificar su perfil; id y created_at son inmutables', async () => {
    await asUser(alice, async () => {
      assert.equal((await db.query("update public.profiles set bio = 'Mi historia' where id=$1 returning bio", [alice])).rows[0].bio, 'Mi historia');
      assert.equal((await db.query("update public.profiles set bio = 'hack' where id=$1 returning id", [bob])).rows.length, 0);
    });
    await assert.rejects(asUser(alice, () => db.query('update public.profiles set id=$1 where id=$2', [bob, alice])), /permission/i);
    await assert.rejects(asUser(alice, () => db.query('update public.profiles set created_at=now() where id=$1', [alice])), /permission/i);
  });

  await db.query('insert into public.fish(id,name,image_url,creator_id) values ($1,$2,$3,$4)', [fish, 'Pez de Bob', 'https://example.com/fish.png', bob]);
  await t.test('peces públicos; publicación directa del navegador bloqueada', async () => {
    await asUser(null, async () => assert.equal((await db.query('select * from public.fish')).rows.length, 1), 'anon');
    await assert.rejects(asUser(alice, () => db.query("insert into public.fish(name,image_url,creator_id) values ('sin moderar','https://example.com/a.png',$1)", [alice])), /permission/i);
  });
  await t.test('se pueden guardar peces ajenos, sin duplicarlos ni guardar para otro usuario', async () => {
    await asUser(alice, async () => {
      await db.query('insert into public.personal_aquarium_fish(user_id,fish_id) values ($1,$2)', [alice, fish]);
      assert.equal((await db.query('select * from public.personal_aquarium_fish')).rows.length, 1);
      await assert.rejects(db.query('insert into public.personal_aquarium_fish(user_id,fish_id) values ($1,$2)', [alice, fish]), /unique/i);
    });
    await assert.rejects(asUser(alice, () => db.query('insert into public.personal_aquarium_fish(user_id,fish_id) values ($1,$2)', [bob, fish])), /row-level security/i);
  });
  await db.query('insert into public.personal_aquarium_fish(user_id,fish_id) values ($1,$2)', [bob, fish]);
  await t.test('las colecciones son privadas y solo el dueño puede eliminar sus guardados', async () => {
    await assert.rejects(asUser(null, () => db.query('select * from public.personal_aquarium_fish'), 'anon'), /permission/i);
    await asUser(alice, async () => {
      assert.equal((await db.query('select * from public.personal_aquarium_fish')).rows.length, 0);
      assert.equal((await db.query('delete from public.personal_aquarium_fish returning id')).rows.length, 0);
    });
    await asUser(bob, async () => {
      assert.equal((await db.query('select * from public.personal_aquarium_fish')).rows.length, 1);
      assert.equal((await db.query('delete from public.personal_aquarium_fish returning id')).rows.length, 1);
    });
  });
  await t.test('las FK rechazan peces inexistentes y limpian referencias al eliminar un creador', async () => {
    await assert.rejects(db.query('insert into public.personal_aquarium_fish(user_id,fish_id) values ($1,$2)', [alice, alice]), /foreign key/i);
    await db.query('delete from auth.users where id=$1', [bob]);
    assert.equal((await db.query('select * from public.fish')).rows.length, 0);
    assert.equal((await db.query('select * from public.personal_aquarium_fish')).rows.length, 0);
  });
});
