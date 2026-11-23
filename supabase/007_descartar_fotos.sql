-- =============================================================================
-- 007_descartar_fotos.sql — Quitar fotos desde la app (DESCARTE reversible)
-- =============================================================================
-- Cómo usarlo: copia TODO este archivo en Supabase → SQL Editor → Run.
-- Se puede ejecutar más de una vez sin romper nada (todo usa "if not exists",
-- "create or replace" o "drop ... if exists" antes de volver a crear).
--
-- ⚠️ ORDEN DE DESPLIEGUE: ejecútalo ANTES de publicar (push) la app nueva.
--   - La app vieja no conoce descartada_at → sigue funcionando igual.
--   - La app nueva SÍ la usa (para leer y para quitar) → sin este archivo, la
--     lista y la pantalla de la visita darían "column ... does not exist".
--
-- Decisión del usuario (2026-11-23): cualquiera con el link puede quitar fotos
-- de una visita, sin clave y sin ventana de tiempo. Pero NO se borra nada: la
-- foto solo se marca con la hora en que se quitó (descartada_at). Es un
-- "soft delete" (borrado suave): se puede deshacer desde el SQL Editor.
--
-- Qué hace:
--   BLOQUE 1. Columna descartada_at en fotos.
--   BLOQUE 2. La hora del descarte la pone SIEMPRE el servidor (trigger).
--   BLOQUE 3. Permisos de anon: UPDATE solo de descartada_at; nada más.
--   BLOQUE 4. Regla RLS: solo fotos 'pendiente' y no descartadas; sin restaurar.
--   BLOQUE 5. Vistas de la Etapa 2 sin fotos descartadas.
--   BLOQUE 6. Permisos de las vistas y del trigger (se repiten por seguridad).
--   BLOQUE 7. Comprobación (solo lee).
--
-- Lo que NO hace:
--   - No borra filas ni archivos. Los ARCHIVOS de las fotos descartadas siguen
--     en Storage hasta la limpieza del punto de retención (pendiente). Esos
--     archivos solo se borran con la API de Storage, NUNCA con SQL.
--   - No cambia guardar_lecturas (ver la nota del BLOQUE 5).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- BLOQUE 1. Columna nueva. Vacía (null) = la foto está a la vista.
-- Con fecha = alguien la quitó a esa hora (reloj del servidor). Las fotos que
-- ya existen quedan vacías, es decir, a la vista: no cambia nada para ellas.
-- -----------------------------------------------------------------------------
alter table public.fotos
  add column if not exists descartada_at timestamptz;

comment on column public.fotos.descartada_at is
  'Hora (servidor) en que alguien quitó la foto desde la app. Vacío = a la vista. Es un descarte reversible: para restaurar, ponerla en null desde el SQL Editor. El archivo sigue en Storage.';


-- -----------------------------------------------------------------------------
-- BLOQUE 2. La hora del descarte la pone el SERVIDOR, no el celular.
-- Un "trigger" es una función que Postgres corre sola antes de guardar la fila.
-- Si alguien pone descartada_at con cualquier valor (aunque mande una fecha
-- falsa como 2000-01-01), el trigger la cambia por now() (la hora del servidor).
-- Si la pone en null (restaurar), la deja en null: eso solo lo puede hacer
-- alguien del equipo desde el SQL Editor, porque anon no tiene permiso (BLOQUE 4).
-- -----------------------------------------------------------------------------
create or replace function public.fotos_poner_hora_descarte()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.descartada_at is not null
     and (tg_op = 'INSERT' or old.descartada_at is distinct from new.descartada_at) then
    new.descartada_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists fotos_poner_hora_descarte on public.fotos;
create trigger fotos_poner_hora_descarte
  before insert or update on public.fotos
  for each row execute function public.fotos_poner_hora_descarte();


-- -----------------------------------------------------------------------------
-- BLOQUE 3. Permisos de tabla para anon (la app sin login).
-- Primero se le quita a anon y authenticated TODO permiso de cambiar o borrar
-- fotos (UPDATE, DELETE, TRUNCATE). Al quitar UPDATE de la tabla, Postgres
-- quita también cualquier UPDATE por columna que hubiera quedado de antes.
-- Después se le da a anon UPDATE de UNA sola columna: descartada_at.
-- Así, si la app (o alguien con la llave pública) intenta cambiar la ruta, el
-- estado o cualquier otra columna, Postgres responde "permission denied".
-- anon sigue pudiendo LEER todas las fotos y CREAR fotos como antes.
-- -----------------------------------------------------------------------------
revoke update, delete, truncate on table public.fotos from anon, authenticated;
grant update (descartada_at) on public.fotos to anon;


