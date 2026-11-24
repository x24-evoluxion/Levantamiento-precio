-- =============================================================================
-- 008_autenticacion.sql — MIGRACIÓN A: login y dueño de cada visita (ADITIVA)
-- =============================================================================
-- Cómo usarlo: copia TODO este archivo en Supabase → SQL Editor → Run.
-- Se puede ejecutar más de una vez sin romper nada (todo usa "if not exists",
-- "create or replace" o "drop ... if exists" antes de volver a crear).
--
-- Decisión del usuario (2026-11-24): la app deja de ser abierta. Se entra con
-- correo y contraseña (Supabase Auth). Las cuentas las crea el dueño en el panel.
--   - Personal de campo (cualquier cuenta SIN rol admin, rol "authenticated"):
--     ve SOLO sus visitas y las fotos de esas visitas; crea visitas; sube fotos a
--     SUS visitas; puede quitar (descartada_at) fotos pendientes de SUS visitas.
--     No modifica visitas ni ninguna otra columna. No borra nada.
--   - Admin (app_metadata.rol = 'admin', lo pone SOLO el dueño): ve todo (también
--     las visitas viejas sin dueño), quita fotos pendientes de cualquier visita, y
--     con FUNCIONES propias: corrige la tienda de una visita, restaura fotos
--     quitadas y ve el correo de quien creó cada visita.
--
-- ⚠️ ESTA MIGRACIÓN NO ROMPE LA APP ACTUAL: anon (la app sin login) sigue
-- funcionando igual. Lo de anon se quita en 009_cerrar_anon.sql (MIGRACIÓN B),
-- que se ejecuta DESPUÉS de publicar y probar la app nueva.
--
-- ORDEN DE DESPLIEGUE (ver docs/PROGRESO.md):
--   1) ejecutar ESTE archivo (A) y la prueba pruebas/008_prueba_autenticacion.sql;
--   2) push de la app nueva y esperar "Ready" en Vercel;
--   3) probar con una cuenta de campo y con la de admin;
--   4) ejecutar 009_cerrar_anon.sql (B). Desde ahí, sin sesión no se ve nada.
--
-- Qué hace:
--   BLOQUE 1. Columnas de dueño: visitas.usuario_id y fotos.subida_por.
--   BLOQUE 2. Función es_admin() (lee app_metadata.rol del JWT).
--   BLOQUE 3. Permisos de tabla (GRANT) para authenticated, columna por columna.
--   BLOQUE 4. Reglas RLS para authenticated en competidores, visitas y fotos.
--   BLOQUE 5. Reglas de Storage para authenticated (bucket "fotos").
--   BLOQUE 6. Funciones del admin (security definer).
--   BLOQUE 7. Etapa 2: sin cambios (se comprueba que siga cerrada).
--   BLOQUE 8. Comprobación (solo lee).
--
-- Glosario:
--   JWT          → "credencial" firmada que la app manda en cada consulta. Dice
--                  quién es la persona (sub = su id) y trae app_metadata.
--   app_metadata → datos de la cuenta que SOLO el dueño puede cambiar. Ahí va
--                  rol = 'admin'. (user_metadata, en cambio, lo puede cambiar la
--                  propia persona desde la app: NUNCA se usa para permisos.)
--   auth.uid()   → el id de la persona que hace la consulta (null si es anon).
--   security definer → la función corre con los permisos de quien la creó (el
--                  SQL Editor), no con los de quien la llama. Por eso cada una
--                  revisa es_admin() antes de hacer nada.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- BLOQUE 1. Columnas de dueño.
-- Se agregan SIN default y DESPUÉS se pone el default. Así las filas que ya
-- existen quedan con null (sin dueño: solo las ve el admin), sin depender de
-- cómo Postgres evalúa el default al agregar la columna.
--   visitas.usuario_id → quién creó la visita.
--   fotos.subida_por   → quién subió la foto (sirve si el admin sube fotos a la
--                        visita de otra persona).
-- "on delete set null": si el dueño borra una cuenta en el panel, sus visitas NO
-- se borran; se quedan sin dueño y solo las ve el admin.
-- La app NO puede escribir estas columnas (no hay GRANT de insert sobre ellas,
-- BLOQUE 3): se llenan SOLO con el default auth.uid(). Así nadie puede crear una
-- visita a nombre de otra persona.
-- -----------------------------------------------------------------------------
alter table public.visitas
  add column if not exists usuario_id uuid references auth.users (id) on delete set null;
