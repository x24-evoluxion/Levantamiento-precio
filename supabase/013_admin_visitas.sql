-- =============================================================================
-- 013_admin_visitas.sql — El admin reasigna visitas y corrige su ubicación, con
-- auditoría (ADITIVA, va DESPUÉS de 012)
-- =============================================================================
-- Cómo usarlo: copia TODO este archivo en Supabase → SQL Editor → Run.
-- Se puede ejecutar más de una vez sin romper nada ("if not exists",
-- "create or replace", "drop trigger if exists" + "create trigger" dentro de la
-- misma transacción). Si algo falla, no se cambia nada. NO edita 001–012.
--
-- Decisiones del usuario (2026-11-26):
--   (a) El admin puede REASIGNAR una visita a otro colaborador (cambiar el dueño).
--   (b) El admin puede CORREGIR la ubicación de una visita; la app muestra
--       "Ubicación corregida por administrador", quién y cuándo.
--   (c) Auditoría en visitas: último cambio (quién y cuándo), quién y cuándo se
--       corrigió la ubicación, y la ubicación ORIGINAL del celular (antes de la
--       primera corrección). Todo lo pone la base; la app no lo puede escribir.
--
-- Qué hace:
--   BLOQUE 0. Freno: si falta 012 (o 008/008b), se detiene sin cambiar nada.
--   BLOQUE 1. Columnas nuevas en visitas (auditoría y ubicación original).
--   BLOQUE 2. Trigger visitas_auditoria: llena esas columnas en cada cambio.
--   BLOQUE 3. Funciones del admin: admin_reasignar_visita y
--             admin_corregir_ubicacion (security definer, revisan es_admin()).
--   BLOQUE 4. Permisos: la app NO recibe permiso de escribir ninguna columna
--             nueva, ni usuario_id, ni la ubicación. Sin DELETE. anon nada.
--   BLOQUE 5. Comprobación (solo lee).
--
-- Lo que NO cambia: ninguna regla RLS (ni de visitas, fotos, productos o
-- Storage) y ningún permiso por columna existente. Por eso no hay riesgo de
-- "infinite recursion": no se agrega ninguna regla.
--
-- POR QUÉ FUNCIONES Y NO PERMISO DE COLUMNA: si authenticated tuviera permiso de
-- UPDATE en usuario_id o en la ubicación, la única barrera serían las reglas
-- RLS. Con funciones, NADIE de la app tiene ese permiso; la función es la única
-- puerta, revisa es_admin() y valida los datos (persona existente, coordenadas
-- en rango) antes de cambiar nada.
--
-- Efecto en la app publicada (antes del push): sigue funcionando igual. Las
-- columnas nuevas no las usa; los cambios que ya hace (tienda, borrar,
-- restaurar) ahora además dejan quién y cuándo.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- BLOQUE 0. Freno. Usa cosas de 008, 008b y 012.
-- -----------------------------------------------------------------------------
do $$
declare
  v_faltan text[] := array[]::text[];
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'visitas'
                   and column_name = 'descartada_at') then
    v_faltan := v_faltan || 'columna visitas.descartada_at (migración 012)'::text;
  end if;
  if to_regprocedure('public.visitas_proteger_cambios()') is null
     or to_regprocedure('privado.visita_sin_fotos_leidas(uuid)') is null then
    v_faltan := v_faltan || 'trigger y funciones de la migración 012'::text;
  end if;
  if to_regprocedure('public.es_admin()') is null
     or to_regprocedure('public.admin_correos_usuarios()') is null then
    v_faltan := v_faltan || 'funciones de admin (migración 008)'::text;
  end if;
  if to_regprocedure('privado.es_dueno_de_visita(uuid)') is null then
    v_faltan := v_faltan || 'funciones privado.* (migración 008b)'::text;
  end if;

  if cardinality(v_faltan) > 0 then
    raise exception using
      message = 'Falta: ' || array_to_string(v_faltan, ', ') || '. No se cambió nada.',
      detail  = format('Base: %s · rol: %s', current_database(), current_user),
      hint    = 'Ejecuta primero 012 (y su prueba) en este mismo proyecto; después vuelve a '
                || 'ejecutar este archivo.';
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- BLOQUE 1. Columnas nuevas en visitas. Todas empiezan vacías (las visitas que
-- ya existen quedan "sin cambios registrados" y "ubicación sin corregir").
--   actualizado_at / actualizado_por: último cambio de la visita (tienda,
--     borrar, restaurar, dueño o ubicación). Vacías = nunca se cambió.
--   ubicacion_corregida_at / ubicacion_corregida_por: última corrección de la
--     ubicación. Vacías = la ubicación es la que guardó el celular.
--   ubicacion_original_*: la ubicación que guardó el celular, copiada en la
--     PRIMERA corrección y nunca más cambiada. Si la visita no tenía ubicación,
--     quedan vacías aunque se haya corregido.
-- -----------------------------------------------------------------------------
alter table public.visitas
  add column if not exists actualizado_at                   timestamptz,
  add column if not exists actualizado_por                  uuid references auth.users (id) on delete set null,
  add column if not exists ubicacion_corregida_at           timestamptz,
  add column if not exists ubicacion_corregida_por          uuid references auth.users (id) on delete set null,
  add column if not exists ubicacion_original_latitud       double precision,
  add column if not exists ubicacion_original_longitud      double precision,
  add column if not exists ubicacion_original_precision_metros double precision,
  add column if not exists ubicacion_original_at            timestamptz;

