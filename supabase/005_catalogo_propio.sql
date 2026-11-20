-- =============================================================================
-- 005_catalogo_propio.sql — Nuestro catálogo (Etapa 2, Fase E2-3)
-- =============================================================================
-- Cómo usarlo: copia TODO este archivo en Supabase → SQL Editor → Run.
-- Se puede ejecutar más de una vez sin romper nada.
--
-- Qué hace (solo ESTRUCTURA: las tablas quedan VACÍAS; las llena el script
-- scripts/etapa2/importar-catalogo.ts, que ejecuta el usuario):
--   BLOQUE 1. Tabla catalogo_propio         (un artículo nuestro).
--   BLOQUE 2. Tabla catalogo_propio_cortes  (precio regular de un artículo en un corte).
--   BLOQUE 3. Tabla promociones_propias     (un artículo dentro de un grupo de una promoción).
--   BLOQUE 4. Función precio_propio_vigente (nuestro precio regular en una fecha).
--   BLOQUE 5. Vista catalogo_propio_actual  (artículo + precio del último corte + activo).
--   BLOQUE 6. Función importar_corte        (carga un corte completo, TODO O NADA).
--   BLOQUE 7. Permisos: todo CERRADO para anon y authenticated.
--   BLOQUE 8. Comprobación (solo lee).
--
-- Decisiones del usuario (2026-11-20) que se reflejan aquí:
--   - NINGÚN dato de venta en Supabase (ni venta 12 m, ni piezas, ni fecha de
--     última venta, ni lo vendido en promoción).
--   - NO se cargan mayoreo, impuestos (tasas y precio sin impuestos), resúmenes
--     de promoción al corte, precio normal registrado, descuento ni clave_es_ean.
--     Las revisiones de calidad que usan esas columnas las hace el script
--     leyendo el archivo; aquí no se guardan.
--   - "Activo" = aparece en el corte más reciente, no obsoleto, no de baja, no
--     servicio y precio regular > 0 (se calcula; no se guarda).
--   - clave es SIEMPRE texto.
--
-- Efecto en la app publicada: ninguno (la app no usa estas tablas).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- BLOQUE 1. catalogo_propio: lo que casi no cambia de un artículo.
-- Usa las funciones de normalización creadas en 004 (no se vuelven a crear).
-- -----------------------------------------------------------------------------
create table if not exists public.catalogo_propio (
  clave                text primary key
                         check (clave <> '' and clave = btrim(clave)),
  descripcion          text not null,
  area_id              int,
  area                 text,
  depto_id             int,
  departamento         text,
  nacs_subcategoria_id text,
  nacs_categoria_id    text,
  nacs_categoria       text,
  -- Contenido de TODO el empaque (el archivo ya lo trae en g o ml).
  -- numeric sin límite: se guarda EXACTO como viene (algunos traen muchos
  -- decimales; el script los reporta en vez de redondearlos en silencio).
  cantidad             numeric check (cantidad is null or cantidad > 0),
  unidad               text check (unidad is null or unidad in ('g', 'kg', 'ml', 'l', 'pza')),
  piezas               int not null default 1 check (piezas > 0),
  unidad_base          text generated always as (public.normalizar_unidad_base(unidad)) stored,
  contenido_base       numeric generated always as
                         (public.normalizar_contenido_base(cantidad, unidad, piezas)) stored,
  -- archivo = lo trae el SCA; manual = lo corrigió una persona (el script NUNCA
  -- lo sobrescribe); sin_dato = no se sabe.
  contenido_origen     text not null
                         check (contenido_origen in ('archivo', 'manual', 'sin_dato')),
  es_servicio          boolean not null,
  obsoleto             boolean not null,
  de_baja              boolean not null,
  fecha_corte_ultimo   date not null,
  created_at           timestamptz not null default now(),
  actualizado_at       timestamptz not null default now(),
  constraint catalogo_propio_cantidad_unidad_juntas
    check ((cantidad is null) = (unidad is null)),
  constraint catalogo_propio_sin_dato_sin_cantidad
    check ((contenido_origen = 'sin_dato') = (cantidad is null))
);

