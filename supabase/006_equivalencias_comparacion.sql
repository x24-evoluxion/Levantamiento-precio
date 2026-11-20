-- =============================================================================
-- 006_equivalencias_comparacion.sql — Equivalencias y vista de comparación
-- (Etapa 2, Fase E2-4: la última fase de "base")
-- =============================================================================
-- Cómo usarlo: copia TODO este archivo en Supabase → SQL Editor → Run.
-- Se puede ejecutar más de una vez sin romper nada (todo usa "if not exists",
-- "create or replace" o "drop ... if exists" antes de volver a crear).
--
-- Qué hace (solo ESTRUCTURA; la tabla queda VACÍA y la vista también, hasta que
-- haya lecturas y equivalencias aprobadas):
--   BLOQUE 1. Tabla equivalencias        (artículo de la competencia ↔ artículo nuestro).
--   BLOQUE 2. Vista comparacion_precios  (precio regular contra precio regular).
--   BLOQUE 3. Permisos: todo CERRADO para anon y authenticated.
--   BLOQUE 4. Comprobación (solo lee).
--
-- NO hay ninguna lógica de cómo se llenan las equivalencias (ni scripts, ni
-- funciones, ni reglas automáticas): el método se decide en la fase de agentes
-- (E2-7). Mientras tanto solo una persona puede escribir desde el SQL Editor.
--
-- Decisiones del usuario (2026-11-20) que se reflejan aquí:
--   - Precio regular contra precio regular (nuestro: precio_propio_vigente).
--   - Las filas que no se pueden comparar NO aparecen: precio regular en 0 o
--     vacío de cualquiera de los dos lados, artículo nuestro no activo (servicio,
--     obsoleto, de baja o fuera del último corte), equivalencias no aprobadas,
--     'sin_equivalente', y 'otra_presentacion' que no se puede medir por unidad.
--   - UN SOLO índice: 'mismo_articulo' compara precio total contra precio total;
--     'otra_presentacion' compara precio por 100 g / 100 ml / pieza.
--   - No se puede borrar un artículo (nuestro ni de la competencia) mientras
--     tenga una equivalencia: primero se borra la equivalencia.
--
-- Efecto en la app publicada: ninguno (la app no usa estas tablas).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- BLOQUE 1. equivalencias: relaciona UN artículo de la competencia con UNO
-- nuestro. Se aprueba una vez por artículo y todas sus lecturas (pasadas y
-- futuras) la heredan.
--
-- Qué pasa al BORRAR (on delete restrict, en los dos lados):
--   - Borrar un artículo nuestro (catalogo_propio) que tenga equivalencias → ERROR.
--   - Borrar un artículo de la competencia que tenga equivalencias → ERROR.
--   Hay que borrar (o cambiar) la equivalencia primero. Así nada se pierde por
--   accidente. El importador del catálogo nunca borra artículos: no le afecta.
-- -----------------------------------------------------------------------------
create table if not exists public.equivalencias (
  id                       bigint generated always as identity primary key,
  articulo_competencia_id  bigint not null,
  clave_propia             text,
  tipo                     text not null,
  estado                   text not null default 'propuesta',
  created_at               timestamptz not null default now(),
  actualizado_at           timestamptz not null default now(),

  constraint equivalencias_articulo_competencia_fk
    foreign key (articulo_competencia_id)
    references public.articulos_competencia (id) on delete restrict,
  constraint equivalencias_clave_propia_fk
    foreign key (clave_propia)
    references public.catalogo_propio (clave) on delete restrict,
  -- Solo estos 3 tipos.
  constraint equivalencias_tipo_valido
    check (tipo in ('mismo_articulo', 'otra_presentacion', 'sin_equivalente')),
  -- Solo estos 3 estados.
  constraint equivalencias_estado_valido
    check (estado in ('propuesta', 'aprobada', 'rechazada')),
  -- 'sin_equivalente' va SIN artículo nuestro; los otros dos tipos, CON uno.
  constraint equivalencias_clave_segun_tipo
    check ((tipo = 'sin_equivalente') = (clave_propia is null))
);

-- Máximo UNA equivalencia aprobada por artículo de la competencia (puede haber
-- varias propuestas o rechazadas). Es una regla de integridad, no de método.
create unique index if not exists equivalencias_una_aprobada_por_articulo
  on public.equivalencias (articulo_competencia_id)
  where estado = 'aprobada';

-- Para buscar rápido (y para que el "no dejar borrar" no recorra toda la tabla).
create index if not exists equivalencias_articulo_competencia_idx
  on public.equivalencias (articulo_competencia_id);
create index if not exists equivalencias_clave_propia_idx
  on public.equivalencias (clave_propia);

-- actualizado_at se pone solo al cambiar una fila (nadie tiene que acordarse).
create or replace function public.equivalencias_poner_actualizado_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_at := now();
  return new;