alter table public.visitas
  alter column usuario_id set default auth.uid();
create index if not exists visitas_usuario_id_idx on public.visitas (usuario_id);

comment on column public.visitas.usuario_id is
  'Quién creó la visita (auth.users.id). La pone el servidor (default auth.uid()); la app no puede mandarla. Null = visita de antes del login (solo la ve el admin) o cuenta borrada.';

alter table public.fotos
  add column if not exists subida_por uuid references auth.users (id) on delete set null;
alter table public.fotos
  alter column subida_por set default auth.uid();
create index if not exists fotos_subida_por_idx on public.fotos (subida_por);

comment on column public.fotos.subida_por is
  'Quién subió la foto (auth.users.id). La pone el servidor (default auth.uid()); la app no puede mandarla. Null = foto de antes del login o cuenta borrada.';


-- -----------------------------------------------------------------------------
-- BLOQUE 2. es_admin(): ¿la persona que consulta es admin?
-- Lee app_metadata.rol del JWT. NO lee user_metadata (lo puede editar cualquiera).
-- Si no hay JWT o no trae rol, responde false.
-- ⚠️ El JWT se renueva cada hora: si el dueño le pone o le quita el rol admin a
-- una cuenta, el cambio se nota cuando esa persona vuelve a entrar (o, como
-- máximo, en una hora).
-- Permisos: authenticated la puede usar (las reglas RLS la llaman). anon NO.
-- -----------------------------------------------------------------------------
create or replace function public.es_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'rol') = 'admin', false);
$$;

comment on function public.es_admin() is
  'true si el JWT trae app_metadata.rol = ''admin''. Nunca usa user_metadata.';

revoke all on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated, service_role;


-- -----------------------------------------------------------------------------
-- BLOQUE 3. Permisos de tabla (GRANT) para authenticated.
-- Primero se le quita TODO a authenticated en las 3 tablas (al quitar un permiso
-- de tabla, Postgres quita también los de columna) y luego se da lo justo.
-- Es lo mismo que ya tenía anon, más la columna de descarte:
--   competidores → leer.
--   visitas      → leer y crear SOLO con estas columnas: competidor_id, latitud,
--                  longitud, precision_metros, ubicacion_at. NO usuario_id, NO id,
--                  NO created_at. Sin UPDATE ni DELETE.
--   fotos        → leer; crear SOLO con visita_id, ruta, nombre_original,
--                  tamano_bytes, capturada_at, capturada_origen (NO subida_por,
--                  NO descartada_at, NO estado); cambiar SOLO descartada_at.
--                  Sin DELETE.
-- anon no se toca aquí (eso es la migración B).
-- -----------------------------------------------------------------------------
grant usage on schema public to authenticated;

revoke all on table public.competidores, public.visitas, public.fotos from authenticated;

grant select on table public.competidores to authenticated;

grant select on table public.visitas to authenticated;
grant insert (competidor_id, latitud, longitud, precision_metros, ubicacion_at)
  on public.visitas to authenticated;

grant select on table public.fotos to authenticated;
grant insert (visita_id, ruta, nombre_original, tamano_bytes, capturada_at, capturada_origen)
  on public.fotos to authenticated;
grant update (descartada_at) on public.fotos to authenticated;


-- -----------------------------------------------------------------------------
-- BLOQUE 4. Reglas RLS para authenticated (qué FILAS puede ver o tocar).
-- Recordatorio: las reglas filtran FILAS, no columnas. Las columnas las limitan
-- los GRANT del BLOQUE 3. Por eso el admin NO recibe UPDATE general: sus
-- cambios van por las funciones del BLOQUE 6.
-- "(select auth.uid())" y "(select public.es_admin())" van entre paréntesis con
-- select para que Postgres los calcule UNA vez por consulta, no una por fila.
-- -----------------------------------------------------------------------------
alter table public.competidores enable row level security;
alter table public.visitas      enable row level security;
alter table public.fotos        enable row level security;

