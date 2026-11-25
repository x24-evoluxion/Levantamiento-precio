-- =============================================================================
-- 012b_etapa2_sin_visitas_borradas.sql — Etapa 2: ignorar visitas borradas
-- =============================================================================
-- ⚠️ ARCHIVO PARA REVISAR. Va DESPUÉS de 012 (usa visitas.descartada_at).
-- Cómo usarlo: copia TODO este archivo en Supabase → SQL Editor → Run.
-- Repetible ("create or replace") y en una transacción.
--
-- Qué es: desde 012 una visita se puede BORRAR (descartar). Ningún agente de
-- lectura ni ninguna consulta de la Etapa 2 debe usar fotos de visitas borradas
-- (las fotos quitadas ya se ignoraban desde 007). Se revisó TODO lo que elige o
-- usa fotos en la Etapa 2:
--   - lecturas_analisis (004/007): usa fotos + visitas → se agrega UNA línea
--     "and v.descartada_at is null". Todo lo demás, idéntico a 007.
--   - comparacion_precios (006/007): igual, UNA línea nueva.
--   - guardar_lecturas (004): guarda las lecturas de una foto. Ahora rechaza
--     (error 22023) una foto quitada o de una visita borrada. Todo lo demás,
--     idéntico a 004.
--   - Sin cambios: catalogo_propio_actual, precio_propio_vigente,
--     importar_corte, equivalencias (no usan fotos); articulos_captura (011).
--   - Todavía NO existe el proceso que ELIGE fotos para un lote (crear-lote,
--     fase 🤖 E2-6). Regla anotada en PLAN_ETAPA2 sección 7: elegir solo fotos
--     'pendiente', no quitadas y de visitas NO borradas, y marcarlas 'en_lote'
--     en el MISMO update.
--
-- Efecto en la app: ninguno (la app no puede ver estas vistas ni la función).
-- Permisos: "create or replace" conserva los de 004/006/007 (solo
-- service_role); se repiten abajo por seguridad.
-- =============================================================================

begin;

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'visitas'
                   and column_name = 'descartada_at') then
    raise exception 'Falta visitas.descartada_at (migración 012). No se cambió nada.'
      using hint = 'Ejecuta primero supabase/012_editar_borrar.sql.';
  end if;
end;
$$;

-- 1. lecturas_analisis: igual que en 007 + "and v.descartada_at is null".
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
  and f.descartada_at is null    -- (007): sin fotos descartadas
  and v.descartada_at is null;   -- NUEVO (012b): sin visitas borradas

-- 2. comparacion_precios: igual que en 007 + "and v.descartada_at is null".
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
    and f.descartada_at is null   -- (007): sin fotos descartadas
    and v.descartada_at is null   -- NUEVO (012b): sin visitas borradas
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

-- 3. guardar_lecturas: igual que en 004 + rechaza fotos quitadas y visitas borradas.
create or replace function public.guardar_lecturas(
  p_foto_id uuid, p_calidad text, p_motivo_calidad text, p_lecturas jsonb)
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_estado text;
  v_n      int;
  v_foto_descartada   boolean;  -- NUEVO (012b)
  v_visita_descartada boolean;  -- NUEVO (012b)
begin
  select f.estado_proceso, f.descartada_at is not null, v.descartada_at is not null
    into v_estado, v_foto_descartada, v_visita_descartada
  from public.fotos f
  join public.visitas v on v.id = f.visita_id
  where f.id = p_foto_id
  for update of f;                              -- evita que dos procesos guarden a la vez

  if not found then
    raise exception 'No existe la foto %', p_foto_id;
  end if;
  if v_estado = 'procesada' then
    return null;
  end if;
  -- NUEVO (012b): no se guardan lecturas de fotos quitadas ni de visitas borradas.
  if v_foto_descartada or v_visita_descartada then
    raise exception 'La foto % está quitada o su visita está borrada: no se guardan lecturas.', p_foto_id
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_lecturas) is distinct from 'array' then
    raise exception 'p_lecturas debe ser una lista JSON';
  end if;

  delete from public.lecturas_precio where foto_id = p_foto_id;

  insert into public.lecturas_precio (
    foto_id, orden_en_foto, articulo_competencia_id, articulo, marca, cantidad, unidad,
    piezas, ean, codigo_interno, precio_regular, promo_tipo, promo_piezas,
    promo_precio_total, promo_paga_piezas, promo_descuento_pct, promo_condicion,
    vigencia_fin, texto_promocion, texto_leido, calidad, confianza_articulo,
    confianza_presentacion, confianza_precio, motivo_duda, estado, valores_agente,
    discrepancia, modelo, lote_id)
  select
    p_foto_id, r.orden_en_foto, r.articulo_competencia_id, r.articulo, r.marca, r.cantidad, r.unidad,
    coalesce(r.piezas, 1), r.ean, r.codigo_interno, r.precio_regular, coalesce(r.promo_tipo, 'ninguna'),
    r.promo_piezas, r.promo_precio_total, r.promo_paga_piezas, r.promo_descuento_pct,
    coalesce(r.promo_condicion, 'ninguna'), r.vigencia_fin, r.texto_promocion, r.texto_leido,
    r.calidad, r.confianza_articulo, r.confianza_presentacion, r.confianza_precio, r.motivo_duda,
    coalesce(r.estado, 'por_revisar'), r.valores_agente, r.discrepancia, r.modelo, r.lote_id
  from jsonb_populate_recordset(null::public.lecturas_precio, p_lecturas) as r;

  get diagnostics v_n = row_count;

  update public.fotos
  set estado_proceso = 'procesada',
      calidad        = p_calidad,
      motivo_calidad = p_motivo_calidad,
      error_proceso  = null,
      procesada_at   = now()
  where id = p_foto_id;

  return v_n;
end;
$$;

revoke all on table public.lecturas_analisis, public.comparacion_precios
  from public, anon, authenticated;
grant select on table public.lecturas_analisis, public.comparacion_precios to service_role;
revoke all on function public.guardar_lecturas(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.guardar_lecturas(uuid, text, text, jsonb) to service_role;

commit;

-- 4. Comprobación (solo lee). Todas con ok = true.
select '1. lecturas_analisis ignora visitas borradas' as comprobacion,
       pg_get_viewdef('public.lecturas_analisis'::regclass) ilike '%v.descartada_at is null%' as ok
union all
select '2. comparacion_precios ignora visitas borradas',
       pg_get_viewdef('public.comparacion_precios'::regclass) ilike '%v.descartada_at is null%'
union all
select '3. guardar_lecturas rechaza fotos quitadas y visitas borradas',
       pg_get_functiondef('public.guardar_lecturas(uuid, text, text, jsonb)'::regprocedure) ilike '%v_visita_descartada%'
union all
select '4. Siguen cerradas: anon y authenticated sin acceso a vistas ni función',
       not has_table_privilege('authenticated', 'public.lecturas_analisis', 'SELECT')
       and not has_table_privilege('authenticated', 'public.comparacion_precios', 'SELECT')
       and not has_table_privilege('anon', 'public.lecturas_analisis', 'SELECT')
       and not has_function_privilege('authenticated', 'public.guardar_lecturas(uuid, text, text, jsonb)', 'EXECUTE')
       and not has_function_privilege('anon', 'public.guardar_lecturas(uuid, text, text, jsonb)', 'EXECUTE');
