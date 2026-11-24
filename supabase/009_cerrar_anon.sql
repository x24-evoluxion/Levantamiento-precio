-- =============================================================================
-- 009_cerrar_anon.sql — MIGRACIÓN B: sin sesión no se ve nada (RESTRICTIVA)
-- =============================================================================
-- Cómo usarlo: copia TODO este archivo en Supabase → SQL Editor → Run.
-- Se puede ejecutar más de una vez sin romper nada.
--
-- ⚠️ EJECÚTALO SOLO DESPUÉS DE:
--   1) ejecutar 008_autenticacion.sql (A) y su prueba;
--   2) publicar la app nueva (push) y ver "Ready" en Vercel;
--   3) probar la app nueva con una cuenta de campo y con la de admin.
-- Si lo ejecutas antes, la app publicada (la vieja, sin login) deja de
-- funcionar: no podría leer ni guardar nada.
--
-- Desde que se ejecuta, el link sin sesión deja de funcionar: anon (la llave
-- pública sin login) no puede leer, crear ni cambiar nada, ni ver las fotos.
-- Las fotos viejas que alguien haya guardado como link público tampoco abren.
--
-- Qué hace:
--   BLOQUE 0. Freno: si A no está ejecutada, se detiene sin cambiar nada.
--   BLOQUE 1. Quita a anon todo permiso de tabla en competidores, visitas y fotos.
--   BLOQUE 2. Quita las reglas RLS de anon en esas 3 tablas (001 y 007).
--   BLOQUE 3. Quita las reglas de Storage de anon (001).
--   BLOQUE 4. Pone el bucket "fotos" en PRIVADO.
--   BLOQUE 5. Comprobación final (solo lee) de anon y de authenticated.
--
-- Cómo deshacerlo (solo en emergencia): volver a ejecutar 001_esquema.sql NO
-- sirve tal cual (ver PLAN 4.1, su grant nombra una columna borrada). Avísale al
-- responsable; se haría con un archivo nuevo.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- BLOQUE 0. Freno de seguridad. Si falta la migración A, no hay reglas para
-- authenticated y, al quitar las de anon, NADIE podría usar la app.
-- "raise exception" detiene el archivo y el SQL Editor deshace todo.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'visitas'
                   and column_name = 'usuario_id')
     or not exists (select 1 from pg_policies
                    where schemaname = 'public' and tablename = 'visitas'
                      and policyname = 'authenticated lee sus visitas')
     or not exists (select 1 from pg_policies
                    where schemaname = 'storage' and tablename = 'objects'
                      and policyname = 'authenticated lee fotos de sus visitas') then
    raise exception 'Falta ejecutar 008_autenticacion.sql (migración A). No se cambió nada.';
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- BLOQUE 1. Permisos de tabla: anon se queda SIN NADA en las 3 tablas de la app
-- (al quitar los permisos de tabla también se quitan los de columna: el insert de
-- 001/002 y el update de descartada_at de 007).
-- No se toca el permiso "usage" del esquema: sin permisos de tabla no sirve de
-- nada, y Supabase lo necesita para otras cosas.
-- -----------------------------------------------------------------------------
revoke all on table public.competidores, public.visitas, public.fotos from anon;


-- -----------------------------------------------------------------------------
-- BLOQUE 2. Reglas RLS de anon en las 3 tablas (creadas en 001 y 007).
-- Sin permiso de tabla ya no sirven, pero se quitan para que no quede nada
-- abierto si algún día alguien vuelve a dar un permiso por error.
-- -----------------------------------------------------------------------------
drop policy if exists "anon lee competidores"          on public.competidores;
drop policy if exists "anon lee visitas"               on public.visitas;
drop policy if exists "anon crea visitas"              on public.visitas;
drop policy if exists "anon lee fotos"                 on public.fotos;
drop policy if exists "anon crea fotos"                on public.fotos;
drop policy if exists "anon descarta fotos pendientes" on public.fotos;


-- -----------------------------------------------------------------------------
-- BLOQUE 3. Reglas de Storage de anon (001). En storage.objects, Supabase le da
-- a anon permisos de tabla por defecto: lo que lo frena son las reglas. Sin
-- estas dos, anon no puede listar, leer por la API ni subir.
-- -----------------------------------------------------------------------------
drop policy if exists "anon lee fotos del bucket"  on storage.objects;
drop policy if exists "anon sube fotos al bucket"  on storage.objects;


-- -----------------------------------------------------------------------------
-- BLOQUE 4. Bucket "fotos" PRIVADO. Con public = true, cualquiera con el link
-- /object/public/... ve la foto SIN pasar por las reglas. Con public = false,
-- solo se ven con una URL firmada (la app nueva las pide con la sesión de la
-- persona, y duran 24 horas). Los límites (5 MB, JPEG/PNG/WebP) no cambian.
-- -----------------------------------------------------------------------------
update storage.buckets set public = false where id = 'fotos';

notify pgrst, 'reload schema';