-- -----------------------------------------------------------------------------
-- BLOQUE 4. Regla RLS ("policy") para el UPDATE de anon.
--   using      → QUÉ filas puede tocar: solo fotos 'pendiente' (que todavía no
--                se mandaron a leer) y que no estén ya descartadas. Una foto
--                en_lote, procesada o con error no se puede quitar.
--   with check → CÓMO debe quedar la fila: con descartada_at NO vacío. Así anon
--                no puede "restaurar" (ponerla en null).
-- Como una foto ya descartada no cumple el "using", anon tampoco puede cambiarle
-- la hora a una foto ya quitada. No hay regla de DELETE: anon no puede borrar.
-- (RLS ya estaba activado en fotos desde 001; se repite por seguridad.)
-- -----------------------------------------------------------------------------
alter table public.fotos enable row level security;

drop policy if exists "anon descarta fotos pendientes" on public.fotos;
create policy "anon descarta fotos pendientes"
  on public.fotos for update to anon
  using (estado_proceso = 'pendiente' and descartada_at is null)
  with check (estado_proceso = 'pendiente' and descartada_at is not null);


-- -----------------------------------------------------------------------------
-- BLOQUE 5. Vistas de la Etapa 2 que usan fotos: se vuelven a crear IGUALES,
-- con UNA sola línea nueva cada una (marcada "NUEVO (007)") para que ignoren
-- las fotos descartadas. "create or replace" conserva los permisos y los
-- comentarios de columna; las columnas son las mismas y en el mismo orden.
--
-- Revisado y SIN cambios:
--   - guardar_lecturas (004): no elige fotos; guarda lo que le manden. anon solo
--     puede descartar fotos 'pendiente', y una foto pendiente no tiene lecturas
--     guardadas. Si alguien del equipo descartara a mano una foto ya procesada,
--     sus lecturas se quedan guardadas pero las vistas ya no las muestran, y
--     vuelven a aparecer si se restaura la foto (descarte 100 % reversible).
--   - catalogo_propio_actual y precio_propio_vigente (005): no usan fotos.
--   - Todavía NO existe el proceso que ELIGE fotos para un lote (crear-lote,
--     fase 🤖 E2-6). Regla para cuando se haga (anotada en PLAN_ETAPA2 sección 7):
--     elegir solo descartada_at is null y marcar 'en_lote' en el MISMO update
--     (update ... where estado_proceso = 'pendiente' and descartada_at is null
--     returning ...). Así no hay carrera: o la persona la quita antes (y no
--     entra al lote) o el lote la toma antes (y ya no se puede quitar).
-- -----------------------------------------------------------------------------

-- 5a. lecturas_analisis (004): igual, + "and f.descartada_at is null".
create or replace view public.lecturas_analisis
with (security_invoker = true) as
select
  l.id                                        as lectura_id,
  l.foto_id,
  f.visita_id,
  v.competidor_id,
  c.nombre                                    as competidor,
  coalesce(f.capturada_at, v.created_at)      as fecha_observacion,
  case when f.capturada_at is not null then 'captura_foto' else 'visita' end
                                              as fecha_origen,
  v.latitud,
  v.longitud,
  f.ruta,
  f.calidad                                   as calidad_foto,
  l.orden_en_foto,
  l.articulo_competencia_id,
  l.articulo,
  l.marca,
  l.cantidad,
  l.unidad,
  l.piezas,
  l.unidad_base,
  l.contenido_base,
  l.ean,
  l.codigo_interno,
  l.precio_regular,
  l.precio_regular_pieza,
  -- Precio regular por 100 g, por 100 ml o por pza (lo calcula la base).
  case when l.contenido_base > 0 and l.precio_regular is not null
       then round(l.precio_regular / l.contenido_base
                  * case when l.unidad_base in ('g', 'ml') then 100 else 1 end, 4)
  end                                         as precio_regular_normalizado,
  case l.unidad_base when 'g' then '100 g' when 'ml' then '100 ml' when 'pza' then 'pza' end
                                              as unidad_comparacion,
  l.promo_tipo,
  l.promo_piezas,
  l.promo_precio_total,
  l.promo_condicion,
  l.vigencia_fin,
  l.texto_promocion,
  l.precio_promo_pieza,
  -- La promoción se puede comparar si tiene precio calculado, no pide tarjeta/app/etc.
  -- y no estaba vencida el día de la foto (hora de México).
  (l.precio_promo_pieza is not null
   and l.promo_condicion = 'ninguna'
   and (l.vigencia_fin is null
        or l.vigencia_fin >= (coalesce(f.capturada_at, v.created_at)
                              at time zone 'America/Mexico_City')::date))
                                              as promo_comparable,
  l.calidad                                   as calidad_etiqueta,
  l.confianza_articulo,
  l.confianza_presentacion,
  l.confianza_precio,
  l.motivo_duda,
  l.estado                                    as estado_lectura,
  l.discrepancia,
  l.modelo,
  l.lote_id,
  l.revisada_por,
  l.revisada_at,
  l.created_at                                as lectura_created_at