comment on table public.catalogo_propio is
  'Un artículo nuestro (del SCA). Lo llena importar_corte. Sin datos de venta.';
comment on column public.catalogo_propio.clave is
  'Clave del SCA. SIEMPRE texto, nunca número (ceros a la izquierda, claves con letras).';


-- -----------------------------------------------------------------------------
-- BLOQUE 2. catalogo_propio_cortes: el precio regular de cada artículo en cada
-- corte. Los cortes se apilan: uno nuevo no borra los anteriores.
-- Sin columnas de venta, mayoreo ni impuestos (decisión del 2026-11-20).
-- -----------------------------------------------------------------------------
create table if not exists public.catalogo_propio_cortes (
  fecha_corte                date not null,
  clave                      text not null references public.catalogo_propio (clave),
  -- Lista de toda la cadena, con IVA e IEPS, como en el anaquel.
  precio_regular             numeric(10,2) not null,
  fecha_ultimo_cambio_precio date,
  primary key (fecha_corte, clave)
);

create index if not exists catalogo_propio_cortes_clave_fecha
  on public.catalogo_propio_cortes (clave, fecha_corte);

comment on table public.catalogo_propio_cortes is
  'Precio regular de un artículo nuestro en un corte del SCA. Sin datos de venta.';


-- -----------------------------------------------------------------------------
-- BLOQUE 3. promociones_propias: igual que viene del archivo, una fila por
-- artículo dentro de un grupo de una promoción. Se cargan, pero NO entran a la
-- comparación en esta versión. clave SIN llave foránea: puede venir una clave
-- que no está en el catálogo (el script la reporta).
-- -----------------------------------------------------------------------------
create table if not exists public.promociones_propias (
  id                       bigint generated always as identity primary key,
  fecha_corte              date not null,
  origen                   text not null check (origen in ('promogrupo', 'catalogo')),
  id_promocion             int,          -- puede ser negativo; vacío en 'catalogo'
  categoria_promo_id       int,
  categoria_promo          text,
  descripcion_promo        text,
  regiones                 text,         -- vacío = toda la cadena
  fecha_inicio             date not null,
  fecha_fin                date not null,
  activa                   boolean,
  vigente_al_corte         boolean,
  es_combo                 boolean not null,
  num_grupos               int,
  id_grupo                 int,
  clave                    text not null check (clave <> '' and clave = btrim(clave)),
  piezas_requeridas        int,
  -- numeric sin límite de decimales: el SCA trae precios por pieza como 16.6667
  -- ("3 x $50") y algunos residuos de redondeo. Se guardan EXACTOS como vienen;
  -- el script reporta los que traen más de 2 decimales (no se redondean).
  precio_promo_pieza       numeric,
  precio_promo_grupo       numeric,
  precio_promo_total       numeric,
  precio_regular_al_inicio numeric
);

-- Llave natural: no se puede repetir dentro de un corte. "nulls not distinct"
-- hace que dos vacíos cuenten como iguales (sin inventar un valor como 0).
create unique index if not exists promociones_propias_llave
  on public.promociones_propias (fecha_corte, origen, id_promocion, id_grupo, clave)
  nulls not distinct;

create index if not exists promociones_propias_clave
  on public.promociones_propias (clave);

comment on table public.promociones_propias is
  'Promociones del SCA tal como vienen. Se guardan pero NO entran a la comparación en esta versión. Sin datos de venta.';


