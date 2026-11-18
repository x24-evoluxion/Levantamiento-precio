-- =============================================================================
-- 001_esquema.sql — Tablas, reglas de seguridad (RLS) y bucket de fotos
-- =============================================================================
-- Cómo usarlo: copia TODO este archivo en Supabase → SQL Editor → Run.
-- Se puede ejecutar más de una vez sin romper nada ni duplicar cosas.
--
-- Recordatorio: la app NO tiene login. Todos los que la usan entran como el rol
-- "anon" (anónimo). Las reglas de abajo dicen qué puede hacer "anon":
--   competidores → solo leer
--   visitas      → leer y crear (no cambiar ni borrar)
--   fotos        → leer y crear (no cambiar ni borrar)
--   Storage      → leer y subir archivos nuevos (no reemplazar ni borrar)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- BLOQUE 1. Tabla competidores: la lista de tiendas que el usuario elige.
-- -----------------------------------------------------------------------------
create table if not exists public.competidores (
  id          bigint generated always as identity primary key,
  nombre      text        not null unique,
  activo      boolean     not null default true,   -- false = no aparece en la app
  orden       int         not null default 0,      -- orden en la lista
  created_at  timestamptz not null default now()
);


-- -----------------------------------------------------------------------------
-- BLOQUE 2. Tabla visitas: una fila por cada visita a una tienda.
-- -----------------------------------------------------------------------------
create table if not exists public.visitas (
  id                     uuid primary key default gen_random_uuid(),
  competidor_id          bigint not null references public.competidores (id),
  latitud                double precision check (latitud  between -90  and 90),
  longitud               double precision check (longitud between -180 and 180),
  precision_metros       double precision check (precision_metros >= 0),
  competidor_elegido_at  timestamptz,                      -- reloj del celular
  ubicacion_at           timestamptz,                      -- reloj del celular
  created_at             timestamptz not null default now() -- reloj del servidor (confiable)
);

-- Índice para mostrar rápido la lista "más reciente primero".
create index if not exists visitas_created_at_idx on public.visitas (created_at desc);


-- -----------------------------------------------------------------------------
-- BLOQUE 3. Tabla fotos: una fila por cada foto subida.
-- -----------------------------------------------------------------------------
create table if not exists public.fotos (
  id               uuid primary key default gen_random_uuid(),
  visita_id        uuid not null references public.visitas (id),
  ruta             text not null unique,   -- ej. visitas/<visita_id>/<uuid>.jpg
  nombre_original  text,                   -- nombre del archivo en el celular
  tamano_bytes     int check (tamano_bytes > 0),
  created_at       timestamptz not null default now(),
  -- La ruta tiene que estar dentro de la carpeta de SU visita.
  constraint fotos_ruta_en_su_visita
    check (ruta like 'visitas/' || visita_id::text || '/%')
);

-- Índice para encontrar rápido las fotos de una visita.
create index if not exists fotos_visita_id_idx on public.fotos (visita_id);


-- -----------------------------------------------------------------------------
-- BLOQUE 4. Permisos de tabla (GRANT).
-- Primero se le quita todo a "anon" y "authenticated", y luego se le da a "anon"
-- solo lo necesario. En visitas y fotos, "anon" solo puede llenar ciertas
-- columnas al crear: así no puede inventar el id ni la fecha created_at.
-- -----------------------------------------------------------------------------
revoke all on public.competidores, public.visitas, public.fotos from anon, authenticated;

grant usage on schema public to anon;

grant select on public.competidores to anon;

grant select on public.visitas to anon;
grant insert (competidor_id, latitud, longitud, precision_metros,
              competidor_elegido_at, ubicacion_at)
  on public.visitas to anon;

grant select on public.fotos to anon;
grant insert (visita_id, ruta, nombre_original, tamano_bytes)
  on public.fotos to anon;


-- -----------------------------------------------------------------------------
-- BLOQUE 5. RLS (Row Level Security): reglas fila por fila.
-- Al activar RLS, todo queda prohibido salvo lo que diga una política ("policy").
-- No hay políticas de UPDATE ni DELETE → nadie puede cambiar ni borrar.
-- -----------------------------------------------------------------------------
alter table public.competidores enable row level security;
alter table public.visitas      enable row level security;
alter table public.fotos        enable row level security;

-- competidores: se pueden leer todos (también los inactivos, para que las
-- visitas viejas sigan mostrando su nombre). La app filtra activo = true.
drop policy if exists "anon lee competidores" on public.competidores;
create policy "anon lee competidores"
  on public.competidores for select to anon
  using (true);

-- visitas: leer todas.
drop policy if exists "anon lee visitas" on public.visitas;
create policy "anon lee visitas"
  on public.visitas for select to anon
  using (true);

-- visitas: crear, solo con un competidor que esté activo.
drop policy if exists "anon crea visitas" on public.visitas;
create policy "anon crea visitas"
  on public.visitas for insert to anon
  with check (
    exists (
      select 1 from public.competidores c
      where c.id = competidor_id and c.activo
    )
  );

-- fotos: leer todas.
drop policy if exists "anon lee fotos" on public.fotos;
create policy "anon lee fotos"
  on public.fotos for select to anon
  using (true);

-- fotos: crear (la regla de la ruta ya la revisa el constraint del bloque 3).
drop policy if exists "anon crea fotos" on public.fotos;
create policy "anon crea fotos"
  on public.fotos for insert to anon
  with check (true);


-- -----------------------------------------------------------------------------
-- BLOQUE 6. Bucket "fotos" en Storage (la "carpeta" donde viven las imágenes).
--   public = true                → cualquiera con el link puede VER las fotos
--   file_size_limit = 5242880    → máximo 5 MB por archivo
--   allowed_mime_types           → solo JPEG, PNG y WebP
-- Si el bucket ya existe, se actualizan sus límites.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- -----------------------------------------------------------------------------
-- BLOQUE 7. Reglas de Storage (políticas sobre storage.objects).
-- Solo se permite LEER y SUBIR. No hay reglas de UPDATE ni DELETE, así que nadie
-- puede reemplazar ni borrar una foto.
-- -----------------------------------------------------------------------------

-- Leer archivos del bucket "fotos".
drop policy if exists "anon lee fotos del bucket" on storage.objects;
create policy "anon lee fotos del bucket"
  on storage.objects for select to anon
  using (bucket_id = 'fotos');

-- Subir archivos SOLO con la forma visitas/<uuid-visita>/<uuid-nuevo>.<ext>
-- y solo si esa visita existe de verdad.
drop policy if exists "anon sube fotos al bucket" on storage.objects;
create policy "anon sube fotos al bucket"
  on storage.objects for insert to anon
  with check (
    bucket_id = 'fotos'
    and name ~ '^visitas/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
    and exists (
      select 1 from public.visitas v
      where v.id::text = split_part(name, '/', 2)
    )
  );