-- competidores: los activos (para elegir tienda) y además los que aparecen en
-- alguna visita que la persona puede ver (para que una visita vieja de una
-- tienda que ya se desactivó siga mostrando su nombre).
drop policy if exists "authenticated lee competidores" on public.competidores;
create policy "authenticated lee competidores"
  on public.competidores for select to authenticated
  using (
    activo
    or exists (select 1 from public.visitas v where v.competidor_id = competidores.id)
  );

-- visitas: cada quien ve las suyas; el admin ve todas (también las sin dueño).
drop policy if exists "authenticated lee sus visitas" on public.visitas;
create policy "authenticated lee sus visitas"
  on public.visitas for select to authenticated
  using (usuario_id = (select auth.uid()) or (select public.es_admin()));

-- visitas: crear, solo a su nombre y con un competidor activo. (usuario_id lo
-- pone el default; esta condición es un segundo candado.)
drop policy if exists "authenticated crea sus visitas" on public.visitas;
create policy "authenticated crea sus visitas"
  on public.visitas for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and exists (select 1 from public.competidores c where c.id = competidor_id and c.activo)
  );
-- Sin reglas de UPDATE ni DELETE en visitas: nadie las cambia ni las borra desde
-- la app. El admin corrige la tienda con admin_cambiar_competidor (BLOQUE 6).

-- fotos: ver las de sus visitas; el admin ve todas.
drop policy if exists "authenticated lee fotos de sus visitas" on public.fotos;
create policy "authenticated lee fotos de sus visitas"
  on public.fotos for select to authenticated
  using (
    (select public.es_admin())
    or exists (select 1 from public.visitas v
               where v.id = visita_id and v.usuario_id = (select auth.uid()))
  );

-- fotos: registrar una foto, solo en sus visitas (el admin, en cualquiera).
-- La ruta ya la revisa el constraint fotos_ruta_en_su_visita (001).
drop policy if exists "authenticated crea fotos en sus visitas" on public.fotos;
create policy "authenticated crea fotos en sus visitas"
  on public.fotos for insert to authenticated
  with check (
    subida_por = (select auth.uid())
    and (
      (select public.es_admin())
      or exists (select 1 from public.visitas v
                 where v.id = visita_id and v.usuario_id = (select auth.uid()))
    )
  );

-- fotos: quitar (descartar). Igual que la regla de anon de 007, pero solo en sus
-- visitas (el admin, en cualquiera):
--   using      → solo fotos 'pendiente' y todavía no quitadas.
--   with check → deben quedar con descartada_at NO vacío (no se puede restaurar).
-- Con el GRANT del BLOQUE 3, lo único que se puede cambiar es descartada_at, y el
-- trigger de 007 pone la hora del servidor. Restaurar: admin_restaurar_foto.
drop policy if exists "authenticated descarta fotos pendientes de sus visitas" on public.fotos;
create policy "authenticated descarta fotos pendientes de sus visitas"
  on public.fotos for update to authenticated
  using (
    estado_proceso = 'pendiente'
    and descartada_at is null
    and (
      (select public.es_admin())
      or exists (select 1 from public.visitas v
                 where v.id = visita_id and v.usuario_id = (select auth.uid()))
    )
  )
  with check (
    estado_proceso = 'pendiente'
    and descartada_at is not null
    and (
      (select public.es_admin())
      or exists (select 1 from public.visitas v
                 where v.id = visita_id and v.usuario_id = (select auth.uid()))
    )
  );
-- Sin regla de DELETE en fotos: nadie borra.


-- -----------------------------------------------------------------------------
-- BLOQUE 5. Reglas de Storage (bucket "fotos") para authenticated.
--   Leer  → solo archivos de la carpeta de una visita SUYA (el admin, todos).
--           Hace falta para pedir URLs firmadas (la app nueva las usa siempre,
--           con el bucket público o privado).
--   Subir → solo a visitas/<uuid de SU visita>/<uuid>.<jpg|jpeg|png|webp>
--           (el admin, a cualquier visita que exista).
--   Sin reglas de UPDATE ni DELETE: nadie reemplaza ni borra archivos.
-- El nombre de la carpeta se compara como texto (v.id::text) para no fallar si
-- alguien manda un nombre que no es un UUID.
-- -----------------------------------------------------------------------------
drop policy if exists "authenticated lee fotos de sus visitas" on storage.objects;
create policy "authenticated lee fotos de sus visitas"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'fotos'
    and (
      (select public.es_admin())
      or exists (select 1 from public.visitas v
                 where v.usuario_id = (select auth.uid())
                   and split_part(name, '/', 1) = 'visitas'
                   and v.id::text = split_part(name, '/', 2))
    )
  );