end;
$$;

drop trigger if exists equivalencias_poner_actualizado_at on public.equivalencias;
create trigger equivalencias_poner_actualizado_at
  before update on public.equivalencias
  for each row execute function public.equivalencias_poner_actualizado_at();

comment on table public.equivalencias is
  'Artículo de la competencia ↔ artículo nuestro. Solo estructura: el método para llenarla se decide en E2-7. No se puede borrar un artículo que tenga equivalencias (on delete restrict).';
comment on column public.equivalencias.clave_propia is
  'Clave de catalogo_propio (texto). Vacía solo si tipo = sin_equivalente.';
comment on column public.equivalencias.tipo is
  'mismo_articulo = el mismo artículo; otra_presentacion = mismo producto con otro contenido; sin_equivalente = no tenemos uno equivalente.';
comment on column public.equivalencias.estado is
  'propuesta, aprobada o rechazada. Máximo una aprobada por artículo de la competencia. Solo las aprobadas entran a comparacion_precios.';


-- -----------------------------------------------------------------------------
-- BLOQUE 2. Vista comparacion_precios: una fila por LECTURA de la competencia
-- cuyo artículo tiene una equivalencia APROBADA con un artículo nuestro.
--
-- Qué entra:
--   - Equivalencias 'aprobada' de tipo 'mismo_articulo' u 'otra_presentacion'.
--   - Lecturas 'propuesta', 'aprobada' o 'corregida' (nunca 'por_revisar' ni
--     'descartada'); estado_lectura queda en la vista para filtrar.
--   - Artículos nuestros ACTIVOS (catalogo_propio_actual.activo).
--   - Precio regular > 0 de los DOS lados (el nuestro, en la fecha de la foto).
--   - 'otra_presentacion' solo si se puede medir por unidad (los dos con
--     contenido y la misma unidad base). Si no, la fila NO aparece.
--
-- Índice (signo de la consultora): positivo = nosotros más caros.
--   mismo_articulo    : (precio_regular_propio ÷ precio_regular_comp − 1) × 100
--   otra_presentacion : lo mismo, pero con los precios por 100 g / 100 ml / pieza
--   Ej. inventado: nuestro $11, competencia $10 → +10.
--
-- Precio por unidad: en 'mismo_articulo' sin contenido (o con unidades
-- distintas) la fila SÍ aparece, con el índice calculado, los precios por
-- unidad vacíos y motivo_sin_precio_unidad diciendo por qué.
--
-- Nunca divide entre cero: los precios en 0 se filtran antes y, además, cada
-- división usa nullif(…, 0). Nunca inventa contenidos: si falta, queda vacío.
--
-- security_invoker = true: la vista usa los permisos de QUIEN consulta. Así no
-- puede "abrir" las tablas de abajo: quien no puede leer lecturas_precio,
-- catalogo_propio, etc., tampoco puede leer la vista (ver BLOQUE 3).
-- -----------------------------------------------------------------------------
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

comment on view public.comparacion_precios is
  'Precio regular de la competencia contra nuestro precio regular (precio_propio_vigente en la fecha de la foto). Una fila por lectura con equivalencia aprobada. indice_vs_competencia_pct: positivo = nosotros más caros. Solo artículos nuestros activos y precios > 0 de los dos lados.';
comment on column public.comparacion_precios.indice_vs_competencia_pct is
  'Porcentaje. Positivo = nosotros más caros que la competencia; negativo = más baratos. (precio_propio ÷ precio_competencia − 1) × 100. En mismo_articulo, con el precio total; en otra_presentacion, con el precio por 100 g / 100 ml / pieza (ver base_indice).';
comment on column public.comparacion_precios.base_indice is
  'precio_total (mismo_articulo) o precio_por_unidad (otra_presentacion): con qué precios se calculó el índice.';
comment on column public.comparacion_precios.en_linea is
  'true si el índice está entre −3 y +3 (inclusive).';
comment on column public.comparacion_precios.entra_a_promedios is
  'true solo en mismo_articulo. otra_presentacion es informativa y no entra a promedios.';
comment on column public.comparacion_precios.unidad_comparacion is
  '100 g, 100 ml o pieza. Vacía si no se puede medir por unidad (ver motivo_sin_precio_unidad).';
comment on column public.comparacion_precios.motivo_sin_precio_unidad is
  'Vacío = sí hay precio por unidad. Si no: sin_contenido_competencia, sin_contenido_propio o unidades_distintas.';
comment on column public.comparacion_precios.precio_promo_pieza_comp is
  'Precio de promoción por pieza de la competencia. Informativo: NO entra al índice.';


