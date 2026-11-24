-- =============================================================================
-- 008b_romper_ciclo_rls.sql — Corrige "infinite recursion detected in policy
-- for relation visitas" (va DESPUÉS de 008 y ANTES de 009)
-- =============================================================================
-- Cómo usarlo: copia TODO este archivo en Supabase → SQL Editor → Run.
-- Se puede ejecutar más de una vez sin romper nada ("if not exists",
-- "create or replace" y "alter policy", que cambia la regla sin borrarla).
-- Todo va en una transacción: si algo falla, no se cambia nada.
--
-- EL PROBLEMA (encontrado el 2026-11-24 al guardar una visita con la app):
--   Al crear una visita, Postgres revisa la regla "authenticated crea sus
--   visitas", que consulta COMPETIDORES (¿la tienda está activa?). Para leer
--   competidores aplica la regla "authenticated lee competidores", que consulta
--   VISITAS (¿hay una visita mía con esa tienda?). Para leer visitas aplica la
--   regla "authenticated lee sus visitas"… y Postgres ve que ya estaba
--   aplicando reglas de visitas: corta con "infinite recursion".
--       visitas (INSERT) → competidores (SELECT) → visitas (SELECT)  ← ciclo
--   Pasa con CUALQUIER cuenta (campo o admin) y solo al CREAR una visita.
--   Leer visitas, fotos y archivos no hace ciclo (sus reglas no regresan a la
--   tabla de origen), pero se cambian igual para que ninguna regla vuelva a
--   leer otra tabla con RLS directamente.
--
-- LA SOLUCIÓN:
--   Las reglas ya no leen otras tablas con subconsultas. Llaman a funciones
--   pequeñas "security definer" (esquema privado) que leen esa tabla SIN que
--   se apliquen sus reglas RLS; así no se vuelve a entrar al ciclo. Cada función
--   repite a mano el filtro "es mía o soy admin", porque al saltarse las reglas
--   ya no las tiene "gratis".
--
-- ⚠️ NO vuelvas a ejecutar 008_autenticacion.sql después de esta: regresa las
-- reglas viejas (con el ciclo). Si lo haces, vuelve a ejecutar esta.
-- 009_cerrar_anon.sql no toca nada de esto: se puede ejecutar después.
--
-- Qué hace:
--   BLOQUE 0. Freno: si no se ejecutó 008, se detiene sin cambiar nada.
--   BLOQUE 1. Esquema "privado" (la API de Supabase no lo publica).
--   BLOQUE 2. Funciones auxiliares (security definer, search_path vacío).
--   BLOQUE 3. Permisos de las funciones: authenticated sí; anon y public no.
--   BLOQUE 4. Reglas de competidores, visitas y fotos: usan las funciones.
--   BLOQUE 5. Reglas de Storage: usan las funciones.
--   BLOQUE 6. Comprobación (solo lee).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- BLOQUE 0. Freno: esta migración solo corrige reglas que crea 008.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'visitas'
                   and column_name = 'usuario_id')
     or (select count(*) from pg_policies
         where (schemaname, tablename, policyname) in (
           ('public',  'competidores', 'authenticated lee competidores'),
           ('public',  'visitas',      'authenticated crea sus visitas'),
           ('public',  'fotos',        'authenticated lee fotos de sus visitas'),
           ('public',  'fotos',        'authenticated crea fotos en sus visitas'),
           ('public',  'fotos',        'authenticated descarta fotos pendientes de sus visitas'),
           ('storage', 'objects',      'authenticated lee fotos de sus visitas'),
           ('storage', 'objects',      'authenticated sube fotos a sus visitas'))) <> 7
  then
    raise exception 'Primero ejecuta 008_autenticacion.sql (faltan su columna o sus reglas). No se cambió nada.';
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- BLOQUE 1. Esquema "privado".
-- La API de Supabase (PostgREST) solo publica los esquemas configurados
-- (public). Las funciones de aquí NO se pueden llamar desde la app como
-- /rpc/...; solo las usan las reglas RLS. authenticated necesita "usage" para
-- que sus reglas puedan llamarlas; anon no lo recibe.
-- -----------------------------------------------------------------------------
create schema if not exists privado;
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated;