drop policy if exists "authenticated sube fotos a sus visitas" on storage.objects;
create policy "authenticated sube fotos a sus visitas"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and name ~ '^visitas/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
    and exists (
      select 1 from public.visitas v
      where v.id::text = split_part(name, '/', 2)
        and (v.usuario_id = (select auth.uid()) or (select public.es_admin()))
    )
  );


-- -----------------------------------------------------------------------------
-- BLOQUE 6. Funciones del admin (lo que el admin puede hacer DESDE LA APP).
-- Cada una:
--   - es "security definer" (se salta las reglas RLS y los GRANT de columna),
--     por eso lo PRIMERO que hace es revisar es_admin(); si no, error 42501
--     "Solo el administrador…";
--   - usa search_path vacío y nombres completos (public.…) para que nadie la
--     engañe con tablas de otro esquema;
--   - solo la puede llamar authenticated (anon no).
-- Lo demás (borrar, editar ubicación, etc.) se sigue haciendo en el panel.
-- -----------------------------------------------------------------------------

-- 6a. Corregir la tienda de una visita (solo a un competidor activo).
create or replace function public.admin_cambiar_competidor(p_visita_id uuid, p_competidor_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador puede corregir la tienda de una visita'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.competidores c where c.id = p_competidor_id and c.activo) then
    raise exception 'La tienda elegida no existe o no está activa' using errcode = '22023';
  end if;

  update public.visitas set competidor_id = p_competidor_id where id = p_visita_id;
  if not found then
    raise exception 'La visita no existe' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.admin_cambiar_competidor(uuid, bigint) is
  'Admin: cambia el competidor de una visita (solo a uno activo). Revisa es_admin().';

-- 6b. Restaurar una foto quitada (descartada_at → null). Si ya estaba a la
-- vista, no hace nada (no es error).
create or replace function public.admin_restaurar_foto(p_foto_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador puede restaurar fotos' using errcode = '42501';
  end if;

  update public.fotos set descartada_at = null
  where id = p_foto_id and descartada_at is not null;

  if not found and not exists (select 1 from public.fotos where id = p_foto_id) then
    raise exception 'La foto no existe' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.admin_restaurar_foto(uuid) is
  'Admin: vuelve a poner a la vista una foto quitada (descartada_at = null). Revisa es_admin().';

-- 6c. Correo de cada cuenta, para mostrar quién creó cada visita. La app no
-- puede leer auth.users directamente (y no debe): solo el admin, por aquí.
create or replace function public.admin_correos_usuarios()
returns table (usuario_id uuid, correo text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador puede ver los correos' using errcode = '42501';
  end if;

  return query
    select u.id, u.email::text
    from auth.users u
    order by u.email;
end;
$$;

comment on function public.admin_correos_usuarios() is
  'Admin: id y correo de cada cuenta (para mostrar quién creó cada visita). Revisa es_admin().';

revoke all on function public.admin_cambiar_competidor(uuid, bigint) from public, anon;
revoke all on function public.admin_restaurar_foto(uuid)              from public, anon;
revoke all on function public.admin_correos_usuarios()                from public, anon;
grant execute on function public.admin_cambiar_competidor(uuid, bigint) to authenticated, service_role;
grant execute on function public.admin_restaurar_foto(uuid)              to authenticated, service_role;
grant execute on function public.admin_correos_usuarios()                to authenticated, service_role;


-- -----------------------------------------------------------------------------
-- BLOQUE 7. Etapa 2: NO se toca. Sus tablas, vistas y funciones siguen cerradas
-- para anon Y authenticated (también para el admin dentro de la app). La
-- comprobación de abajo lo revisa.
-- Avisa a la API de Supabase que hay columnas y funciones nuevas.
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';


-- -----------------------------------------------------------------------------
-- BLOQUE 8. Comprobación (solo lee; no cambia nada).
-- Todas las filas deben salir con ok = true.
-- -----------------------------------------------------------------------------
select 'visitas.usuario_id: uuid, default auth.uid(), al borrar la cuenta queda null' as comprobacion,
       exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'visitas'
                 and column_name = 'usuario_id' and data_type = 'uuid'
                 and column_default like '%auth.uid()%')
       and exists (select 1 from pg_constraint
                   where conrelid = 'public.visitas'::regclass and contype = 'f'
                     and confrelid = 'auth.users'::regclass and confdeltype = 'n') as ok
union all
select 'fotos.subida_por: uuid, default auth.uid(), al borrar la cuenta queda null',
       exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'fotos'
                 and column_name = 'subida_por' and data_type = 'uuid'
                 and column_default like '%auth.uid()%')
       and exists (select 1 from pg_constraint
                   where conrelid = 'public.fotos'::regclass and contype = 'f'
                     and confrelid = 'auth.users'::regclass and confdeltype = 'n')
union all
select 'Índices en visitas.usuario_id y fotos.subida_por',
       to_regclass('public.visitas_usuario_id_idx') is not null
       and to_regclass('public.fotos_subida_por_idx') is not null
union all
select 'Nadie desde la app puede mandar el dueño (sin INSERT/UPDATE de usuario_id ni subida_por)',
       not has_column_privilege('authenticated', 'public.visitas', 'usuario_id', 'INSERT')
       and not has_column_privilege('authenticated', 'public.visitas', 'usuario_id', 'UPDATE')
       and not has_column_privilege('authenticated', 'public.fotos', 'subida_por', 'INSERT')
       and not has_column_privilege('authenticated', 'public.fotos', 'subida_por', 'UPDATE')
       and not has_column_privilege('anon', 'public.visitas', 'usuario_id', 'INSERT')
       and not has_column_privilege('anon', 'public.fotos', 'subida_por', 'INSERT')
union all
select 'authenticated: lee las 3 tablas y crea visitas/fotos con sus columnas',
       has_table_privilege('authenticated', 'public.competidores', 'SELECT')
       and has_table_privilege('authenticated', 'public.visitas', 'SELECT')
       and has_table_privilege('authenticated', 'public.fotos', 'SELECT')
       and has_column_privilege('authenticated', 'public.visitas', 'competidor_id', 'INSERT')
       and has_column_privilege('authenticated', 'public.visitas', 'ubicacion_at', 'INSERT')
       and has_column_privilege('authenticated', 'public.fotos', 'ruta', 'INSERT')
       and has_column_privilege('authenticated', 'public.fotos', 'capturada_origen', 'INSERT')
union all
select 'authenticated: NO crea visitas/fotos con id, created_at, estado ni descartada_at',
       not has_column_privilege('authenticated', 'public.visitas', 'id', 'INSERT')
       and not has_column_privilege('authenticated', 'public.visitas', 'created_at', 'INSERT')
       and not has_column_privilege('authenticated', 'public.fotos', 'id', 'INSERT')
       and not has_column_privilege('authenticated', 'public.fotos', 'estado_proceso', 'INSERT')
       and not has_column_privilege('authenticated', 'public.fotos', 'descartada_at', 'INSERT')
union all
select 'authenticated: en fotos SOLO puede cambiar descartada_at',
       has_column_privilege('authenticated', 'public.fotos', 'descartada_at', 'UPDATE')
       and not exists (select 1 from information_schema.columns c
                       where c.table_schema = 'public' and c.table_name = 'fotos'
                         and c.column_name <> 'descartada_at'
                         and has_column_privilege('authenticated', 'public.fotos', c.column_name, 'UPDATE'))
union all
select 'authenticated: NO cambia competidores ni visitas, y NO borra en ninguna de las 3',
       not has_any_column_privilege('authenticated', 'public.competidores', 'INSERT, UPDATE')
       and not has_any_column_privilege('authenticated', 'public.visitas', 'UPDATE')
       and not has_table_privilege('authenticated', 'public.competidores', 'DELETE, TRUNCATE')
       and not has_table_privilege('authenticated', 'public.visitas', 'DELETE, TRUNCATE')
       and not has_table_privilege('authenticated', 'public.fotos', 'DELETE, TRUNCATE')
union all
select 'RLS activado en competidores, visitas y fotos',
       (select bool_and(relrowsecurity) from pg_class
        where oid in ('public.competidores'::regclass, 'public.visitas'::regclass, 'public.fotos'::regclass))
union all
select 'Las 6 reglas de authenticated existen (competidores 1, visitas 2, fotos 3)',
       (select count(*) = 6 from pg_policies
        where schemaname = 'public' and roles = array['authenticated']::name[]
          and policyname in ('authenticated lee competidores',
                             'authenticated lee sus visitas',
                             'authenticated crea sus visitas',
                             'authenticated lee fotos de sus visitas',
                             'authenticated crea fotos en sus visitas',
                             'authenticated descarta fotos pendientes de sus visitas'))
union all
select 'Ninguna regla de UPDATE/DELETE en visitas, y ninguna de DELETE en fotos',
       not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = 'visitas'
                     and cmd in ('UPDATE', 'DELETE', 'ALL'))
       and not exists (select 1 from pg_policies
                       where schemaname = 'public' and tablename = 'fotos'
                         and cmd in ('DELETE', 'ALL'))