from public.lecturas_precio l
join public.fotos        f on f.id = l.foto_id
join public.visitas      v on v.id = f.visita_id
join public.competidores c on c.id = v.competidor_id
where l.estado <> 'descartada'
  and f.descartada_at is null;   -- NUEVO (007): sin fotos descartadas

-- 5b. comparacion_precios (006): igual, + "and f.descartada_at is null".
create or replace view public.comparacion_precios
with (security_invoker = true) as
with base as (
  select
    -- Cuándo
    coalesce(f.capturada_at, v.created_at)                 as fecha_observacion,
    case when f.capturada_at is not null then 'captura_foto' else 'visita' end
                                                           as fecha_origen,
    -- Dónde (sin zona ni plaza en esta versión)
    v.competidor_id,
    c.nombre                                               as competidor,
    v.latitud,
    v.longitud,
    f.visita_id,
    l.foto_id,
    f.ruta,
    -- Competencia
    l.id                                                   as lectura_id,
    l.articulo_competencia_id,
    l.articulo,
    l.marca,
    l.ean,
    l.cantidad,
    l.unidad,
    l.piezas,
    l.unidad_base                                          as unidad_base_comp,
    l.contenido_base                                       as contenido_base_comp,
    l.precio_regular                                       as precio_regular_comp,
    l.promo_tipo,
    l.texto_promocion,
    l.precio_promo_pieza                                   as precio_promo_pieza_comp,
    l.estado                                               as estado_lectura,
    -- Nuestro
    p.clave,
    p.descripcion,
    p.cantidad                                             as cantidad_propia,
    p.unidad                                               as unidad_propia,
    p.unidad_base                                          as unidad_base_propia,
    p.contenido_base                                       as contenido_base_propio,
    p.contenido_origen                                     as contenido_origen_propio,
    p.nacs_categoria,
    pv.precio_regular                                      as precio_regular_propio,
    pv.fecha_corte_usada,
    pv.corte_posterior,
    -- Equivalencia
    e.id                                                   as equivalencia_id,
    e.tipo                                                 as tipo_equivalencia
  from public.equivalencias e
  join public.lecturas_precio        l on l.articulo_competencia_id = e.articulo_competencia_id
  join public.fotos                  f on f.id = l.foto_id
  join public.visitas                v on v.id = f.visita_id
  join public.competidores           c on c.id = v.competidor_id
  join public.catalogo_propio_actual p on p.clave = e.clave_propia
  -- Nuestro precio regular el día de la foto (hora de México).
  cross join lateral public.precio_propio_vigente(
    p.clave,
    (coalesce(f.capturada_at, v.created_at) at time zone 'America/Mexico_City')::date) pv
  where e.estado = 'aprobada'
    and e.tipo in ('mismo_articulo', 'otra_presentacion')
    and l.estado in ('propuesta', 'aprobada', 'corregida')
    and p.activo
    and l.precio_regular > 0
    and pv.precio_regular > 0
    and f.descartada_at is null   -- NUEVO (007): sin fotos descartadas
),
con_motivo as (
  select
    b.*,
    -- Por qué NO se puede sacar el precio por unidad (vacío = sí se puede).
    case
      when b.contenido_base_comp   is null or b.contenido_base_comp   <= 0 then 'sin_contenido_competencia'
      when b.contenido_base_propio is null or b.contenido_base_propio <= 0 then 'sin_contenido_propio'
      when b.unidad_base_comp is distinct from b.unidad_base_propia        then 'unidades_distintas'
    end as motivo_sin_precio_unidad,
    -- 100 para g y ml (precio por 100 g / 100 ml); 1 para pza (precio por pieza).
    case b.unidad_base_comp when 'pza' then 1 else 100 end as factor_unidad
  from base b
),
calculo as (
  select
    m.*,
    case when m.motivo_sin_precio_unidad is null then
      case m.unidad_base_comp when 'g' then '100 g' when 'ml' then '100 ml' when 'pza' then 'pieza' end
    end as unidad_comparacion,
    case when m.motivo_sin_precio_unidad is null then
      round(m.precio_regular_comp / nullif(m.contenido_base_comp, 0) * m.factor_unidad, 4)
    end as precio_comp_por_unidad,
    case when m.motivo_sin_precio_unidad is null then
      round(m.precio_regular_propio / nullif(m.contenido_base_propio, 0) * m.factor_unidad, 4)
    end as precio_propio_por_unidad,
    case
      when m.tipo_equivalencia = 'mismo_articulo' then
        round((m.precio_regular_propio / nullif(m.precio_regular_comp, 0) - 1) * 100, 2)
      when m.motivo_sin_precio_unidad is null then
        -- (propio ÷ contenido_propio) ÷ (comp ÷ contenido_comp) − 1, sin redondear antes.
        round(((m.precio_regular_propio * m.contenido_base_comp)
               / nullif(m.precio_regular_comp * m.contenido_base_propio, 0) - 1) * 100, 2)
    end as indice
  from con_motivo m
)
select
  -- Cuándo
  fecha_observacion,
  fecha_origen,
  -- Dónde
  competidor_id,
  competidor,
  latitud,
  longitud,
  visita_id,
  foto_id,
  ruta,
  -- Competencia
  lectura_id,
  articulo_competencia_id,
  articulo,
  marca,
  ean,
  cantidad,
  unidad,
  piezas,
  precio_regular_comp,
  promo_tipo,
  texto_promocion,
  precio_promo_pieza_comp,
  estado_lectura,
  -- Nuestro
  clave,
  descripcion,
  cantidad_propia,
  unidad_propia,
  contenido_origen_propio,
  precio_regular_propio,
  fecha_corte_usada,
  corte_posterior,
  nacs_categoria,
  -- Equivalencia
  equivalencia_id,
  tipo_equivalencia,
  -- Calculado por SQL
  case tipo_equivalencia when 'mismo_articulo' then 'precio_total' else 'precio_por_unidad' end
                                       as base_indice,
  indice                               as indice_vs_competencia_pct,
  (indice between -3 and 3)            as en_linea,
  (tipo_equivalencia = 'mismo_articulo') as entra_a_promedios,
  unidad_comparacion,
  precio_comp_por_unidad,
  precio_propio_por_unidad,
  motivo_sin_precio_unidad
