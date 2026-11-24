-- =============================================================================
-- reversa_009.sql — DESHACE 009_cerrar_anon.sql (SOLO EN EMERGENCIA)
-- =============================================================================
-- Cómo usarlo: copia TODO este archivo en Supabase → SQL Editor → Run.
-- Se puede ejecutar más de una vez sin romper nada. Va en una transacción: si
-- algo falla, no se cambia nada.
--
-- ⚠️ ÚSALO SOLO SI, DESPUÉS DE EJECUTAR 009, ALGO SALE MAL y hace falta que la
-- app vuelva a funcionar SIN SESIÓN (por ejemplo, si regresas en Vercel a la
-- versión vieja de la app, la que no tiene login). Al ejecutarlo, cualquiera con
-- la llave pública vuelve a poder LEER todas las visitas y fotos, CREAR visitas
-- y fotos, y quitar fotos pendientes, como antes de 009. Y cualquiera con el
-- link público de una foto la puede ver.
--
-- Deja anon EXACTAMENTE como estaba antes de 009 (lo que dejaron 001, 002, 003
-- y 007; 008 y 008b no tocaron nada de anon). No toca NADA de authenticated,
-- del admin, de las funciones ni de la Etapa 2.
--
-- Para volver a cerrar después: ejecutar otra vez 009_cerrar_anon.sql (se puede
-- repetir) y su prueba.
--
-- Qué hace:
--   BLOQUE 0. Freno: si no existe lo de 008 o el bucket "fotos", no cambia nada.
--   BLOQUE 1. Devuelve a anon los permisos de tabla y de columna.
--   BLOQUE 2. Vuelve a crear las 6 reglas RLS de anon en las 3 tablas.
--   BLOQUE 3. Vuelve a crear las 2 reglas de Storage de anon.
--   BLOQUE 4. Pone el bucket "fotos" PÚBLICO otra vez.
--   BLOQUE 5. Comprobación final (solo lee): todas las filas deben salir ok = true.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- BLOQUE 0. Freno de seguridad.
-- Sin 008 (columna usuario_id y reglas de authenticated) no hay una 009 que
-- deshacer: lo correcto sería revisar qué pasó, no ejecutar esto.
-- "raise exception" detiene el archivo y se deshace todo.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'visitas'
                   and column_name = 'usuario_id')
     or not exists (select 1 from pg_policies
                    where schemaname = 'public' and tablename = 'visitas'
                      and policyname = 'authenticated lee sus visitas') then
    raise exception 'No está ejecutada 008_autenticacion.sql: no hay 009 que deshacer. No se cambió nada.';
  end if;
  if not exists (select 1 from storage.buckets where id = 'fotos') then
    raise exception 'No existe el bucket "fotos". No se cambió nada; avisa al responsable.';
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- BLOQUE 1. Permisos de tabla y de columna para anon (los mismos de antes de 009).
--   competidores → leer.                                       (001)
--   visitas      → leer; crear SOLO con estas 5 columnas.       (001, menos la
--                  columna competidor_elegido_at, que borró 003)
--   fotos        → leer; crear SOLO con estas 6 columnas;      (001 + 002)
--                  cambiar SOLO descartada_at.                 (007)
-- NO se le da: usuario_id ni subida_por (los pone el servidor), ni UPDATE de
-- visitas, ni DELETE/TRUNCATE de nada.
-- Primero se quita todo (por si quedó algo a medias) y luego se da lo justo.
-- "usage" del esquema public: 009 no lo quitó; se repite por seguridad.
-- -----------------------------------------------------------------------------
revoke all on table public.competidores, public.visitas, public.fotos from anon;

grant usage on schema public to anon;

grant select on table public.competidores to anon;

grant select on table public.visitas to anon;
grant insert (competidor_id, latitud, longitud, precision_metros, ubicacion_at)
  on public.visitas to anon;

grant select on table public.fotos to anon;
grant insert (visita_id, ruta, nombre_original, tamano_bytes,
              capturada_at, capturada_origen)
  on public.fotos to anon;
grant update (descartada_at) on public.fotos to anon;


-- -----------------------------------------------------------------------------
-- BLOQUE 2. Reglas RLS de anon en las 3 tablas (copiadas de 001 y 007).
-- Ninguna de estas reglas hace ciclo con las de authenticated: las reglas solo
-- se aplican al rol que nombran, y la de competidores de anon es "using (true)".
-- -----------------------------------------------------------------------------
drop policy if exists "anon lee competidores" on public.competidores;
create policy "anon lee competidores"
  on public.competidores for select to anon
  using (true);

drop policy if exists "anon lee visitas" on public.visitas;
create policy "anon lee visitas"
  on public.visitas for select to anon
  using (true);

drop policy if exists "anon crea visitas" on public.visitas;
create policy "anon crea visitas"
  on public.visitas for insert to anon
  with check (
    exists (
      select 1 from public.competidores c
      where c.id = competidor_id and c.activo
    )
  );

drop policy if exists "anon lee fotos" on public.fotos;
create policy "anon lee fotos"
  on public.fotos for select to anon
  using (true);

drop policy if exists "anon crea fotos" on public.fotos;
create policy "anon crea fotos"
  on public.fotos for insert to anon
  with check (true);

drop policy if exists "anon descarta fotos pendientes" on public.fotos;
create policy "anon descarta fotos pendientes"
  on public.fotos for update to anon
  using (estado_proceso = 'pendiente' and descartada_at is null)
  with check (estado_proceso = 'pendiente' and descartada_at is not null);


