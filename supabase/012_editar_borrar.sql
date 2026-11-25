-- =============================================================================
-- 012_editar_borrar.sql — Editar y borrar lo capturado (ADITIVA, va DESPUÉS de 011)
-- =============================================================================
-- Cómo usarlo: copia TODO este archivo en Supabase → SQL Editor → Run.
-- Se puede ejecutar más de una vez sin romper nada ("if not exists",
-- "create or replace", "drop policy if exists" + "create policy" dentro de la
-- misma transacción: nunca hay un momento sin regla). Si algo falla, no se
-- cambia nada. NO edita 010 ni 011.
--
-- REGLAS DE NEGOCIO:
--   - BORRAR = DESCARTAR (poner descartada_at). Nunca se borra una fila: nadie
--     tiene permiso DELETE desde la app. Solo el admin restaura.
--   - Personal de campo: edita y borra SOLO lo que creó. Una fila ya borrada no
--     la puede editar ni restaurar.
--   - Admin: edita, borra y restaura todo.
--   - Lo borrado NO se le muestra al personal de campo (ni las fotos ni los
--     productos de una visita borrada). El admin sí lo ve.
--
-- Qué hace:
--   BLOQUE 0. Freno: si falta 011 (o 010, 008b), se detiene sin cambiar nada.
--   BLOQUE 1. Columnas nuevas: visitas.descartada_at;
--             capturas_manuales.actualizado_at y actualizado_por.
--   BLOQUE 2. Funciones de privado: lo borrado deja de contar como "mío", y una
--             nueva para saber si una visita tiene fotos ya leídas.
--   BLOQUE 3. Triggers: hora del servidor, quién editó, y "al borrar no se cambia
--             el contenido".
--   BLOQUE 4. Permisos POR COLUMNA (las reglas filtran filas, no columnas).
--   BLOQUE 5. Reglas RLS de visitas, capturas_manuales y fotos.
--   BLOQUE 6. Comprobación (solo lee).
--
-- POR QUÉ "descartada_at = now()" EN LAS REGLAS DE LECTURA:
--   En Postgres, cuando un UPDATE filtra por columnas (where id = …) o devuelve
--   la fila (returning, o .select() en supabase-js), la fila NUEVA también debe
--   pasar la regla de lectura. Si la regla escondiera TODO lo borrado, el propio
--   "Borrar" fallaría con "new row violates row-level security policy".
--   Solución: la persona ve una fila borrada SOLO dentro de la misma operación
--   que la borró. now() es la hora de INICIO de la transacción (fija durante
--   toda ella), y el trigger pone descartada_at = now(). En cualquier consulta
--   posterior now() ya es otra hora: la fila deja de verse.
--
-- Efecto en la app publicada (la de 010/011): sigue funcionando. No usa las
-- columnas nuevas; su "Quitar" de productos sigue siendo un update de
-- descartada_at (permitido). Lo único que cambia para ella: las visitas
-- borradas con la app nueva ya no le aparecen al personal de campo.
--
-- ⚠️ Comprobaciones y pruebas viejas que cambian (es normal; ver PROGRESO.md,
-- "Editar y borrar lo capturado"):
--   - 008: su comprobación "authenticated: NO manda el dueño, solo cambia
--     descartada_at, no borra" marca false (ahora también cambia
--     visitas.competidor_id y visitas.descartada_at).
--   - 010: fila 4 ("solo cambia descartada_at") y fila 6 ("Las 3 reglas") false.
--   - 011: fila 7 ("…sin UPDATE de articulo_de_lista…") y fila 8 ("Reglas RLS
--     sin cambios") false.
--   - Pruebas 010b y 011: algunos casos esperan "no se puede editar"; ya no
--     se corren después de 012. La prueba vigente es pruebas/012_prueba_editar_borrar.sql.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- BLOQUE 0. Freno. Usa cosas de 008b, 010 y 011.
-- -----------------------------------------------------------------------------
do $$
declare
  v_faltan text[] := array[]::text[];
begin
  if to_regclass('public.capturas_manuales') is null then
    v_faltan := v_faltan || 'tabla public.capturas_manuales (migración 010)'::text;
  elsif not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'capturas_manuales'
                      and column_name = 'promo_precio_pieza') then
    v_faltan := v_faltan || 'columna capturas_manuales.promo_precio_pieza (migración 011)'::text;
  end if;
  if to_regprocedure('public.articulos_captura()') is null then
    v_faltan := v_faltan || 'función public.articulos_captura() (migración 011)'::text;
  end if;
  if to_regprocedure('privado.es_dueno_de_visita(uuid)') is null
     or to_regprocedure('privado.competidor_activo(bigint)') is null then
    v_faltan := v_faltan || 'funciones privado.* (migración 008b)'::text;
  end if;
  if to_regprocedure('public.capturas_manuales_hora_descarte()') is null then
    v_faltan := v_faltan || 'trigger de capturas_manuales (migración 010)'::text;
  end if;

  if cardinality(v_faltan) > 0 then
    raise exception using
      message = 'Falta: ' || array_to_string(v_faltan, ', ') || '. No se cambió nada.',
      detail  = format('Base: %s · rol: %s', current_database(), current_user),
      hint    = 'Ejecuta primero 010 (y su prueba 010b) y 011 (y su prueba 011) en este mismo '
                || 'proyecto; después vuelve a ejecutar este archivo.';
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- BLOQUE 1. Columnas nuevas.
--   visitas.descartada_at: hora (del servidor) en que la visita se BORRÓ. Nula =
--     a la vista. Su dueño la puede borrar; solo el admin la restaura.
--   capturas_manuales.actualizado_at / actualizado_por: cuándo y quién la editó
--     por última vez (incluye borrar y restaurar). Los pone un trigger con la
--     hora del servidor y auth.uid(); la app NO tiene permiso de mandarlas.
--     Vacías = nunca se editó.
-- -----------------------------------------------------------------------------
alter table public.visitas
  add column if not exists descartada_at timestamptz;