comment on column public.visitas.actualizado_at is
  '013: hora (servidor) del último cambio de la visita. La pone un trigger.';
comment on column public.visitas.actualizado_por is
  '013: quién hizo el último cambio (auth.uid()). La pone un trigger; la app no la manda.';
comment on column public.visitas.ubicacion_corregida_at is
  '013: hora (servidor) de la última corrección de ubicación. Nula = ubicación del celular.';
comment on column public.visitas.ubicacion_corregida_por is
  '013: quién corrigió la ubicación (auth.uid()). La pone un trigger.';
comment on column public.visitas.ubicacion_original_latitud is
  '013: latitud que guardó el celular, copiada en la PRIMERA corrección. No cambia después.';
comment on column public.visitas.ubicacion_original_longitud is
  '013: longitud que guardó el celular, copiada en la PRIMERA corrección. No cambia después.';
comment on column public.visitas.ubicacion_original_precision_metros is
  '013: precisión original del celular, copiada en la PRIMERA corrección.';
comment on column public.visitas.ubicacion_original_at is
  '013: ubicacion_at original (reloj del celular), copiada en la PRIMERA corrección.';


-- -----------------------------------------------------------------------------
-- BLOQUE 2. Trigger de auditoría ("before": cambia la fila ANTES de guardarla,
-- sin importar lo que mande quien actualiza).
--   - Al CREAR una visita: todas las columnas de 013 vacías (nadie las falsea).
--   - En CADA cambio: actualizado_at = now() y actualizado_por = auth.uid().
--   - Si cambió la ubicación (latitud, longitud, precisión u hora): se marca
--     corregida (now(), auth.uid()) y, si es la PRIMERA corrección, se copia la
--     ubicación anterior a ubicacion_original_*.
--   - Si NO cambió la ubicación: las columnas de corrección y original se
--     quedan como estaban (nadie las falsea, ni siquiera mandándolas).
-- Desde el SQL Editor o el panel auth.uid() es nulo: el cambio queda con hora
-- pero sin persona (la app lo muestra como "desde el panel").
-- No es security definer: no lee ninguna tabla.
-- -----------------------------------------------------------------------------
create or replace function public.visitas_auditoria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.actualizado_at                      := null;
    new.actualizado_por                     := null;
    new.ubicacion_corregida_at              := null;
    new.ubicacion_corregida_por             := null;
    new.ubicacion_original_latitud          := null;
    new.ubicacion_original_longitud         := null;
    new.ubicacion_original_precision_metros := null;
    new.ubicacion_original_at               := null;
    return new;
  end if;

  -- Lo original nunca se cambia a mano: se parte de lo que ya había.
  new.ubicacion_original_latitud          := old.ubicacion_original_latitud;
  new.ubicacion_original_longitud         := old.ubicacion_original_longitud;
  new.ubicacion_original_precision_metros := old.ubicacion_original_precision_metros;
  new.ubicacion_original_at               := old.ubicacion_original_at;

  if (new.latitud, new.longitud, new.precision_metros, new.ubicacion_at)
     is distinct from
     (old.latitud, old.longitud, old.precision_metros, old.ubicacion_at) then
    -- Primera corrección: se guarda la ubicación que había puesto el celular.
    if old.ubicacion_corregida_at is null then
      new.ubicacion_original_latitud          := old.latitud;
      new.ubicacion_original_longitud         := old.longitud;
      new.ubicacion_original_precision_metros := old.precision_metros;
      new.ubicacion_original_at               := old.ubicacion_at;
    end if;
    new.ubicacion_corregida_at  := now();
    new.ubicacion_corregida_por := (select auth.uid());
  else
    new.ubicacion_corregida_at  := old.ubicacion_corregida_at;
    new.ubicacion_corregida_por := old.ubicacion_corregida_por;
  end if;

  new.actualizado_at  := now();
  new.actualizado_por := (select auth.uid());
  return new;
end;
$$;

drop trigger if exists visitas_auditoria on public.visitas;
create trigger visitas_auditoria
  before insert or update on public.visitas
  for each row execute function public.visitas_auditoria();