-- -----------------------------------------------------------------------------
-- BLOQUE 3. Permisos. Todo lo nuevo queda CERRADO para el público:
--   - anon (la app sin login) y authenticated: NADA (ni leer, ni escribir).
--   - RLS activado en equivalencias y SIN ninguna política → aunque alguien
--     diera un permiso por error, RLS seguiría bloqueando.
--   - La vista: sin permisos para anon/authenticated (revoke) Y con
--     security_invoker (aunque alguien le diera permiso por error, seguiría
--     chocando con las tablas de abajo, que también están cerradas).
--   - Solo service_role (la secret key, en scripts locales) y el SQL Editor.
-- Supabase da permisos a anon automáticamente a todo lo que se crea en "public";
-- por eso hay que quitarlos de forma explícita (revoke) cada vez.
-- -----------------------------------------------------------------------------
alter table public.equivalencias enable row level security;

revoke all on table public.equivalencias, public.comparacion_precios
  from public, anon, authenticated;
grant select, insert, update, delete on table public.equivalencias to service_role;
grant select on table public.comparacion_precios to service_role;

revoke all on sequence public.equivalencias_id_seq from public, anon, authenticated;
grant usage, select on sequence public.equivalencias_id_seq to service_role;

revoke all on function public.equivalencias_poner_actualizado_at() from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- BLOQUE 4. Comprobación (solo lee; no cambia nada).
-- Todas las filas deben salir con ok = true.
-- -----------------------------------------------------------------------------
with nuevos(nombre) as (
  values ('public.equivalencias'), ('public.comparacion_precios')
),
-- Tablas y vistas que lee comparacion_precios y que tienen datos privados.
debajo(nombre) as (
  values ('public.lecturas_precio'), ('public.articulos_competencia'),
         ('public.catalogo_propio'), ('public.catalogo_propio_cortes'),
         ('public.catalogo_propio_actual'), ('public.equivalencias')
)
select 'anon NO tiene ningún permiso sobre ' || nombre as comprobacion,
       not has_table_privilege('anon', nombre,
             'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') as ok
from nuevos
union all
select 'authenticated NO tiene ningún permiso sobre ' || nombre,
       not has_table_privilege('authenticated', nombre,
             'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
from nuevos
union all
select 'anon NO puede leer ' || nombre || ' (lo que hay debajo de la vista)',
       not has_table_privilege('anon', nombre, 'SELECT')
from debajo
union all
select 'anon NO puede ejecutar precio_propio_vigente (la usa la vista)',
       not has_function_privilege('anon', 'public.precio_propio_vigente(text, date)', 'EXECUTE')
union all
select 'anon NO puede ejecutar equivalencias_poner_actualizado_at',
       not has_function_privilege('anon', 'public.equivalencias_poner_actualizado_at()', 'EXECUTE')
union all
select 'anon NO puede usar la secuencia de equivalencias',
       not has_sequence_privilege('anon', 'public.equivalencias_id_seq', 'USAGE, SELECT, UPDATE')
union all
select 'service_role SÍ puede leer comparacion_precios',
       has_table_privilege('service_role', 'public.comparacion_precios', 'SELECT')
union all
select 'RLS activado en equivalencias',
       (select c.relrowsecurity from pg_class c where c.oid = 'public.equivalencias'::regclass)
union all
select 'Ninguna política en equivalencias',
       not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = 'equivalencias')
union all
select 'La vista comparacion_precios usa security_invoker',
       coalesce((select 'security_invoker=true' = any (c.reloptions)
                 from pg_class c where c.oid = 'public.comparacion_precios'::regclass), false)
union all
select 'Existen los 3 check de equivalencias (tipo, estado, clave según tipo)',
       (select count(*) = 3 from pg_constraint
        where conrelid = 'public.equivalencias'::regclass and contype = 'c'
          and conname in ('equivalencias_tipo_valido', 'equivalencias_estado_valido',
                          'equivalencias_clave_segun_tipo'))
union all
select 'Borrar un artículo con equivalencia está bloqueado (on delete restrict, 2 lados)',
       (select count(*) = 2 from pg_constraint
        where conrelid = 'public.equivalencias'::regclass and contype = 'f' and confdeltype = 'r')
union all
select 'Existe el índice "una aprobada por artículo"',
       exists (select 1 from pg_indexes
               where schemaname = 'public' and indexname = 'equivalencias_una_aprobada_por_articulo')
union all
select 'clave_propia es texto',
       exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'equivalencias'
                 and column_name = 'clave_propia' and data_type = 'text')
union all
select 'El comentario del índice explica el signo (positivo = nosotros más caros)',
       coalesce(col_description('public.comparacion_precios'::regclass,
                  (select a.attnum from pg_attribute a
                   where a.attrelid = 'public.comparacion_precios'::regclass
                     and a.attname = 'indice_vs_competencia_pct'))
                like 'Porcentaje. Positivo = nosotros más caros%', false);