comment on column public.visitas.descartada_at is
  '012: hora (servidor) en que la visita se borró desde la app. Nula = a la vista. Solo el admin la restaura.';

alter table public.capturas_manuales
  add column if not exists actualizado_at  timestamptz,
  add column if not exists actualizado_por uuid references auth.users (id) on delete set null;

comment on column public.capturas_manuales.actualizado_at is
  '012: hora (servidor) de la última edición, borrado o restauración. La pone un trigger.';
comment on column public.capturas_manuales.actualizado_por is
  '012: quién hizo la última edición (auth.uid()). La pone un trigger; la app no la manda.';


-- -----------------------------------------------------------------------------
-- BLOQUE 2. Funciones del esquema privado (security definer, search_path vacío).
-- Leen tablas SIN aplicar sus reglas RLS: así ninguna regla consulta otra tabla
-- con RLS (eso causó el "infinite recursion" de 008). Solo responden sí/no sobre
-- quien consulta; nunca devuelven datos de las filas.
-- "create or replace" conserva los permisos que ya tenían (008b).
-- -----------------------------------------------------------------------------

-- 2a. ¿La visita es mía Y no está borrada? (una visita borrada deja de ser
-- "mía" para todo: no veo sus fotos ni productos, no subo ni escribo en ella).
-- Lo usan las reglas de fotos, Storage y capturas_manuales (vía 2b).
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
      and v.descartada_at is null
  );
$$;

comment on function privado.es_dueno_de_visita(uuid) is
  'true si la visita existe, es de quien consulta y NO está borrada (012). Lee visitas sin RLS.';

-- 2b. puede_usar_visita (008b) no cambia de texto: "mía (2a) o soy admin y la
-- visita existe". Con 2a, el admin sigue viendo todo, también lo borrado.

-- 2c. ¿La tienda aparece en una visita que YO puedo ver? Igual que 008b, pero
-- sin contar mis visitas borradas (el admin, todas).
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
      and ((v.usuario_id = (select auth.uid()) and v.descartada_at is null)
           or (select public.es_admin()))
  );
$$;

comment on function privado.competidor_en_visita_visible(bigint) is
  'true si la tienda aparece en una visita de quien consulta no borrada (o en cualquiera, si es admin). Lee visitas sin RLS (012).';

