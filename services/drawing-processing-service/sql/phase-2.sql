-- Fish Tank · Fase 2. Ejecutar después de schema.sql si se prepara Storage con SQL.
-- Alternativa para crear el bucket: pnpm --filter drawing-processing-service run setup
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fish-sprites', 'fish-sprites', true, 5242880, array['image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Solo el backend publica después de validar identidad y moderación.
grant usage on schema public to service_role;
grant select on public.profiles to service_role;
grant select, insert on public.fish to service_role;
-- No conceder INSERT a authenticated/anon ni una política de subida directa.
-- Un bucket público permite descargar imágenes, no subirlas desde cualquier cliente.
commit;