comment on schema privado is
  'Funciones auxiliares de las reglas RLS (008b). No lo publica la API.';


-- -----------------------------------------------------------------------------
-- BLOQUE 2. Funciones auxiliares.
-- Todas:
--   - "security definer": corren como su dueño (el que ejecuta este archivo en
--     el SQL Editor, dueño también de las tablas), así que leen visitas y
--     competidores SIN aplicar sus reglas RLS → no hay ciclo.
--   - "set search_path = ''" y nombres completos (public.…, auth.…): nadie
--     puede colarles una tabla o función con el mismo nombre en otro esquema.
--   - "stable": solo leen; no cambian nada.
--   - Solo responden true/false SOBRE LA PERSONA QUE CONSULTA (auth.uid() y
--     es_admin() salen de su JWT, que no puede falsificar). No dejan elegir de
--     quién preguntar, y nunca devuelven datos de las filas.
-- -----------------------------------------------------------------------------

-- 2a. ¿La visita es mía? (sin sesión, auth.uid() es null → false)
create or replace function privado.es_dueno_de_visita(p_visita_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.visitas v
    where v.id = p_visita_id
      and v.usuario_id = (select auth.uid())
  );
$$;

comment on function privado.es_dueno_de_visita(uuid) is
  'true si la visita existe y es de quien consulta (auth.uid()). Lee visitas sin RLS (008b).';