from calculo
-- 'otra_presentacion' que no se puede medir por unidad no tiene índice: no aparece.
where indice is not null;


-- -----------------------------------------------------------------------------
-- BLOQUE 6. Permisos (se repiten por seguridad; "create or replace" ya los
-- conserva). Las dos vistas siguen CERRADAS para anon y authenticated, y la
-- función del trigger no la puede llamar nadie de afuera (el trigger la corre
-- solo, sin que haga falta ese permiso).
-- -----------------------------------------------------------------------------
revoke all on table public.lecturas_analisis, public.comparacion_precios
  from public, anon, authenticated;
grant select on table public.lecturas_analisis, public.comparacion_precios to service_role;

revoke all on function public.fotos_poner_hora_descarte() from public, anon, authenticated;

-- Avisa a la API de Supabase que hay una columna nueva (normalmente lo detecta
-- sola; esto lo asegura). No cambia datos.
notify pgrst, 'reload schema';


-- -----------------------------------------------------------------------------
-- BLOQUE 7. Comprobación (solo lee; no cambia nada).
-- Todas las filas deben salir con ok = true.
-- -----------------------------------------------------------------------------
select 'Existe fotos.descartada_at (timestamptz)' as comprobacion,
       exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'fotos'
                 and column_name = 'descartada_at'
                 and data_type = 'timestamp with time zone') as ok
union all
select 'anon SÍ puede hacer UPDATE de descartada_at',
       has_column_privilege('anon', 'public.fotos', 'descartada_at', 'UPDATE')
union all
select 'anon NO puede hacer UPDATE de ninguna otra columna de fotos',
       not exists (select 1 from information_schema.columns c
                   where c.table_schema = 'public' and c.table_name = 'fotos'
                     and c.column_name <> 'descartada_at'
                     and has_column_privilege('anon', 'public.fotos', c.column_name, 'UPDATE'))