-- 2d. NUEVA. ¿La visita NO tiene ninguna foto ya leída por un agente? true si
-- todas sus fotos (también las quitadas) siguen en 'pendiente', o si no tiene
-- fotos. Lee fotos SIN RLS. Solo para el dueño: sin esto podría cambiar la
-- tienda o borrar una visita cuyos precios ya entraron a la Etapa 2.
create or replace function privado.visita_sin_fotos_leidas(p_visita_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.fotos f
    where f.visita_id = p_visita_id
      and f.estado_proceso is distinct from 'pendiente'
  );
$$;

comment on function privado.visita_sin_fotos_leidas(uuid) is
  '012: true si ninguna foto de la visita salió de ''pendiente'' (ningún agente la leyó). Lee fotos sin RLS.';

revoke all on function privado.visita_sin_fotos_leidas(uuid) from public, anon;
grant execute on function privado.visita_sin_fotos_leidas(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- BLOQUE 3. Triggers ("before update": cambian o rechazan la fila ANTES de
-- guardarla, sin importar lo que mande la app).
-- -----------------------------------------------------------------------------

-- 3a. capturas_manuales: reemplaza el trigger de 010 (mismo nombre y misma
-- función; "create or replace" solo cambia lo que hace).
--   - descartada_at: al borrar, SIEMPRE la hora del servidor (now()). Si la fila
--     ya estaba borrada, se conserva su hora (nadie la falsea). Restaurar
--     (null) solo lo deja pasar la regla del admin (BLOQUE 5).
--   - Al borrar no se puede cambiar el contenido en la MISMA operación.
--   - actualizado_at / actualizado_por: en cada UPDATE, now() y auth.uid().
--     Al crear, vacías.
create or replace function public.capturas_manuales_hora_descarte()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.descartada_at is not null then
      new.descartada_at := now();
    end if;
    new.actualizado_at  := null;
    new.actualizado_por := null;
    return new;
  end if;

  if new.descartada_at is not null then
    if old.descartada_at is null then
      new.descartada_at := now();
      if (new.articulo, new.articulo_de_lista, new.precio_regular,
          new.promo_precio_pieza, new.observaciones)
         is distinct from
         (old.articulo, old.articulo_de_lista, old.precio_regular,
          old.promo_precio_pieza, old.observaciones) then
        raise exception 'Al borrar un producto no se puede cambiar su contenido en la misma operación.'
          using errcode = '22023';
      end if;
    else
      new.descartada_at := old.descartada_at;
    end if;
  end if;

  new.actualizado_at  := now();
  new.actualizado_por := (select auth.uid());
  return new;
end;
$$;

-- 3b. visitas: NUEVO trigger.
--   - descartada_at: igual que arriba (hora del servidor; no se falsea).
--   - Al borrar no se puede cambiar la tienda en la misma operación.
--   - Si la app (rol authenticated) cambia la tienda, la nueva debe estar ACTIVA
--     (privado.competidor_activo). Va aquí y no en la regla para que el admin
--     pueda restaurar una visita aunque su tienda ya esté desactivada. Desde el
--     SQL Editor o el panel (rol postgres) no se revisa: así se corrigen datos
--     a mano, como antes.
create or replace function public.visitas_proteger_cambios()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.descartada_at is not null then
    if old.descartada_at is null then
      new.descartada_at := now();
      if new.competidor_id is distinct from old.competidor_id then
        raise exception 'Al borrar una visita no se puede cambiar su tienda en la misma operación.'
          using errcode = '22023';
      end if;
    else
      new.descartada_at := old.descartada_at;
    end if;
  end if;

  -- Solo para la app (rol authenticated). El SQL Editor y el panel (rol
  -- postgres) pueden corregir datos a mano, como antes.
  if new.competidor_id is distinct from old.competidor_id
     and current_user = 'authenticated'
     and not privado.competidor_activo(new.competidor_id) then
    raise exception 'La tienda elegida no existe o no está activa.' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists visitas_proteger_cambios on public.visitas;
create trigger visitas_proteger_cambios
  before update on public.visitas
  for each row execute function public.visitas_proteger_cambios();

-- Un trigger no necesita permiso de ejecución de quien actualiza: se cierra.
revoke all on function public.visitas_proteger_cambios()       from public, anon, authenticated;
revoke all on function public.capturas_manuales_hora_descarte() from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- BLOQUE 4. Permisos POR COLUMNA para authenticated. Las reglas RLS (BLOQUE 5)
-- dicen QUÉ FILAS; estos permisos dicen QUÉ COLUMNAS. Nada de DELETE.
--   visitas: cambiar SOLO competidor_id (la tienda) y descartada_at (borrar).
--     Nunca usuario_id, ubicación ni created_at.
--   capturas_manuales: cambiar SOLO articulo, articulo_de_lista, precio_regular,
--     promo_precio_pieza, observaciones y descartada_at. Nunca usuario_id,
--     visita_id, created_at, actualizado_at ni actualizado_por.
--   fotos: sigue SOLO descartada_at (de 008).
-- -----------------------------------------------------------------------------
grant update (competidor_id, descartada_at) on public.visitas to authenticated;

grant update (articulo, articulo_de_lista, precio_regular, promo_precio_pieza,
              observaciones, descartada_at)
  on public.capturas_manuales to authenticated;

-- Nadie borra filas desde la app (se repite por seguridad) y anon no tiene nada.
revoke delete, truncate on table public.visitas, public.fotos, public.capturas_manuales
  from authenticated;
revoke all on table public.visitas, public.fotos, public.capturas_manuales from anon;


-- -----------------------------------------------------------------------------
-- BLOQUE 5. Reglas RLS (solo authenticated). Ninguna hace subconsultas a otras
-- tablas: usan funciones de privado. Varias reglas del mismo tipo se suman
-- ("o"): basta con cumplir una.
-- -----------------------------------------------------------------------------

-- ===== visitas ================================================================
-- Leer: las mías NO borradas (o la que estoy borrando en esta operación, ver
-- encabezado); el admin, todas (también las borradas y las sin dueño).
alter policy "authenticated lee sus visitas" on public.visitas
  using (
    (usuario_id = (select auth.uid())
     and (descartada_at is null or descartada_at = now()))
    or (select public.es_admin())
  );

-- Dueño: cambiar la tienda o borrar SU visita, solo si no está borrada y si
-- ningún agente leyó sus fotos. "using" = qué filas puede tocar (si no cumple,
-- el update afecta 0 filas). "with check" = cómo debe quedar: sigue siendo suya.
-- No puede restaurar: una visita borrada no cumple el "using".
drop policy if exists "authenticated cambia tienda o borra sus visitas" on public.visitas;
create policy "authenticated cambia tienda o borra sus visitas"
  on public.visitas for update to authenticated
  using (
    usuario_id = (select auth.uid())
    and descartada_at is null
    and privado.visita_sin_fotos_leidas(id)
  )
  with check (
    usuario_id = (select auth.uid())
    and privado.visita_sin_fotos_leidas(id)
  );

-- Admin: cambiar la tienda, borrar y restaurar cualquier visita (también con
-- fotos leídas: es su decisión). La tienda nueva debe estar activa (trigger).
drop policy if exists "admin cambia, borra o restaura visitas" on public.visitas;
create policy "admin cambia, borra o restaura visitas"
  on public.visitas for update to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

-- ===== capturas_manuales =======================================================
-- Leer: las de visitas que puedo usar (mías no borradas; admin, todas), sin las
-- filas borradas (salvo la que borro en esta operación). El admin ve todo.
alter policy "authenticated lee capturas de sus visitas" on public.capturas_manuales
  using (
    privado.puede_usar_visita(visita_id)
    and (descartada_at is null or descartada_at = now() or (select public.es_admin()))
  );

-- Dueño: editar o borrar SUS filas no borradas, en SU visita no borrada. El
-- nuevo descartada_at puede ser nulo (editar) o no nulo (borrar). Restaurar:
-- imposible (una fila borrada no cumple el "using").
-- (Reemplaza a "authenticated descarta sus capturas" de 010, que solo dejaba
-- borrar.)
drop policy if exists "authenticated descarta sus capturas" on public.capturas_manuales;
drop policy if exists "authenticated edita o borra sus capturas" on public.capturas_manuales;
create policy "authenticated edita o borra sus capturas"
  on public.capturas_manuales for update to authenticated
  using (
    usuario_id = (select auth.uid())
    and descartada_at is null
    and privado.es_dueno_de_visita(visita_id)
  )
  with check (
    usuario_id = (select auth.uid())
    and privado.es_dueno_de_visita(visita_id)
  );

-- Admin: editar, borrar y restaurar cualquier fila.
drop policy if exists "admin edita, borra o restaura capturas" on public.capturas_manuales;
create policy "admin edita, borra o restaura capturas"
  on public.capturas_manuales for update to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

-- ===== fotos ===================================================================
-- El personal de campo conserva lo que tenía (quitar fotos 'pendiente' de sus
-- visitas, regla de 008b, sin cambios). NUEVO: el admin quita y restaura
-- CUALQUIER foto (también las ya leídas). La hora la pone el trigger de 007.
drop policy if exists "admin quita o restaura cualquier foto" on public.fotos;
create policy "admin quita o restaura cualquier foto"
  on public.fotos for update to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

commit;

-- Que la API de Supabase vea las columnas nuevas sin esperar.
notify pgrst, 'reload schema';


-- -----------------------------------------------------------------------------
-- BLOQUE 6. Comprobación (solo lee; no cambia nada).
-- Todas las filas deben salir con ok = true. Después ejecuta la prueba
-- pruebas/012_prueba_editar_borrar.sql (fila "0. RESUMEN" con ok = true).
-- -----------------------------------------------------------------------------
select '1. visitas.descartada_at; capturas_manuales.actualizado_at y actualizado_por' as comprobacion,
       (select count(*) = 3 from information_schema.columns
        where table_schema = 'public'
          and ((table_name = 'visitas' and column_name = 'descartada_at')
               or (table_name = 'capturas_manuales' and column_name in ('actualizado_at', 'actualizado_por')))) as ok
union all
select '2. visitas: authenticated cambia SOLO competidor_id y descartada_at',
       has_column_privilege('authenticated', 'public.visitas', 'competidor_id', 'UPDATE')
       and has_column_privilege('authenticated', 'public.visitas', 'descartada_at', 'UPDATE')
       and not exists (select 1 from information_schema.columns c
                       where c.table_schema = 'public' and c.table_name = 'visitas'
                         and c.column_name not in ('competidor_id', 'descartada_at')
                         and has_column_privilege('authenticated', 'public.visitas', c.column_name, 'UPDATE'))
union all
select '3. capturas: authenticated cambia SOLO artículo, de_lista, precios, observaciones y descartada_at',
       not exists (select 1 from information_schema.columns c
                   where c.table_schema = 'public' and c.table_name = 'capturas_manuales'
                     and has_column_privilege('authenticated', 'public.capturas_manuales', c.column_name, 'UPDATE')
                         <> (c.column_name in ('articulo', 'articulo_de_lista', 'precio_regular',
                                               'promo_precio_pieza', 'observaciones', 'descartada_at')))
union all
select '4. capturas: la app NO manda actualizado_at ni actualizado_por (ni al crear ni al editar)',
       not has_column_privilege('authenticated', 'public.capturas_manuales', 'actualizado_at', 'INSERT, UPDATE')
       and not has_column_privilege('authenticated', 'public.capturas_manuales', 'actualizado_por', 'INSERT, UPDATE')
union all
select '5. fotos: authenticated sigue cambiando SOLO descartada_at',
       not exists (select 1 from information_schema.columns c
                   where c.table_schema = 'public' and c.table_name = 'fotos'
                     and c.column_name <> 'descartada_at'
                     and has_column_privilege('authenticated', 'public.fotos', c.column_name, 'UPDATE'))
union all
select '6. Nadie borra: authenticated sin DELETE ni TRUNCATE en visitas, fotos y capturas',
       not has_table_privilege('authenticated', 'public.visitas', 'DELETE, TRUNCATE')
       and not has_table_privilege('authenticated', 'public.fotos', 'DELETE, TRUNCATE')
       and not has_table_privilege('authenticated', 'public.capturas_manuales', 'DELETE, TRUNCATE')
       and not exists (select 1 from pg_policies
                       where schemaname = 'public' and tablename in ('visitas', 'fotos', 'capturas_manuales')
                         and cmd in ('DELETE', 'ALL'))
union all
select '7. anon: ningún permiso ni regla en visitas, fotos y capturas',
       not has_table_privilege('anon', 'public.visitas', 'SELECT, INSERT, UPDATE, DELETE')
       and not has_table_privilege('anon', 'public.fotos', 'SELECT, INSERT, UPDATE, DELETE')
       and not has_table_privilege('anon', 'public.capturas_manuales', 'SELECT, INSERT, UPDATE, DELETE')
       and not has_any_column_privilege('anon', 'public.visitas', 'SELECT, INSERT, UPDATE')
       and not has_any_column_privilege('anon', 'public.capturas_manuales', 'SELECT, INSERT, UPDATE')
       and not exists (select 1 from pg_policies
                       where schemaname = 'public' and tablename in ('visitas', 'fotos', 'capturas_manuales')
                         and roles && array['anon', 'public']::name[])
union all
select '8. Reglas de UPDATE: dueño y admin en visitas y capturas; admin en fotos',
       (select count(*) = 5 from pg_policies
        where schemaname = 'public' and cmd = 'UPDATE'
          and (tablename, policyname) in (
            ('visitas', 'authenticated cambia tienda o borra sus visitas'),
            ('visitas', 'admin cambia, borra o restaura visitas'),
            ('capturas_manuales', 'authenticated edita o borra sus capturas'),
            ('capturas_manuales', 'admin edita, borra o restaura capturas'),
            ('fotos', 'admin quita o restaura cualquier foto')))
       and not exists (select 1 from pg_policies
                       where schemaname = 'public' and tablename = 'capturas_manuales'
                         and policyname = 'authenticated descarta sus capturas')
union all
select '9. Ninguna regla de visitas, fotos ni capturas consulta otra tabla directo',
       not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename in ('visitas', 'fotos', 'capturas_manuales', 'competidores')
                     and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~* '\mfrom\M')