-- -----------------------------------------------------------------------------
-- BLOQUE 4. precio_propio_vigente(clave, fecha): nuestro precio regular en una
-- fecha = el del corte más reciente con fecha_corte <= fecha. Si la fecha es
-- anterior al primer corte, el del corte más cercano, con corte_posterior = true.
-- No recibe plaza: el precio regular es el mismo en toda la cadena.
-- El mayoreo y las promociones NO cuentan.
-- -----------------------------------------------------------------------------
create or replace function public.precio_propio_vigente(p_clave text, p_fecha date)
returns table (clave text, precio_regular numeric, fecha_corte_usada date, corte_posterior boolean)
language sql stable
set search_path = ''
as $$
  select c.clave, c.precio_regular, c.fecha_corte, c.fecha_corte > p_fecha
  from public.catalogo_propio_cortes c
  where c.clave = p_clave
  order by (c.fecha_corte > p_fecha), abs(c.fecha_corte - p_fecha)
  limit 1;
$$;


-- -----------------------------------------------------------------------------
-- BLOQUE 5. Vista catalogo_propio_actual: cada artículo con el precio de su
-- último corte y si está ACTIVO. Activo = aparece en el corte más reciente,
-- no obsoleto, no de baja, no servicio y precio regular > 0.
-- security_invoker = true: usa los permisos de quien consulta (anon no puede).
-- -----------------------------------------------------------------------------
create or replace view public.catalogo_propio_actual
with (security_invoker = true) as
with ultimo as (
  select max(fecha_corte) as fecha_corte from public.catalogo_propio_cortes
)
select
  a.clave,
  a.descripcion,
  a.area_id,
  a.area,
  a.depto_id,
  a.departamento,
  a.nacs_subcategoria_id,
  a.nacs_categoria_id,
  a.nacs_categoria,
  a.cantidad,
  a.unidad,
  a.piezas,
  a.unidad_base,
  a.contenido_base,
  a.contenido_origen,
  a.es_servicio,
  a.obsoleto,
  a.de_baja,
  a.fecha_corte_ultimo,
  c.precio_regular,
  c.fecha_ultimo_cambio_precio,
  (a.fecha_corte_ultimo = u.fecha_corte
     and not a.obsoleto and not a.de_baja and not a.es_servicio
     and coalesce(c.precio_regular, 0) > 0) as activo
from public.catalogo_propio a
cross join ultimo u
left join public.catalogo_propio_cortes c
  on c.clave = a.clave and c.fecha_corte = a.fecha_corte_ultimo;

comment on column public.catalogo_propio_actual.activo is
  'Aparece en el corte más reciente, no obsoleto, no de baja, no servicio y precio regular > 0.';


-- -----------------------------------------------------------------------------
-- BLOQUE 6. importar_corte: carga UN corte completo. TODO O NADA.
--
-- Por qué es todo o nada: una función de Postgres llamada por la API (rpc)
-- corre en UNA sola transacción. Si cualquier paso falla (un dato que no cabe,
-- una regla check, una comprobación final que no cuadra), Postgres deshace TODO
-- lo que la función hizo; no queda nada a medias.
--
-- Parámetros:
--   p_fecha_corte  la fecha del corte (todas las filas del paquete la comparten).
--   p_articulos    lista JSON, un objeto por artículo (nombres = columnas de abajo).
--   p_promociones  lista JSON, un objeto por renglón de promoción.
--   p_simular      true = NO escribe nada: solo calcula cuántas filas se
--                  insertarían, actualizarían y borrarían. Default true, para
--                  que un olvido nunca escriba.
--
-- Al escribir (p_simular = false):
--   1. catalogo_propio: inserta los artículos nuevos; actualiza los existentes
--      SOLO si este corte es igual o más reciente que su último corte (un corte
--      viejo no pisa datos nuevos). El contenido 'manual' nunca se toca.
--      Ningún artículo se borra.
--   2. catalogo_propio_cortes y promociones_propias: borra lo de ESTA fecha de
--      corte y lo vuelve a insertar (reimportar el mismo corte no duplica).
--   3. Comprueba (y si algo no cuadra, lanza error → se deshace todo):
--      conteos guardados = conteos recibidos, y precio_propio_vigente en la
--      fecha de corte = precio del archivo para cada artículo.
--
-- Devuelve un JSON con conteos (sin claves, nombres ni precios).
-- -----------------------------------------------------------------------------
create or replace function public.importar_corte(
  p_fecha_corte date, p_articulos jsonb, p_promociones jsonb, p_simular boolean default true)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_ultimo_corte      date;
  v_n_art             int;
  v_n_prom            int;
  v_art_nuevos        int;
  v_art_actualizar    int;
  v_art_corte_viejo   int;
  v_art_manual        int;
  v_cortes_borrar     int;
  v_prom_borrar       int;
  v_precio_cambiado   int;
  v_precio_igual      int;
  v_sin_corte_previo  int;
  v_conteos           jsonb;
  v_n                 int;