union all
select 'La regla de quitar fotos de authenticated: solo pendientes y sin restaurar',
       exists (select 1 from pg_policies
               where schemaname = 'public' and tablename = 'fotos'
                 and policyname = 'authenticated descarta fotos pendientes de sus visitas'
                 and cmd = 'UPDATE'
                 and qual like '%pendiente%' and qual like '%descartada_at IS NULL%'
                 and with_check like '%descartada_at IS NOT NULL%')
union all
select 'Storage: authenticated lee y sube en "fotos" (2 reglas)',
       (select count(*) = 2 from pg_policies
        where schemaname = 'storage' and tablename = 'objects'
          and roles = array['authenticated']::name[]
          and policyname in ('authenticated lee fotos de sus visitas',
                             'authenticated sube fotos a sus visitas'))
union all
select 'Storage: nadie (anon ni authenticated) puede reemplazar ni borrar archivos',
       not exists (select 1 from pg_policies
                   where schemaname = 'storage' and tablename = 'objects'
                     and cmd in ('UPDATE', 'DELETE', 'ALL')
                     and roles && array['anon', 'authenticated', 'public']::name[])
union all
select 'es_admin(): authenticated SÍ la puede usar, anon NO',
       has_function_privilege('authenticated', 'public.es_admin()', 'EXECUTE')
       and not has_function_privilege('anon', 'public.es_admin()', 'EXECUTE')