union all
select 'anon NO tiene UPDATE de toda la tabla fotos',
       not has_table_privilege('anon', 'public.fotos', 'UPDATE')
union all
select 'anon NO puede borrar fotos (DELETE ni TRUNCATE)',
       not has_table_privilege('anon', 'public.fotos', 'DELETE')
       and not has_table_privilege('anon', 'public.fotos', 'TRUNCATE')
union all
select 'anon NO puede mandar descartada_at al CREAR una foto',
       not has_column_privilege('anon', 'public.fotos', 'descartada_at', 'INSERT')
union all
select 'La app sigue pudiendo leer y crear fotos (SELECT e INSERT de ruta)',
       has_table_privilege('anon', 'public.fotos', 'SELECT')
       and has_column_privilege('anon', 'public.fotos', 'ruta', 'INSERT')
union all
select 'authenticated NO puede cambiar ni borrar fotos',
       not has_any_column_privilege('authenticated', 'public.fotos', 'UPDATE')
       and not has_table_privilege('authenticated', 'public.fotos', 'DELETE, TRUNCATE')
union all
select 'RLS activado en fotos',
       (select relrowsecurity from pg_class where oid = 'public.fotos'::regclass)
union all
select 'Regla "anon descarta fotos pendientes": UPDATE, solo anon, pendiente y sin restaurar',
       exists (select 1 from pg_policies
               where schemaname = 'public' and tablename = 'fotos'
                 and policyname = 'anon descarta fotos pendientes'
                 and cmd = 'UPDATE' and roles = array['anon']::name[]
                 and qual like '%pendiente%' and qual like '%descartada_at IS NULL%'
                 and with_check like '%descartada_at IS NOT NULL%')
union all
select 'Es la ÚNICA regla de UPDATE en fotos y NO hay reglas de DELETE',
       (select count(*) = 1 from pg_policies
        where schemaname = 'public' and tablename = 'fotos' and cmd in ('UPDATE', 'ALL'))
       and not exists (select 1 from pg_policies
                       where schemaname = 'public' and tablename = 'fotos' and cmd = 'DELETE')
union all
select 'Trigger de hora del servidor activo (antes de insert y update)',
       exists (select 1 from pg_trigger
               where tgrelid = 'public.fotos'::regclass
                 and tgname = 'fotos_poner_hora_descarte'
                 and tgenabled = 'O' and not tgisinternal)
union all
select 'anon NO puede ejecutar fotos_poner_hora_descarte',
       not has_function_privilege('anon', 'public.fotos_poner_hora_descarte()', 'EXECUTE')
union all
select 'lecturas_analisis ignora fotos descartadas',
       pg_get_viewdef('public.lecturas_analisis'::regclass) like '%descartada_at IS NULL%'
union all
select 'comparacion_precios ignora fotos descartadas',
       pg_get_viewdef('public.comparacion_precios'::regclass) like '%descartada_at IS NULL%'
union all
select 'Las 2 vistas siguen con security_invoker',
       (select count(*) = 2 from pg_class
        where oid in ('public.lecturas_analisis'::regclass, 'public.comparacion_precios'::regclass)
          and 'security_invoker=true' = any (reloptions))
union all
select 'anon y authenticated NO pueden leer las 2 vistas',
       not has_table_privilege('anon', 'public.lecturas_analisis', 'SELECT')
       and not has_table_privilege('anon', 'public.comparacion_precios', 'SELECT')
       and not has_table_privilege('authenticated', 'public.lecturas_analisis', 'SELECT')
       and not has_table_privilege('authenticated', 'public.comparacion_precios', 'SELECT')
union all
select 'El comentario del índice sigue en comparacion_precios',
       coalesce(col_description('public.comparacion_precios'::regclass,
                  (select a.attnum from pg_attribute a
                   where a.attrelid = 'public.comparacion_precios'::regclass
                     and a.attname = 'indice_vs_competencia_pct'))
                like 'Porcentaje. Positivo = nosotros más caros%', false)
union all
select 'Storage: anon sigue sin poder reemplazar ni borrar archivos',
       not exists (select 1 from pg_policies
                   where schemaname = 'storage' and tablename = 'objects'
                     and cmd in ('UPDATE', 'DELETE', 'ALL')
                     and roles && array['anon', 'public']::name[]);