begin
  if p_fecha_corte is null then
    raise exception 'Falta la fecha de corte';
  end if;
  if jsonb_typeof(p_articulos) is distinct from 'array'
     or jsonb_typeof(p_promociones) is distinct from 'array' then
    raise exception 'p_articulos y p_promociones deben ser listas JSON';
  end if;
  if jsonb_array_length(p_articulos) = 0 then
    raise exception 'El corte no trae artículos';
  end if;

  -- Una sola importación a la vez (si alguien corre el script dos veces juntas).
  perform pg_advisory_xact_lock(hashtext('public.importar_corte'));

  -- Datos recibidos, en tablas temporales (desaparecen al terminar).
  drop table if exists pg_temp.tmp_art;
  drop table if exists pg_temp.tmp_prom;

  create temp table tmp_art on commit drop as
  select * from jsonb_to_recordset(p_articulos) as a(
    clave text, descripcion text, area_id int, area text, depto_id int, departamento text,
    nacs_subcategoria_id text, nacs_categoria_id text, nacs_categoria text,
    cantidad numeric, unidad text, es_servicio boolean, obsoleto boolean, de_baja boolean,
    precio_regular numeric, fecha_ultimo_cambio_precio date);

  create temp table tmp_prom on commit drop as
  select * from jsonb_to_recordset(p_promociones) as p(
    origen text, id_promocion int, categoria_promo_id int, categoria_promo text,
    descripcion_promo text, regiones text, fecha_inicio date, fecha_fin date,
    activa boolean, vigente_al_corte boolean, es_combo boolean, num_grupos int,
    id_grupo int, clave text, piezas_requeridas int, precio_promo_pieza numeric,
    precio_promo_grupo numeric, precio_promo_total numeric, precio_regular_al_inicio numeric);

  select count(*) into v_n_art from pg_temp.tmp_art;
  select count(*) into v_n_prom from pg_temp.tmp_prom;

  if (select count(distinct clave) from pg_temp.tmp_art) <> v_n_art
     or exists (select 1 from pg_temp.tmp_art where clave is null) then
    raise exception 'Claves de artículo vacías o repetidas en el corte';
  end if;
  -- precio_regular se guarda con 2 decimales: si trajera más, Postgres lo
  -- redondearía en silencio. Se detiene en vez de redondear.
  select count(*) into v_n from pg_temp.tmp_art
  where precio_regular is null or precio_regular <> round(precio_regular, 2);
  if v_n > 0 then
    raise exception '% artículos sin precio regular o con más de 2 decimales', v_n;
  end if;

  -- ---- Conteos (lo que se haría) ----
  select max(fecha_corte) into v_ultimo_corte from public.catalogo_propio_cortes;

  select count(*) filter (where c.clave is null),
         count(*) filter (where c.clave is not null and p_fecha_corte >= c.fecha_corte_ultimo),
         count(*) filter (where c.clave is not null and p_fecha_corte <  c.fecha_corte_ultimo),
         count(*) filter (where c.clave is not null and p_fecha_corte >= c.fecha_corte_ultimo
                                and c.contenido_origen = 'manual')
    into v_art_nuevos, v_art_actualizar, v_art_corte_viejo, v_art_manual
  from pg_temp.tmp_art a
  left join public.catalogo_propio c on c.clave = a.clave;

  select count(*) into v_cortes_borrar
  from public.catalogo_propio_cortes where fecha_corte = p_fecha_corte;

  select count(*) into v_prom_borrar
  from public.promociones_propias where fecha_corte = p_fecha_corte;

  -- Precio contra el corte ANTERIOR más reciente (sin contar este mismo corte).
  select count(*) filter (where prev.precio_regular is not null
                                and prev.precio_regular <> a.precio_regular),
         count(*) filter (where prev.precio_regular = a.precio_regular),
         count(*) filter (where prev.precio_regular is null)
    into v_precio_cambiado, v_precio_igual, v_sin_corte_previo
  from pg_temp.tmp_art a
  left join lateral (
    select c.precio_regular
    from public.catalogo_propio_cortes c
    where c.clave = a.clave and c.fecha_corte < p_fecha_corte
    order by c.fecha_corte desc
    limit 1
  ) prev on true;

  v_conteos := jsonb_build_object(
    'simulacion',                       p_simular,
    'fecha_corte',                      p_fecha_corte,
    'ultimo_corte_en_base',             v_ultimo_corte,
    'corte_mas_viejo_que_el_ultimo',    coalesce(p_fecha_corte < v_ultimo_corte, false),
    'reimporta_corte_existente',        v_cortes_borrar > 0 or v_prom_borrar > 0,
    'articulos_insertar',               v_art_nuevos,
    'articulos_actualizar',             v_art_actualizar,
    'articulos_no_tocar_corte_viejo',   v_art_corte_viejo,
    'articulos_contenido_manual_respetado', v_art_manual,
    'cortes_borrar',                    v_cortes_borrar,
    'cortes_insertar',                  v_n_art,
    'promociones_borrar',               v_prom_borrar,
    'promociones_insertar',             v_n_prom,
    'precio_cambiado_vs_corte_anterior', v_precio_cambiado,
    'precio_igual_vs_corte_anterior',   v_precio_igual,
    'sin_corte_anterior',               v_sin_corte_previo
  );

  if p_simular then
    return v_conteos;    -- simulación: no se escribe NADA
  end if;

  -- ---- 1. Artículos (upsert; nunca se borran) ----
  insert into public.catalogo_propio as c (
    clave, descripcion, area_id, area, depto_id, departamento,
    nacs_subcategoria_id, nacs_categoria_id, nacs_categoria,
    cantidad, unidad, piezas, contenido_origen,
    es_servicio, obsoleto, de_baja, fecha_corte_ultimo, actualizado_at)
  select
    a.clave, a.descripcion, a.area_id, a.area, a.depto_id, a.departamento,
    a.nacs_subcategoria_id, a.nacs_categoria_id, a.nacs_categoria,
    a.cantidad, a.unidad, 1,
    case when a.cantidad is null then 'sin_dato' else 'archivo' end,
    a.es_servicio, a.obsoleto, a.de_baja, p_fecha_corte, now()
  from pg_temp.tmp_art a
  on conflict (clave) do update set
    descripcion          = excluded.descripcion,
    area_id              = excluded.area_id,
    area                 = excluded.area,
    depto_id             = excluded.depto_id,
    departamento         = excluded.departamento,
    nacs_subcategoria_id = excluded.nacs_subcategoria_id,
    nacs_categoria_id    = excluded.nacs_categoria_id,
    nacs_categoria       = excluded.nacs_categoria,
    cantidad         = case when c.contenido_origen = 'manual' then c.cantidad else excluded.cantidad end,
    unidad           = case when c.contenido_origen = 'manual' then c.unidad else excluded.unidad end,
    piezas           = case when c.contenido_origen = 'manual' then c.piezas else excluded.piezas end,
    contenido_origen = case when c.contenido_origen = 'manual' then 'manual' else excluded.contenido_origen end,
    es_servicio          = excluded.es_servicio,
    obsoleto             = excluded.obsoleto,
    de_baja              = excluded.de_baja,
    fecha_corte_ultimo   = excluded.fecha_corte_ultimo,
    actualizado_at       = now()
  where c.fecha_corte_ultimo <= excluded.fecha_corte_ultimo;   -- un corte viejo no pisa

  -- ---- 2. Cortes y promociones de ESTA fecha: se reemplazan completos ----
  delete from public.catalogo_propio_cortes where fecha_corte = p_fecha_corte;
  insert into public.catalogo_propio_cortes (fecha_corte, clave, precio_regular, fecha_ultimo_cambio_precio)
  select p_fecha_corte, a.clave, a.precio_regular, a.fecha_ultimo_cambio_precio
  from pg_temp.tmp_art a;

  delete from public.promociones_propias where fecha_corte = p_fecha_corte;
  insert into public.promociones_propias (
    fecha_corte, origen, id_promocion, categoria_promo_id, categoria_promo, descripcion_promo,
    regiones, fecha_inicio, fecha_fin, activa, vigente_al_corte, es_combo, num_grupos,
    id_grupo, clave, piezas_requeridas, precio_promo_pieza, precio_promo_grupo,
    precio_promo_total, precio_regular_al_inicio)
  select
    p_fecha_corte, p.origen, p.id_promocion, p.categoria_promo_id, p.categoria_promo, p.descripcion_promo,
    p.regiones, p.fecha_inicio, p.fecha_fin, p.activa, p.vigente_al_corte, p.es_combo, p.num_grupos,
    p.id_grupo, p.clave, p.piezas_requeridas, p.precio_promo_pieza, p.precio_promo_grupo,
    p.precio_promo_total, p.precio_regular_al_inicio
  from pg_temp.tmp_prom p;

  -- ---- 3. Comprobaciones: si algo no cuadra, se deshace TODO ----
  select count(*) into v_n from public.catalogo_propio_cortes where fecha_corte = p_fecha_corte;
  if v_n <> v_n_art then
    raise exception 'Comprobación: cortes guardados (%) <> artículos recibidos (%)', v_n, v_n_art;
  end if;

  select count(*) into v_n from public.promociones_propias where fecha_corte = p_fecha_corte;
  if v_n <> v_n_prom then
    raise exception 'Comprobación: promociones guardadas (%) <> recibidas (%)', v_n, v_n_prom;
  end if;

  select count(*) into v_n
  from pg_temp.tmp_art a
  where not exists (select 1 from public.catalogo_propio c where c.clave = a.clave);
  if v_n > 0 then
    raise exception 'Comprobación: % artículos no quedaron en catalogo_propio', v_n;
  end if;

  select count(*) into v_n
  from pg_temp.tmp_art a
  where (select v.precio_regular from public.precio_propio_vigente(a.clave, p_fecha_corte) v)
        is distinct from a.precio_regular;
  if v_n > 0 then
    raise exception 'Comprobación: precio_propio_vigente no da el precio del archivo en % artículos', v_n;
  end if;

  return v_conteos || jsonb_build_object('comprobaciones_ok', true);