union all
select 'es_admin() lee app_metadata (no user_metadata)',
       pg_get_functiondef('public.es_admin()'::regprocedure) like '%app_metadata%'
       and pg_get_functiondef('public.es_admin()'::regprocedure) not like '%user_metadata%'
union all
select 'Las 3 funciones del admin: security definer, authenticated SÍ, anon NO',
       (select count(*) = 3 from pg_proc p
        where p.oid in ('public.admin_cambiar_competidor(uuid, bigint)'::regprocedure,
                        'public.admin_restaurar_foto(uuid)'::regprocedure,
                        'public.admin_correos_usuarios()'::regprocedure)
          and p.prosecdef
          and has_function_privilege('authenticated', p.oid, 'EXECUTE')
          and not has_function_privilege('anon', p.oid, 'EXECUTE'))
union all
select 'Etapa 2: ninguna tabla o vista nueva abierta para anon ni authenticated',
       not exists (
         select 1 from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')
           and c.relname not in ('competidores', 'visitas', 'fotos')
           and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
           and (has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
                or has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')))
union all
select 'Etapa 2: ninguna función abierta para anon ni authenticated (salvo es_admin y admin_*)',
       not exists (
         select 1 from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname not in ('es_admin', 'admin_cambiar_competidor',
                                 'admin_restaurar_foto', 'admin_correos_usuarios')
           and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
           and (has_function_privilege('anon', p.oid, 'EXECUTE')
                or has_function_privilege('authenticated', p.oid, 'EXECUTE')))
union all
select 'La app actual (anon) sigue funcionando: lee y crea visitas y fotos',
       has_table_privilege('anon', 'public.visitas', 'SELECT')
       and has_column_privilege('anon', 'public.visitas', 'competidor_id', 'INSERT')
       and has_table_privilege('anon', 'public.fotos', 'SELECT')
       and has_column_privilege('anon', 'public.fotos', 'ruta', 'INSERT')
       and exists (select 1 from pg_policies
                   where schemaname = 'storage' and tablename = 'objects'
                     and policyname = 'anon sube fotos al bucket');