-- -----------------------------------------------------------------------------
-- BLOQUE 5. Comprobación final (solo lee; no cambia nada).
-- Todas las filas deben salir con ok = true. Si alguna sale false, NO uses la
-- app todavía y avísale al responsable.
-- -----------------------------------------------------------------------------
select 'anon: ningún permiso de tabla en competidores, visitas y fotos' as comprobacion,
       not has_table_privilege('anon', 'public.competidores',
                               'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
       and not has_table_privilege('anon', 'public.visitas',
                                   'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
       and not has_table_privilege('anon', 'public.fotos',
                                   'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') as ok
union all
select 'anon: ningún permiso de columna en esas 3 tablas',
       not has_any_column_privilege('anon', 'public.competidores', 'SELECT, INSERT, UPDATE, REFERENCES')
       and not has_any_column_privilege('anon', 'public.visitas', 'SELECT, INSERT, UPDATE, REFERENCES')
       and not has_any_column_privilege('anon', 'public.fotos', 'SELECT, INSERT, UPDATE, REFERENCES')
union all
select 'anon: ninguna regla RLS en esas 3 tablas (ni de "public", que incluye a anon)',
       not exists (select 1 from pg_policies
                   where schemaname = 'public'
                     and tablename in ('competidores', 'visitas', 'fotos')
                     and roles && array['anon', 'public']::name[])
union all
select 'Storage: ninguna regla para anon (ni "public")',
       not exists (select 1 from pg_policies
                   where schemaname = 'storage' and tablename = 'objects'
                     and roles && array['anon', 'public']::name[])
union all
select 'Bucket "fotos" PRIVADO, con 5 MB y solo JPEG/PNG/WebP',
       exists (select 1 from storage.buckets
               where id = 'fotos' and public = false
                 and file_size_limit = 5242880
                 and allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp']
                 and cardinality(allowed_mime_types) = 3)
union all
select 'anon: no puede usar es_admin ni las funciones del admin',
       not has_function_privilege('anon', 'public.es_admin()', 'EXECUTE')
       and not has_function_privilege('anon', 'public.admin_cambiar_competidor(uuid, bigint)', 'EXECUTE')
       and not has_function_privilege('anon', 'public.admin_restaurar_foto(uuid)', 'EXECUTE')
       and not has_function_privilege('anon', 'public.admin_correos_usuarios()', 'EXECUTE')
union all
select 'authenticated: sigue leyendo las 3 tablas y creando visitas y fotos',
       has_table_privilege('authenticated', 'public.competidores', 'SELECT')
       and has_table_privilege('authenticated', 'public.visitas', 'SELECT')
       and has_table_privilege('authenticated', 'public.fotos', 'SELECT')
       and has_column_privilege('authenticated', 'public.visitas', 'competidor_id', 'INSERT')
       and has_column_privilege('authenticated', 'public.fotos', 'ruta', 'INSERT')
union all
select 'authenticated: NO manda el dueño, solo cambia descartada_at, no borra',
       not has_column_privilege('authenticated', 'public.visitas', 'usuario_id', 'INSERT')
       and not has_column_privilege('authenticated', 'public.fotos', 'subida_por', 'INSERT')
       and not has_any_column_privilege('authenticated', 'public.visitas', 'UPDATE')
       and has_column_privilege('authenticated', 'public.fotos', 'descartada_at', 'UPDATE')
       and not exists (select 1 from information_schema.columns c
                       where c.table_schema = 'public' and c.table_name = 'fotos'
                         and c.column_name <> 'descartada_at'
                         and has_column_privilege('authenticated', 'public.fotos', c.column_name, 'UPDATE'))
       and not has_table_privilege('authenticated', 'public.competidores', 'DELETE, TRUNCATE')
       and not has_table_privilege('authenticated', 'public.visitas', 'DELETE, TRUNCATE')
       and not has_table_privilege('authenticated', 'public.fotos', 'DELETE, TRUNCATE')
union all
select 'authenticated: las 6 reglas de tablas y las 2 de Storage siguen ahí',
       (select count(*) = 6 from pg_policies
        where schemaname = 'public' and roles = array['authenticated']::name[]
          and tablename in ('competidores', 'visitas', 'fotos'))
       and (select count(*) = 2 from pg_policies
            where schemaname = 'storage' and tablename = 'objects'
              and roles = array['authenticated']::name[])
union all
select 'Storage: nadie puede reemplazar ni borrar archivos',
       not exists (select 1 from pg_policies
                   where schemaname = 'storage' and tablename = 'objects'
                     and cmd in ('UPDATE', 'DELETE', 'ALL')
                     and roles && array['anon', 'authenticated', 'public']::name[])
union all
select 'Etapa 2: ninguna tabla o vista abierta para anon ni authenticated',
       not exists (
         select 1 from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')
           and c.relname not in ('competidores', 'visitas', 'fotos')
           and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
           and (has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
                or has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')))
union all
select 'Etapa 2: ninguna función abierta (anon nada; authenticated solo es_admin y admin_*)',
       not exists (
         select 1 from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
           and (has_function_privilege('anon', p.oid, 'EXECUTE')
                or (has_function_privilege('authenticated', p.oid, 'EXECUTE')
                    and p.proname not in ('es_admin', 'admin_cambiar_competidor',
                                          'admin_restaurar_foto', 'admin_correos_usuarios'))));