-- -----------------------------------------------------------------------------
-- BLOQUE 3. Reglas de Storage de anon (copiadas de 001). Sin reglas de UPDATE
-- ni DELETE: nadie puede reemplazar ni borrar archivos.
-- -----------------------------------------------------------------------------
drop policy if exists "anon lee fotos del bucket" on storage.objects;
create policy "anon lee fotos del bucket"
  on storage.objects for select to anon
  using (bucket_id = 'fotos');

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


-- -----------------------------------------------------------------------------
-- BLOQUE 4. Bucket "fotos" PÚBLICO otra vez: cualquiera con el link
-- /object/public/fotos/... ve la foto sin sesión y sin pasar por las reglas.
-- Los límites (5 MB, JPEG/PNG/WebP) no cambian.
-- -----------------------------------------------------------------------------
update storage.buckets set public = true where id = 'fotos';

notify pgrst, 'reload schema';

commit;


-- -----------------------------------------------------------------------------
-- BLOQUE 5. Comprobación final (solo lee; no cambia nada).
-- Todas las filas deben salir con ok = true. Si alguna sale false, avisa al
-- responsable.
-- -----------------------------------------------------------------------------
select 'anon: lee competidores, visitas y fotos' as comprobacion,
       has_table_privilege('anon', 'public.competidores', 'SELECT')
       and has_table_privilege('anon', 'public.visitas', 'SELECT')
       and has_table_privilege('anon', 'public.fotos', 'SELECT') as ok
union all
select 'anon: crea visitas solo con las 5 columnas de la app',
       has_column_privilege('anon', 'public.visitas', 'competidor_id', 'INSERT')
       and has_column_privilege('anon', 'public.visitas', 'ubicacion_at', 'INSERT')
       and not has_column_privilege('anon', 'public.visitas', 'usuario_id', 'INSERT')
       and not has_column_privilege('anon', 'public.visitas', 'id', 'INSERT')
       and not has_column_privilege('anon', 'public.visitas', 'created_at', 'INSERT')
       and not has_any_column_privilege('anon', 'public.visitas', 'UPDATE')
union all
select 'anon: crea fotos con las 6 columnas de la app (sin subida_por ni estado)',
       has_column_privilege('anon', 'public.fotos', 'ruta', 'INSERT')
       and has_column_privilege('anon', 'public.fotos', 'capturada_origen', 'INSERT')
       and not has_column_privilege('anon', 'public.fotos', 'subida_por', 'INSERT')
       and not has_column_privilege('anon', 'public.fotos', 'estado_proceso', 'INSERT')
       and not has_column_privilege('anon', 'public.fotos', 'descartada_at', 'INSERT')
union all
select 'anon: en fotos solo cambia descartada_at',
       has_column_privilege('anon', 'public.fotos', 'descartada_at', 'UPDATE')
       and not exists (select 1 from information_schema.columns c
                       where c.table_schema = 'public' and c.table_name = 'fotos'
                         and c.column_name <> 'descartada_at'
                         and has_column_privilege('anon', 'public.fotos', c.column_name, 'UPDATE'))
union all
select 'anon: no borra nada (DELETE ni TRUNCATE)',
       not has_table_privilege('anon', 'public.competidores', 'DELETE, TRUNCATE')
       and not has_table_privilege('anon', 'public.visitas', 'DELETE, TRUNCATE')
       and not has_table_privilege('anon', 'public.fotos', 'DELETE, TRUNCATE')
union all
select 'anon: las 6 reglas de tablas están de vuelta',
       (select count(*) = 6 from pg_policies
        where schemaname = 'public' and roles = array['anon']::name[]
          and tablename in ('competidores', 'visitas', 'fotos'))
union all
select 'anon: las 2 reglas de Storage están de vuelta (leer y subir)',
       (select count(*) = 2 from pg_policies
        where schemaname = 'storage' and tablename = 'objects'
          and roles = array['anon']::name[] and cmd in ('SELECT', 'INSERT'))
union all
select 'Bucket "fotos" PÚBLICO, con 5 MB y solo JPEG/PNG/WebP',
       exists (select 1 from storage.buckets
               where id = 'fotos' and public = true
                 and file_size_limit = 5242880
                 and allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp']
                 and cardinality(allowed_mime_types) = 3)
union all
select 'Storage: nadie puede reemplazar ni borrar archivos',
       not exists (select 1 from pg_policies
                   where schemaname = 'storage' and tablename = 'objects'
                     and cmd in ('UPDATE', 'DELETE', 'ALL')
                     and roles && array['anon', 'authenticated', 'public']::name[])
union all
select 'anon: sigue SIN poder usar es_admin ni las funciones del admin',
       not has_function_privilege('anon', 'public.es_admin()', 'EXECUTE')
       and not has_function_privilege('anon', 'public.admin_cambiar_competidor(uuid, bigint)', 'EXECUTE')
       and not has_function_privilege('anon', 'public.admin_restaurar_foto(uuid)', 'EXECUTE')
       and not has_function_privilege('anon', 'public.admin_correos_usuarios()', 'EXECUTE')
union all
select 'authenticated: sin cambios (6 reglas de tablas y 2 de Storage)',
       (select count(*) = 6 from pg_policies
        where schemaname = 'public' and roles = array['authenticated']::name[]
          and tablename in ('competidores', 'visitas', 'fotos'))
       and (select count(*) = 2 from pg_policies
            where schemaname = 'storage' and tablename = 'objects'
              and roles = array['authenticated']::name[])
union all
select 'Etapa 2: ninguna tabla o vista abierta para anon',
       not exists (
         select 1 from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')
           and c.relname not in ('competidores', 'visitas', 'fotos')
           and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
           and has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE'));