-- Un trigger no necesita permiso de ejecución de quien actualiza: se cierra.
revoke all on function public.visitas_auditoria() from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- BLOQUE 3. Funciones del admin (como las de 008):
--   - security definer: cambian la visita con permisos del dueño de la función
--     (la app no tiene permiso de esas columnas);
--   - lo PRIMERO que hacen es revisar public.es_admin() → si no, error 42501
--     "Solo el administrador…";
--   - search_path vacío y nombres completos (public.…, auth.…): nadie las engaña
--     con tablas de otro esquema;
--   - solo authenticated (y service_role) las pueden llamar; anon no.
-- El trigger del BLOQUE 2 registra quién y cuándo (auth.uid() sigue siendo
-- quien llamó, aunque la función corra como su dueño).
-- -----------------------------------------------------------------------------

-- 3a. Reasignar una visita a otra persona. La visita (con sus fotos y
-- productos) deja de verla quien la tenía y pasa a verla la persona nueva. Los
-- productos y fotos conservan a su AUTOR (capturas_manuales.usuario_id,
-- fotos.subida_por): es un dato de quién los capturó, no de quién es la visita.
create or replace function public.admin_reasignar_visita(p_visita_id uuid, p_usuario_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador puede reasignar visitas' using errcode = '42501';
  end if;

  if p_usuario_id is null
     or not exists (select 1 from auth.users u where u.id = p_usuario_id) then
    raise exception 'La persona elegida no existe' using errcode = '22023';
  end if;

  update public.visitas set usuario_id = p_usuario_id where id = p_visita_id;
  if not found then
    raise exception 'La visita no existe' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.admin_reasignar_visita(uuid, uuid) is
  '013 Admin: cambia el dueño de una visita a una cuenta existente. Revisa es_admin().';

-- 3b. Corregir la ubicación de una visita. Latitud y longitud obligatorias y en
-- rango (también rechaza NaN e infinito); precisión opcional (nula = no se sabe,
-- por ejemplo si se copió de un mapa). ubicacion_at pasa a ser la hora de la
-- corrección (servidor); la del celular queda en ubicacion_original_at.
create or replace function public.admin_corregir_ubicacion(
  p_visita_id uuid,
  p_latitud double precision,
  p_longitud double precision,
  p_precision_metros double precision default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador puede corregir la ubicación' using errcode = '42501';
  end if;

  if p_latitud is null or p_longitud is null
     or p_latitud  = 'NaN'::double precision or p_longitud = 'NaN'::double precision
     or p_latitud  not between -90  and 90
     or p_longitud not between -180 and 180 then
    raise exception 'Latitud o longitud fuera de rango' using errcode = '22023';
  end if;

  if p_precision_metros is not null
     and (p_precision_metros = 'NaN'::double precision
          or p_precision_metros < 0
          or p_precision_metros = 'Infinity'::double precision) then
    raise exception 'La precisión no es válida' using errcode = '22023';
  end if;

  update public.visitas
  set latitud = p_latitud,
      longitud = p_longitud,
      precision_metros = p_precision_metros,
      ubicacion_at = now()
  where id = p_visita_id;
  if not found then
    raise exception 'La visita no existe' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.admin_corregir_ubicacion(uuid, double precision, double precision, double precision) is
  '013 Admin: corrige latitud/longitud (y precisión) de una visita; el trigger guarda la original y quién corrigió. Revisa es_admin().';

revoke all on function public.admin_reasignar_visita(uuid, uuid) from public, anon;
revoke all on function public.admin_corregir_ubicacion(uuid, double precision, double precision, double precision)
  from public, anon;
grant execute on function public.admin_reasignar_visita(uuid, uuid) to authenticated, service_role;
grant execute on function public.admin_corregir_ubicacion(uuid, double precision, double precision, double precision)
  to authenticated, service_role;


-- -----------------------------------------------------------------------------
-- BLOQUE 4. Permisos. NO se da ningún permiso nuevo de escritura a la app.
-- Se repite por seguridad que las columnas nuevas, el dueño y la ubicación no
-- se pueden mandar al crear ni al cambiar. (Leer: authenticated ya puede leer
-- toda la tabla visitas desde 008, pero las reglas RLS solo le dejan SUS
-- visitas; así ve si la ubicación de su visita fue corregida.)
-- La lista de columnas que authenticated puede cambiar sigue siendo la de 012:
-- competidor_id y descartada_at.
-- -----------------------------------------------------------------------------
revoke insert (actualizado_at, actualizado_por, ubicacion_corregida_at, ubicacion_corregida_por,
               ubicacion_original_latitud, ubicacion_original_longitud,
               ubicacion_original_precision_metros, ubicacion_original_at)
  on public.visitas from authenticated;
revoke update (usuario_id, latitud, longitud, precision_metros, ubicacion_at,
               actualizado_at, actualizado_por, ubicacion_corregida_at, ubicacion_corregida_por,
               ubicacion_original_latitud, ubicacion_original_longitud,
               ubicacion_original_precision_metros, ubicacion_original_at)
  on public.visitas from authenticated;

revoke delete, truncate on table public.visitas from authenticated;
revoke all on table public.visitas from anon;

commit;

-- Que la API de Supabase vea las columnas y funciones nuevas sin esperar.
notify pgrst, 'reload schema';


-- -----------------------------------------------------------------------------
-- BLOQUE 5. Comprobación (solo lee; no cambia nada).
-- Todas las filas deben salir con ok = true. Después ejecuta la prueba
-- pruebas/013_prueba_admin_visitas.sql (fila "0. RESUMEN" con ok = true).
-- -----------------------------------------------------------------------------
select '1. visitas: 8 columnas nuevas de auditoría y ubicación original' as comprobacion,
       (select count(*) = 8 from information_schema.columns
        where table_schema = 'public' and table_name = 'visitas'
          and column_name in ('actualizado_at', 'actualizado_por', 'ubicacion_corregida_at',
                              'ubicacion_corregida_por', 'ubicacion_original_latitud',
                              'ubicacion_original_longitud', 'ubicacion_original_precision_metros',
                              'ubicacion_original_at')) as ok
union all
select '2. visitas: authenticated sigue cambiando SOLO competidor_id y descartada_at',
       has_column_privilege('authenticated', 'public.visitas', 'competidor_id', 'UPDATE')
       and has_column_privilege('authenticated', 'public.visitas', 'descartada_at', 'UPDATE')
       and not exists (select 1 from information_schema.columns c
                       where c.table_schema = 'public' and c.table_name = 'visitas'
                         and c.column_name not in ('competidor_id', 'descartada_at')
                         and has_column_privilege('authenticated', 'public.visitas', c.column_name, 'UPDATE'))
union all
select '3. visitas: la app NO manda dueño, ubicación corregida ni auditoría al crear',
       not exists (select 1 from information_schema.columns c
                   where c.table_schema = 'public' and c.table_name = 'visitas'
                     and c.column_name in ('usuario_id', 'actualizado_at', 'actualizado_por',
                                           'ubicacion_corregida_at', 'ubicacion_corregida_por',
                                           'ubicacion_original_latitud', 'ubicacion_original_longitud',
                                           'ubicacion_original_precision_metros', 'ubicacion_original_at')
                     and has_column_privilege('authenticated', 'public.visitas', c.column_name, 'INSERT'))
union all
select '4. Trigger visitas_auditoria (insert y update); nadie lo ejecuta directo',
       exists (select 1 from pg_trigger
               where tgrelid = 'public.visitas'::regclass and tgname = 'visitas_auditoria' and not tgisinternal)
       and not has_function_privilege('authenticated', 'public.visitas_auditoria()', 'EXECUTE')
union all
select '5. Funciones admin_reasignar_visita y admin_corregir_ubicacion: security definer, search_path vacío, revisan es_admin()',
       (select count(*) = 2 from pg_proc p
        where p.oid in (to_regprocedure('public.admin_reasignar_visita(uuid, uuid)'),
                        to_regprocedure('public.admin_corregir_ubicacion(uuid, double precision, double precision, double precision)'))
          and p.prosecdef and p.proconfig @> array['search_path=""']
          and pg_get_functiondef(p.oid) ilike '%public.es_admin()%')
union all
select '6. authenticated sí las ejecuta; anon no',
       has_function_privilege('authenticated', 'public.admin_reasignar_visita(uuid, uuid)', 'EXECUTE')
       and has_function_privilege('authenticated', 'public.admin_corregir_ubicacion(uuid, double precision, double precision, double precision)', 'EXECUTE')
       and not has_function_privilege('anon', 'public.admin_reasignar_visita(uuid, uuid)', 'EXECUTE')
       and not has_function_privilege('anon', 'public.admin_corregir_ubicacion(uuid, double precision, double precision, double precision)', 'EXECUTE')
union all
select '7. Nadie borra visitas; anon sin nada en visitas',
       not has_table_privilege('authenticated', 'public.visitas', 'DELETE, TRUNCATE')
       and not has_table_privilege('anon', 'public.visitas', 'SELECT, INSERT, UPDATE, DELETE')
       and not has_any_column_privilege('anon', 'public.visitas', 'SELECT, INSERT, UPDATE')
union all
select '8. Reglas RLS de visitas sin cambios (4: leer, crear y las 2 de cambiar de 012) y ninguna consulta otra tabla',
       (select count(*) = 4 from pg_policies where schemaname = 'public' and tablename = 'visitas')
       and not exists (select 1 from pg_policies
                       where schemaname = 'public' and tablename in ('visitas', 'fotos', 'capturas_manuales', 'competidores')
                         and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~* '\mfrom\M');
