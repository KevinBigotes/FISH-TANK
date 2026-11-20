-- Fish Tank · Fase 1
-- Ejecutar completo en Supabase > SQL Editor, con el rol postgres.
-- Puede repetirse sobre este mismo esquema sin borrar datos.
begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique
    check (username ~ '^[a-z0-9_]{3,40}$'),
  avatar_color text not null default '#36b6aa'
    check (avatar_color ~ '^#[0-9a-fA-F]{6}$'),
  bio text not null default '' check (char_length(bio) <= 280),
  created_at timestamptz not null default now()
);

create table if not exists public.fish (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  image_url text not null check (image_url ~ '^https://[^[:space:]]+$'),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.personal_aquarium_fish (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  fish_id uuid not null references public.fish(id) on delete cascade,
  saved_at timestamptz not null default now(),
  constraint personal_aquarium_fish_user_fish_key unique (user_id, fish_id)
);

create index if not exists fish_creator_created_idx
  on public.fish (creator_id, created_at desc);
create index if not exists personal_aquarium_fish_fish_idx
  on public.personal_aquarium_fish (fish_id);

-- El trigger también funciona cuando signUp no devuelve sesión porque el
-- correo aún debe confirmarse. No hace falta insertar perfiles desde React.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
  requested_color text;
begin
  requested_username := lower(btrim(new.raw_user_meta_data ->> 'username'));
  if requested_username is null or requested_username = '' then
    requested_username := 'creador_' || replace(new.id::text, '-', '');
  end if;
  requested_color := coalesce(new.raw_user_meta_data ->> 'avatar_color', '#36b6aa');

  insert into public.profiles (id, username, avatar_color)
  values (new.id, requested_username, requested_color);
  -- UNIQUE y CHECK validan también metadatos enviados fuera de nuestra app.
  -- Un username ocupado revierte todo el registro, evitando usuarios huérfanos.
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.fish enable row level security;
alter table public.personal_aquarium_fish enable row level security;

-- Privilegios explícitos: RLS controla filas; GRANT controla operaciones/columnas.
revoke all on public.profiles, public.fish, public.personal_aquarium_fish
  from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.fish to anon, authenticated;
grant update (username, avatar_color, bio) on public.profiles to authenticated;
grant select, delete on public.personal_aquarium_fish to authenticated;
grant insert (user_id, fish_id) on public.personal_aquarium_fish to authenticated;

drop policy if exists profiles_public_read on public.profiles;
create policy profiles_public_read on public.profiles
  for select to anon, authenticated using (true);

drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists fish_public_read on public.fish;
create policy fish_public_read on public.fish
  for select to anon, authenticated using (true);
-- Sin escrituras de fish desde el navegador en Fase 1. Fase 2 incorporará
-- publicación desde drawing-processing-service después de moderar la imagen.
-- No se concede service_role al frontend ni al servicio de usuarios.

drop policy if exists aquarium_owner_read on public.personal_aquarium_fish;
create policy aquarium_owner_read on public.personal_aquarium_fish
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists aquarium_owner_insert on public.personal_aquarium_fish;
create policy aquarium_owner_insert on public.personal_aquarium_fish
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists aquarium_owner_delete on public.personal_aquarium_fish;
create policy aquarium_owner_delete on public.personal_aquarium_fish
  for delete to authenticated using ((select auth.uid()) = user_id);
-- No se exige ser creador del pez: se pueden guardar peces de otras personas.

commit;