end;
$$;


-- -----------------------------------------------------------------------------
-- BLOQUE 7. Permisos. Todo lo nuevo queda CERRADO para el público:
--   - anon (la app sin login) y authenticated: NADA (ni leer, ni escribir, ni
--     ejecutar las funciones).
--   - RLS activado y SIN ninguna política.
--   - Solo service_role (la secret key, en el script local) y el SQL Editor.
-- -----------------------------------------------------------------------------
alter table public.catalogo_propio        enable row level security;
alter table public.catalogo_propio_cortes enable row level security;
alter table public.promociones_propias    enable row level security;

revoke all on table public.catalogo_propio, public.catalogo_propio_cortes,
                    public.promociones_propias, public.catalogo_propio_actual
  from public, anon, authenticated;
grant select, insert, update, delete on table public.catalogo_propio, public.catalogo_propio_cortes,
                                              public.promociones_propias
  to service_role;
grant select on table public.catalogo_propio_actual to service_role;

revoke all on sequence public.promociones_propias_id_seq from public, anon, authenticated;
grant usage, select on sequence public.promociones_propias_id_seq to service_role;

revoke all on function public.precio_propio_vigente(text, date)                  from public, anon, authenticated;
revoke all on function public.importar_corte(date, jsonb, jsonb, boolean)        from public, anon, authenticated;
grant execute on function public.precio_propio_vigente(text, date)               to service_role;
grant execute on function public.importar_corte(date, jsonb, jsonb, boolean)     to service_role;