union all
select '10. Lectura: lo borrado se esconde al personal de campo (visitas y capturas)',
       exists (select 1 from pg_policies
               where schemaname = 'public' and tablename = 'visitas'
                 and policyname = 'authenticated lee sus visitas' and qual ilike '%descartada_at IS NULL%')
       and exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = 'capturas_manuales'
                     and policyname = 'authenticated lee capturas de sus visitas' and qual ilike '%descartada_at IS NULL%')
       and pg_get_functiondef('privado.es_dueno_de_visita(uuid)'::regprocedure) ilike '%descartada_at is null%'
union all
select '11. privado.visita_sin_fotos_leidas: security definer, search_path vacío; authenticated sí, anon no',
       exists (select 1 from pg_proc p
               where p.oid = to_regprocedure('privado.visita_sin_fotos_leidas(uuid)')
                 and p.prosecdef and p.proconfig @> array['search_path=""'])
       and has_function_privilege('authenticated', 'privado.visita_sin_fotos_leidas(uuid)', 'EXECUTE')
       and not has_function_privilege('anon', 'privado.visita_sin_fotos_leidas(uuid)', 'EXECUTE')
union all
select '12. Triggers: visitas_proteger_cambios y capturas_manuales_hora_descarte; nadie los ejecuta directo',
       exists (select 1 from pg_trigger
               where tgrelid = 'public.visitas'::regclass and tgname = 'visitas_proteger_cambios' and not tgisinternal)
       and exists (select 1 from pg_trigger
                   where tgrelid = 'public.capturas_manuales'::regclass
                     and tgname = 'capturas_manuales_hora_descarte' and not tgisinternal)
       and not has_function_privilege('authenticated', 'public.visitas_proteger_cambios()', 'EXECUTE')
       and not has_function_privilege('authenticated', 'public.capturas_manuales_hora_descarte()', 'EXECUTE')
union all
select '13. Etapa 2 sigue cerrada para authenticated (catálogo y lecturas)',
       not has_table_privilege('authenticated', 'public.catalogo_propio', 'SELECT, INSERT, UPDATE, DELETE')
       and not has_table_privilege('authenticated', 'public.lecturas_precio', 'SELECT, INSERT, UPDATE, DELETE')
       and not has_table_privilege('authenticated', 'public.lecturas_analisis', 'SELECT');