-- 2b. ¿Puedo trabajar en esta visita? Sí si es mía, o si soy admin y la visita
-- existe (el admin ve y sube fotos a cualquier visita, también a las sin dueño).
create or replace function privado.puede_usar_visita(p_visita_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select privado.es_dueno_de_visita(p_visita_id)
      or (public.es_admin()
          and exists (select 1 from public.visitas v where v.id = p_visita_id));
$$;

comment on function privado.puede_usar_visita(uuid) is
  'true si la visita es de quien consulta, o si es admin y la visita existe. Lee visitas sin RLS (008b).';

-- 2c. ¿La tienda existe y está activa? (para crear visitas)
-- No es secreto: authenticated ya puede leer todas las tiendas activas.
create or replace function privado.competidor_activo(p_competidor_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.competidores c
    where c.id = p_competidor_id and c.activo
  );
$$;

comment on function privado.competidor_activo(bigint) is
  'true si la tienda existe y está activa. Lee competidores sin RLS (008b).';

-- 2d. ¿Esta tienda aparece en alguna visita que YO puedo ver? (para mostrar el
-- nombre de una tienda ya desactivada en una visita vieja). Repite a mano el
-- filtro de "authenticated lee sus visitas": mías, o todas si soy admin.
create or replace function privado.competidor_en_visita_visible(p_competidor_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.visitas v
    where v.competidor_id = p_competidor_id
      and (v.usuario_id = (select auth.uid()) or (select public.es_admin()))
  );
$$;

comment on function privado.competidor_en_visita_visible(bigint) is
  'true si la tienda aparece en una visita de quien consulta (o en cualquiera, si es admin). Lee visitas sin RLS (008b).';

-- 2e. De "visitas/<uuid>/<archivo>" saca el <uuid> de la visita (o null si la
-- ruta no tiene esa forma). NO lee tablas y NO es security definer. El "case"
-- garantiza que el texto se revisa ANTES de convertirlo a uuid, así una ruta
-- rara da null (y la regla dice "no") en vez de un error.
create or replace function privado.visita_de_ruta(p_nombre text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_nombre, '/', 1) = 'visitas'
     and split_part(p_nombre, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_nombre, '/', 2)::uuid
  end;
$$;

comment on function privado.visita_de_ruta(text) is
  'uuid de la visita en una ruta visitas/<uuid>/<archivo>, o null. No lee tablas (008b).';


-- -----------------------------------------------------------------------------
-- BLOQUE 3. Permisos de las funciones.
-- Postgres deja a "public" (todo el mundo, incluido anon) ejecutar funciones
-- nuevas: se le quita. Solo authenticated (sus reglas las llaman).
-- -----------------------------------------------------------------------------
revoke all on function privado.es_dueno_de_visita(uuid)           from public, anon;
revoke all on function privado.puede_usar_visita(uuid)            from public, anon;
revoke all on function privado.competidor_activo(bigint)          from public, anon;
revoke all on function privado.competidor_en_visita_visible(bigint) from public, anon;
revoke all on function privado.visita_de_ruta(text)               from public, anon;

grant execute on function privado.es_dueno_de_visita(uuid)           to authenticated;
grant execute on function privado.puede_usar_visita(uuid)            to authenticated;
grant execute on function privado.competidor_activo(bigint)          to authenticated;
grant execute on function privado.competidor_en_visita_visible(bigint) to authenticated;
grant execute on function privado.visita_de_ruta(text)               to authenticated;


-- -----------------------------------------------------------------------------
-- BLOQUE 4. Reglas de las tablas: mismas condiciones que en 008, pero llamando
-- a las funciones en vez de consultar otra tabla. "alter policy" cambia la
-- regla en su lugar (nunca hay un momento sin regla) y se puede repetir.
-- "authenticated lee sus visitas" NO cambia: no lee otras tablas.
-- -----------------------------------------------------------------------------

-- competidores: activos + los de visitas que puedo ver.
-- (antes: "exists (select … from public.visitas …)" → ahí empezaba el ciclo)
alter policy "authenticated lee competidores" on public.competidores
  using (activo or privado.competidor_en_visita_visible(id));

-- visitas: crear solo a mi nombre y con una tienda activa.
-- (antes: "exists (select … from public.competidores …)" → la otra mitad del ciclo)
alter policy "authenticated crea sus visitas" on public.visitas
  with check (
    usuario_id = (select auth.uid())
    and privado.competidor_activo(competidor_id)
  );

-- fotos: ver las de mis visitas (admin: todas).
alter policy "authenticated lee fotos de sus visitas" on public.fotos
  using (privado.puede_usar_visita(visita_id));

-- fotos: registrar una foto a mi nombre, en mis visitas (admin: en cualquiera).
alter policy "authenticated crea fotos en sus visitas" on public.fotos
  with check (
    subida_por = (select auth.uid())
    and privado.puede_usar_visita(visita_id)
  );

-- fotos: quitar (descartar) solo pendientes, sin restaurar, en mis visitas
-- (admin: en cualquiera).
alter policy "authenticated descarta fotos pendientes de sus visitas" on public.fotos
  using (
    estado_proceso = 'pendiente'
    and descartada_at is null
    and privado.puede_usar_visita(visita_id)
  )
  with check (
    estado_proceso = 'pendiente'
    and descartada_at is not null
    and privado.puede_usar_visita(visita_id)
  );


-- -----------------------------------------------------------------------------
-- BLOQUE 5. Reglas de Storage (bucket "fotos").
--   Leer  → archivos de la carpeta de una visita que puedo usar (sirve para las
--           URLs firmadas).
--   Subir → solo con la forma visitas/<uuid>/<uuid>.<jpg|jpeg|png|webp> y en
--           una visita que puedo usar.
-- Cambio pequeño respecto a 008: el admin ve los archivos de visitas que
-- EXISTEN (antes, cualquier archivo del bucket). La app solo pide archivos de
-- fotos registradas, que siempre tienen visita.
-- -----------------------------------------------------------------------------
alter policy "authenticated lee fotos de sus visitas" on storage.objects
  using (
    bucket_id = 'fotos'
    and privado.puede_usar_visita(privado.visita_de_ruta(name))
  );

alter policy "authenticated sube fotos a sus visitas" on storage.objects
  with check (
    bucket_id = 'fotos'
    and name ~ '^visitas/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
    and privado.puede_usar_visita(privado.visita_de_ruta(name))
  );

commit;

notify pgrst, 'reload schema';


-- -----------------------------------------------------------------------------
-- BLOQUE 6. Comprobación (solo lee; no cambia nada).
-- Todas las filas deben salir con ok = true. Después ejecuta la prueba
-- pruebas/008_prueba_autenticacion.sql (fila "0. RESUMEN" con ok = true).
-- -----------------------------------------------------------------------------
select 'Esquema privado: authenticated lo usa; anon NO' as comprobacion,
       exists (select 1 from pg_namespace where nspname = 'privado')
       and has_schema_privilege('authenticated', 'privado', 'USAGE')
       and not has_schema_privilege('anon', 'privado', 'USAGE') as ok
union all
select 'Las 4 funciones que leen tablas son security definer con search_path vacío',
       (select count(*) = 4 from pg_proc p
        where p.oid in ('privado.es_dueno_de_visita(uuid)'::regprocedure,
                        'privado.puede_usar_visita(uuid)'::regprocedure,
                        'privado.competidor_activo(bigint)'::regprocedure,
                        'privado.competidor_en_visita_visible(bigint)'::regprocedure)
          and p.prosecdef
          and p.provolatile = 's'
          and p.proconfig @> array['search_path=""'])
union all
select 'visita_de_ruta: NO es security definer, search_path vacío',
       exists (select 1 from pg_proc p
               where p.oid = 'privado.visita_de_ruta(text)'::regprocedure
                 and not p.prosecdef
                 and p.proconfig @> array['search_path=""'])
union all
select 'Las 5 funciones: authenticated SÍ las ejecuta; anon NO',
       (select bool_and(has_function_privilege('authenticated', p.oid, 'EXECUTE')
                        and not has_function_privilege('anon', p.oid, 'EXECUTE'))
                and count(*) = 5
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'privado')
union all
select 'Su dueño lee visitas y competidores sin RLS (dueño de las tablas, o bypassrls)',
       -- Si esto sale false, las funciones verían 0 filas y la app no dejaría
       -- crear visitas ni subir fotos (falla "cerrada", nunca abre de más).
       (select bool_and(
                 r.rolsuper or r.rolbypassrls
                 or not exists (select 1 from pg_class c
                                where c.oid in ('public.visitas'::regclass, 'public.competidores'::regclass)
                                  and (c.relowner <> p.proowner or c.relforcerowsecurity)))
        from pg_proc p join pg_roles r on r.oid = p.proowner
        where p.pronamespace = 'privado'::regnamespace and p.prosecdef)
union all
select 'Ninguna regla de authenticated (tablas y Storage) consulta otra tabla directo',
       not exists (select 1 from pg_policies
                   where roles = array['authenticated']::name[]
                     and ((schemaname = 'public' and tablename in ('competidores', 'visitas', 'fotos'))
                          or (schemaname = 'storage' and tablename = 'objects'))
                     and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~* '\mfrom\M')
union all
select 'Las reglas usan las funciones (competidores, visitas, 3 de fotos, 2 de Storage)',
       (select count(*) = 7 from pg_policies
        where roles = array['authenticated']::name[]
          and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) like '%privado.%')
union all
select 'Siguen las 6 reglas de tablas y las 2 de Storage de authenticated',
       (select count(*) = 6 from pg_policies
        where schemaname = 'public' and roles = array['authenticated']::name[]
          and tablename in ('competidores', 'visitas', 'fotos'))
       and (select count(*) = 2 from pg_policies
            where schemaname = 'storage' and tablename = 'objects'
              and roles = array['authenticated']::name[])
union all
select 'Ninguna función de public nueva (las de 008b viven en privado)',
       not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public'
                     and p.proname in ('es_dueno_de_visita', 'puede_usar_visita',
                                       'competidor_activo', 'competidor_en_visita_visible',
                                       'visita_de_ruta'));