-- -----------------------------------------------------------------------------
-- BLOQUE 8. Comprobación (solo lee; no cambia nada).
-- Todas las filas deben salir con ok = true.
-- -----------------------------------------------------------------------------
with objetos(nombre) as (
  values ('public.catalogo_propio'), ('public.catalogo_propio_cortes'),
         ('public.promociones_propias'), ('public.catalogo_propio_actual')
),
funciones(firma) as (
  values ('public.precio_propio_vigente(text, date)'),
         ('public.importar_corte(date, jsonb, jsonb, boolean)')
)
select 'anon NO tiene ningún permiso sobre ' || nombre as comprobacion,
       not has_table_privilege('anon', nombre,
             'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') as ok
from objetos
union all
select 'authenticated NO tiene ningún permiso sobre ' || nombre,
       not has_table_privilege('authenticated', nombre,
             'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
from objetos
union all
select 'anon NO puede ejecutar ' || firma,
       not has_function_privilege('anon', firma, 'EXECUTE')
from funciones
union all
select 'authenticated NO puede ejecutar ' || firma,
       not has_function_privilege('authenticated', firma, 'EXECUTE')
from funciones
union all
select 'service_role SÍ puede ejecutar ' || firma,
       has_function_privilege('service_role', firma, 'EXECUTE')
from funciones
union all
select 'anon NO puede usar la secuencia de promociones_propias',
       not has_sequence_privilege('anon', 'public.promociones_propias_id_seq', 'USAGE, SELECT, UPDATE')
union all
select 'RLS activado en ' || c.relname::text, c.relrowsecurity
from pg_class c
where c.oid in ('public.catalogo_propio'::regclass, 'public.catalogo_propio_cortes'::regclass,
                'public.promociones_propias'::regclass)
union all
select 'Ninguna política en las tablas del catálogo',
       not exists (select 1 from pg_policies
                   where schemaname = 'public'
                     and tablename in ('catalogo_propio', 'catalogo_propio_cortes', 'promociones_propias'))
union all
select 'La vista catalogo_propio_actual usa security_invoker',
       coalesce((select 'security_invoker=true' = any (c.reloptions)
                 from pg_class c where c.oid = 'public.catalogo_propio_actual'::regclass), false)
union all
select 'Sin columnas de venta, mayoreo ni impuestos en las tablas del catálogo',
       not exists (select 1 from information_schema.columns
                   where table_schema = 'public'
                     and table_name in ('catalogo_propio', 'catalogo_propio_cortes', 'promociones_propias')
                     and (column_name like '%venta%' or column_name like '%vendid%'
                          or column_name like '%mayoreo%' or column_name like '%tasa%'
                          or column_name like '%impuesto%' or column_name like 'piezas_12m'
                          or column_name in ('descuento_pct', 'precio_normal_registrado', 'clave_es_ean')))
union all
select 'clave es texto en las 3 tablas',
       (select count(*) = 3 from information_schema.columns
        where table_schema = 'public' and column_name = 'clave' and data_type = 'text'
          and table_name in ('catalogo_propio', 'catalogo_propio_cortes', 'promociones_propias'))
union all
select 'Contenido de ejemplo: 600 ml da contenido_base 600',
       public.normalizar_contenido_base(600, 'ml', 1) = 600;
