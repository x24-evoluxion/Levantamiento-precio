-- =============================================================================
-- 004_tablas_competencia.sql — Tablas de la competencia (Etapa 2, Fase E2-2)
-- =============================================================================
-- Cómo usarlo: copia TODO este archivo en Supabase → SQL Editor → Run.
-- Se puede ejecutar más de una vez sin romper nada (todo usa "if not exists",
-- "create or replace" o "drop ... if exists" antes de volver a crear).
--
-- Qué hace (solo ESTRUCTURA: las tablas nuevas quedan VACÍAS; las llenan las
-- fases de agentes, que todavía no existen):
--   BLOQUE 1. Funciones de cálculo (unidades, contenido, clave del artículo).
--   BLOQUE 2. Tabla lotes_proceso        (cada envío de fotos a leer).
--   BLOQUE 3. Columnas nuevas en fotos   (estado de procesamiento y calidad).
--   BLOQUE 4. Borrado en cascada fotos ← visitas (para borrar datos de prueba).
--   BLOQUE 5. Tabla articulos_competencia (un artículo distinto de la competencia).
--   BLOQUE 6. Tabla lecturas_precio      (cada precio leído en una foto).
--   BLOQUE 7. Función guardar_lecturas   (guarda las lecturas de una foto, todo o nada).
--   BLOQUE 8. Vista lecturas_analisis    (lectura + foto + visita + competidor).
--   BLOQUE 9. Permisos: todo lo nuevo CERRADO para anon y authenticated.
--   BLOQUE 10. Comprobación (solo lee).
--
-- Efecto en la app publicada: ninguno. La app sigue pudiendo leer y crear
-- visitas y fotos igual que antes. Las fotos existentes quedan 'pendiente'.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- BLOQUE 1. Funciones de cálculo.
-- Son "immutable": con los mismos datos de entrada siempre dan lo mismo. Por eso
-- Postgres permite usarlas en columnas GENERADAS (que nadie escribe a mano).
-- La Fase E2-3 usará estas mismas funciones en nuestro catálogo, para que los dos
-- lados se normalicen igual.
-- -----------------------------------------------------------------------------

-- Unidad base: kg → g, l → ml, pza → pza.
create or replace function public.normalizar_unidad_base(p_unidad text)
returns text
language sql immutable parallel safe
set search_path = ''
as $$
  select case p_unidad
           when 'g'   then 'g'
           when 'kg'  then 'g'
           when 'ml'  then 'ml'
           when 'l'   then 'ml'
           when 'pza' then 'pza'
         end;
$$;

-- Contenido total en la unidad base: cantidad × piezas × (1000 si kg o l).
-- Ej. "6 × 355 ml" → 355 × 6 = 2130 ml.   "1.5 l" → 1.5 × 1 × 1000 = 1500 ml.
create or replace function public.normalizar_contenido_base(
  p_cantidad numeric, p_unidad text, p_piezas int)
returns numeric
language sql immutable parallel safe
set search_path = ''
as $$
  select p_cantidad * p_piezas * case when p_unidad in ('kg', 'l') then 1000 else 1 end;
$$;

-- Texto para comparar: minúsculas, sin acentos, sin espacios dobles ni a los lados.
create or replace function public.normalizar_texto(p_texto text)
returns text
language sql immutable parallel safe
set search_path = ''
as $$
  select btrim(regexp_replace(
           translate(lower(coalesce(p_texto, '')),
                     'áàäâãéèëêíìïîóòöôõúùüûñç',
                     'aaaaaeeeeiiiiooooouuuunc'),
           '\s+', ' ', 'g'));
$$;

-- Clave única de un artículo de la competencia (para no crear duplicados):
-- marca | artículo | contenido de UNA pieza en unidad base | unidad base | piezas.
-- "1 l" y "1000 ml" dan la misma clave. Ej. inventado:
--   ('Marca X', 'Refresco cola', 355, 'ml', 6) → 'marca x|refresco cola|355|ml|6'
create or replace function public.clave_articulo_competencia(
  p_marca text, p_articulo text, p_cantidad numeric, p_unidad text, p_piezas int)
returns text
language sql immutable parallel safe
set search_path = ''
as $$
  select public.normalizar_texto(p_marca)
      || '|' || public.normalizar_texto(p_articulo)
      || '|' || coalesce(trim_scale(public.normalizar_contenido_base(p_cantidad, p_unidad, 1))::text, '')
      || '|' || coalesce(public.normalizar_unidad_base(p_unidad), '')
      || '|' || p_piezas::text;
$$;


-- -----------------------------------------------------------------------------
-- BLOQUE 2. Tabla lotes_proceso: cada vez que se mandan fotos a leer en lote.
-- -----------------------------------------------------------------------------
create table if not exists public.lotes_proceso (
  id                  text primary key check (btrim(id) <> ''),   -- id que da Anthropic (msgbatch_...)
  tipo                text not null default 'lectura_fotos'
                        check (tipo in ('lectura_fotos')),
  modelo              text not null check (btrim(modelo) <> ''),
  estado              text not null default 'en_proceso'
                        check (estado in ('en_proceso', 'recogido', 'cancelado')),
  total               int    not null default 0 check (total >= 0),
  ok                  int    not null default 0 check (ok >= 0),
  con_error           int    not null default 0 check (con_error >= 0),
  tokens_entrada      bigint not null default 0 check (tokens_entrada >= 0),
  tokens_salida       bigint not null default 0 check (tokens_salida >= 0),
  costo_estimado_usd  numeric(10,4) check (costo_estimado_usd >= 0),
  created_at          timestamptz not null default now(),
  recogido_at         timestamptz
);


-- -----------------------------------------------------------------------------
-- BLOQUE 3. Columnas nuevas en fotos (estado de procesamiento y calidad).
-- Las fotos que ya existen quedan con estado_proceso = 'pendiente' e intentos = 0.
-- La app ("anon") NO recibe permiso de escribir estas columnas.
-- -----------------------------------------------------------------------------
alter table public.fotos
  add column if not exists estado_proceso text not null default 'pendiente',
  add column if not exists calidad        text,
  add column if not exists motivo_calidad text,
  add column if not exists lote_id        text,
  add column if not exists intentos       int  not null default 0,
  add column if not exists error_proceso  text,
  add column if not exists procesada_at   timestamptz;

alter table public.fotos drop constraint if exists fotos_estado_proceso_valido;
alter table public.fotos add constraint fotos_estado_proceso_valido
  check (estado_proceso in ('pendiente', 'en_lote', 'procesada', 'error'));

alter table public.fotos drop constraint if exists fotos_calidad_valida;
alter table public.fotos add constraint fotos_calidad_valida
  check (calidad is null
         or calidad in ('legible', 'borrosa', 'reflejo', 'lejana', 'sin_precios'));

alter table public.fotos drop constraint if exists fotos_intentos_valido;
alter table public.fotos add constraint fotos_intentos_valido
  check (intentos >= 0);

-- Si se borra un lote, la foto se queda (solo pierde la referencia al lote).
alter table public.fotos drop constraint if exists fotos_lote_id_fkey;
alter table public.fotos add constraint fotos_lote_id_fkey
  foreign key (lote_id) references public.lotes_proceso (id) on delete set null;

create index if not exists fotos_estado_proceso_idx on public.fotos (estado_proceso);


-- -----------------------------------------------------------------------------
-- BLOQUE 4. Borrar una visita borra también sus filas de fotos (y, por el
-- bloque 6, las lecturas de esas fotos). Antes, borrar una visita con fotos
-- daba error. Solo se cambia QUÉ PASA AL BORRAR; la relación es la misma.
-- La app no puede borrar (anon no tiene permiso), así que esto solo aplica a
-- quien borra desde el Table Editor o el SQL Editor.
-- ⚠️ Los ARCHIVOS de las fotos en Storage NO se borran solos: se borran a mano
--    en Storage → fotos → visitas/<id de la visita>/.
-- -----------------------------------------------------------------------------
alter table public.fotos drop constraint if exists fotos_visita_id_fkey;
alter table public.fotos add constraint fotos_visita_id_fkey
  foreign key (visita_id) references public.visitas (id) on delete cascade;


-- -----------------------------------------------------------------------------
-- BLOQUE 5. Tabla articulos_competencia: UNA fila por artículo distinto que se
-- haya visto en la competencia. Las lecturas apuntan aquí, así la equivalencia
-- con nuestro catálogo (Fase E2-4) se aprueba una sola vez por artículo.
-- -----------------------------------------------------------------------------
create table if not exists public.articulos_competencia (
  id                 bigint generated always as identity primary key,
  marca              text,
  articulo           text not null check (btrim(articulo) <> ''),
  cantidad           numeric(10,3) check (cantidad > 0),          -- de UNA pieza
  unidad             text check (unidad in ('g', 'kg', 'ml', 'l', 'pza')),
  piezas             int  not null default 1 check (piezas >= 1),
  unidad_base        text    generated always as (public.normalizar_unidad_base(unidad)) stored,
  contenido_base     numeric generated always as (public.normalizar_contenido_base(cantidad, unidad, piezas)) stored,
  ean                text,
  clave_normalizada  text not null generated always as
                       (public.clave_articulo_competencia(marca, articulo, cantidad, unidad, piezas)) stored,
  created_at         timestamptz not null default now(),
  -- Cantidad y unidad van juntas: las dos o ninguna.
  constraint articulos_competencia_cantidad_y_unidad
    check ((cantidad is null) = (unidad is null)),
  constraint articulos_competencia_clave_unica unique (clave_normalizada)
);


-- -----------------------------------------------------------------------------
-- BLOQUE 6. Tabla lecturas_precio: una fila por cada producto con precio visto
-- en una foto (una foto puede tener 0, 1 o muchas).
--
-- PRECIOS: se guarda lo que DICE LA ETIQUETA, y la base calcula lo demás.
--   precio_regular       → el total que dice la etiqueta por la presentación
--                          completa (si es paquete de 6, el precio del paquete).
--   precio_regular_pieza → GENERADA: precio_regular ÷ piezas.
--   precio_promo_pieza   → GENERADA, según promo_tipo (siempre por pieza individual):
--     precio_rebajado, n_por_precio: promo_precio_total ÷ promo_piezas ÷ piezas
--     nxm             : precio_regular ÷ piezas × promo_paga_piezas ÷ promo_piezas
--     n_al_porcentaje : precio_regular ÷ piezas × (promo_piezas − promo_descuento_pct/100) ÷ promo_piezas
--     combo, mayoreo, otro, ninguna: vacío (no hay precio comparable)
--   promo_piezas cuenta lo que se vende en la etiqueta (piezas sueltas o paquetes).
-- Nadie escribe estas columnas generadas: si se intenta, Postgres da error.
-- -----------------------------------------------------------------------------
create table if not exists public.lecturas_precio (
  id                       uuid primary key default gen_random_uuid(),
  -- Si se borra la foto, se borran sus lecturas (no tienen sentido sin la foto).
  foto_id                  uuid not null references public.fotos (id) on delete cascade,
  orden_en_foto            int  not null check (orden_en_foto >= 1),
  -- Si se borra el artículo, la lectura se queda sin artículo (se puede volver a ligar).
  articulo_competencia_id  bigint references public.articulos_competencia (id) on delete set null,

  -- Qué producto es
  articulo                 text,
  marca                    text,
  cantidad                 numeric(10,3) check (cantidad > 0),     -- de UNA pieza
  unidad                   text check (unidad in ('g', 'kg', 'ml', 'l', 'pza')),
  piezas                   int  not null default 1 check (piezas >= 1),
  unidad_base              text    generated always as (public.normalizar_unidad_base(unidad)) stored,
  contenido_base           numeric generated always as (public.normalizar_contenido_base(cantidad, unidad, piezas)) stored,
  ean                      text,
  codigo_interno           text,

  -- Precio regular (lo que dice la etiqueta) y su cálculo por pieza
  precio_regular           numeric(10,2) check (precio_regular >= 0),
  precio_regular_pieza     numeric(10,2) generated always as (round(precio_regular / piezas, 2)) stored,

  -- Promoción (se copian los números de la etiqueta; la base calcula)
  promo_tipo               text not null default 'ninguna'
                             check (promo_tipo in ('ninguna', 'precio_rebajado', 'n_por_precio', 'nxm',
                                                   'n_al_porcentaje', 'combo', 'mayoreo', 'otro')),
  promo_piezas             int check (promo_piezas >= 1),
  promo_precio_total       numeric(10,2) check (promo_precio_total >= 0),
  promo_paga_piezas        int,
  promo_descuento_pct      numeric(5,2),
  promo_condicion          text not null default 'ninguna'
                             check (promo_condicion in ('ninguna', 'tarjeta', 'monedero', 'app',
                                                        'dia_especifico', 'otro')),
  precio_promo_pieza       numeric(10,2) generated always as (
                             case promo_tipo
                               when 'precio_rebajado' then round(promo_precio_total / promo_piezas / piezas, 2)
                               when 'n_por_precio'    then round(promo_precio_total / promo_piezas / piezas, 2)
                               when 'nxm'             then round(precio_regular / piezas * promo_paga_piezas / promo_piezas, 2)
                               when 'n_al_porcentaje' then round(precio_regular / piezas
                                                                 * (promo_piezas - promo_descuento_pct / 100)
                                                                 / promo_piezas, 2)
                             end) stored,
  vigencia_fin             date,
  texto_promocion          text,
  texto_leido              text,

  -- Calidad y confianza
  calidad                  text check (calidad in ('legible', 'borrosa', 'reflejo', 'lejana', 'cortada')),
  confianza_articulo       text not null check (confianza_articulo     in ('alta', 'media', 'baja')),
  confianza_presentacion   text not null check (confianza_presentacion in ('alta', 'media', 'baja')),
  confianza_precio         text not null check (confianza_precio       in ('alta', 'media', 'baja')),
  motivo_duda              text,

  -- Estado y revisión
  estado                   text not null default 'por_revisar'
                             check (estado in ('propuesta', 'por_revisar', 'aprobada', 'corregida', 'descartada')),
  valores_agente           jsonb not null check (jsonb_typeof(valores_agente) = 'object'),
  discrepancia             text,
  modelo                   text not null check (btrim(modelo) <> ''),
  -- Si se borra el lote, la lectura se queda (solo pierde la referencia).
  lote_id                  text references public.lotes_proceso (id) on delete set null,
  revisada_por             text,
  revisada_at              timestamptz,
  created_at               timestamptz not null default now(),

  constraint lecturas_precio_orden_unico unique (foto_id, orden_en_foto),
  constraint lecturas_precio_cantidad_y_unidad
    check ((cantidad is null) = (unidad is null)),
  -- Sin promoción → sin datos de promoción.
  constraint lecturas_precio_sin_promo_sin_datos
    check (promo_tipo <> 'ninguna'
           or (promo_piezas is null and promo_precio_total is null
               and promo_paga_piezas is null and promo_descuento_pct is null)),
  -- "Lleva 3 paga 2": solo en nxm, y paga menos de las que lleva.
  constraint lecturas_precio_paga_piezas_valido
    check (promo_paga_piezas is null
           or (promo_tipo = 'nxm' and promo_paga_piezas >= 1 and promo_paga_piezas < promo_piezas)),
  -- "2.º al 50 %": solo en n_al_porcentaje, entre 0 y 100.
  constraint lecturas_precio_descuento_valido
    check (promo_descuento_pct is null
           or (promo_tipo = 'n_al_porcentaje' and promo_descuento_pct > 0 and promo_descuento_pct <= 100))
);

create index if not exists lecturas_precio_articulo_idx on public.lecturas_precio (articulo_competencia_id);
create index if not exists lecturas_precio_estado_idx   on public.lecturas_precio (estado);

-- valores_agente es la copia SIN TOCAR de lo que respondió el agente: no se puede cambiar.
create or replace function public.lecturas_precio_proteger_valores_agente()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.valores_agente is distinct from old.valores_agente then
    raise exception 'valores_agente no se puede cambiar: es la respuesta original del agente. Corrige las otras columnas.';
  end if;
  return new;
end;
$$;

drop trigger if exists lecturas_precio_proteger_valores_agente on public.lecturas_precio;
create trigger lecturas_precio_proteger_valores_agente
  before update on public.lecturas_precio
  for each row execute function public.lecturas_precio_proteger_valores_agente();


-- -----------------------------------------------------------------------------
-- BLOQUE 7. Función guardar_lecturas (la usará la fase de lotes; hoy nadie la llama).
-- Guarda TODAS las lecturas de una foto de una sola vez (todo o nada):
--   - Si la foto ya está 'procesada', no hace nada y devuelve null (no duplica).
--   - Si no, borra lecturas de un intento a medias, inserta las nuevas y marca
--     la foto 'procesada' con su calidad. Devuelve cuántas lecturas guardó.
-- p_lecturas es una lista JSON; cada elemento usa los nombres de columna de
-- lecturas_precio (sin id, foto_id, columnas generadas ni created_at).
-- -----------------------------------------------------------------------------
create or replace function public.guardar_lecturas(
  p_foto_id uuid, p_calidad text, p_motivo_calidad text, p_lecturas jsonb)
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_estado text;
  v_n      int;
begin
  select estado_proceso into v_estado
  from public.fotos where id = p_foto_id
  for update;                                   -- evita que dos procesos guarden a la vez

  if not found then
    raise exception 'No existe la foto %', p_foto_id;
  end if;
  if v_estado = 'procesada' then
    return null;
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


-- -----------------------------------------------------------------------------
-- BLOQUE 8. Vista lecturas_analisis: lectura + foto + visita + competidor, sin las
-- 'descartada'. Para revisar y para consultas rápidas.
-- security_invoker = true: la vista usa los permisos de QUIEN consulta, así anon
-- no puede leerla aunque Supabase publique las vistas en su API.
-- -----------------------------------------------------------------------------
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
where l.estado <> 'descartada';


-- -----------------------------------------------------------------------------
-- BLOQUE 9. Permisos. Todo lo nuevo queda CERRADO para el público:
--   - anon (la app sin login) y authenticated: NADA (ni leer ni escribir).
--   - RLS activado y SIN ninguna política → aunque alguien diera un permiso por
--     error, RLS seguiría bloqueando.
--   - Solo service_role (la secret key, en scripts locales) y el SQL Editor pueden.
-- Supabase da permisos a anon automáticamente a todo lo que se crea en "public";
-- por eso hay que quitarlos de forma explícita (revoke) cada vez.
-- -----------------------------------------------------------------------------
alter table public.lotes_proceso         enable row level security;
alter table public.articulos_competencia enable row level security;
alter table public.lecturas_precio       enable row level security;

revoke all on table public.lotes_proceso, public.articulos_competencia,
                    public.lecturas_precio, public.lecturas_analisis
  from public, anon, authenticated;
grant select, insert, update, delete on table public.lotes_proceso, public.articulos_competencia,
                                              public.lecturas_precio
  to service_role;
grant select on table public.lecturas_analisis to service_role;

revoke all on sequence public.articulos_competencia_id_seq from public, anon, authenticated;
grant usage, select on sequence public.articulos_competencia_id_seq to service_role;

revoke all on function public.normalizar_unidad_base(text)                               from public, anon, authenticated;
revoke all on function public.normalizar_contenido_base(numeric, text, int)              from public, anon, authenticated;
revoke all on function public.normalizar_texto(text)                                     from public, anon, authenticated;
revoke all on function public.clave_articulo_competencia(text, text, numeric, text, int) from public, anon, authenticated;
revoke all on function public.lecturas_precio_proteger_valores_agente()                  from public, anon, authenticated;
revoke all on function public.guardar_lecturas(uuid, text, text, jsonb)                  from public, anon, authenticated;

grant execute on function public.normalizar_unidad_base(text)                               to service_role;
grant execute on function public.normalizar_contenido_base(numeric, text, int)              to service_role;
grant execute on function public.normalizar_texto(text)                                     to service_role;
grant execute on function public.clave_articulo_competencia(text, text, numeric, text, int) to service_role;
grant execute on function public.guardar_lecturas(uuid, text, text, jsonb)                  to service_role;


-- -----------------------------------------------------------------------------
-- BLOQUE 10. Comprobación (solo lee; no cambia nada).
-- Todas las filas deben salir con ok = true.
-- -----------------------------------------------------------------------------
with objetos(nombre) as (
  values ('public.lotes_proceso'), ('public.articulos_competencia'),
         ('public.lecturas_precio'), ('public.lecturas_analisis')
),
funciones(firma) as (
  values ('public.normalizar_unidad_base(text)'),
         ('public.normalizar_contenido_base(numeric, text, int)'),
         ('public.normalizar_texto(text)'),
         ('public.clave_articulo_competencia(text, text, numeric, text, int)'),
         ('public.lecturas_precio_proteger_valores_agente()'),
         ('public.guardar_lecturas(uuid, text, text, jsonb)')
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
select 'anon NO puede usar la secuencia de articulos_competencia',
       not has_sequence_privilege('anon', 'public.articulos_competencia_id_seq', 'USAGE, SELECT, UPDATE')
union all
select 'RLS activado en ' || c.relname::text, c.relrowsecurity
from pg_class c
where c.oid in ('public.lotes_proceso'::regclass, 'public.articulos_competencia'::regclass,
                'public.lecturas_precio'::regclass)
union all
select 'Ninguna política en las tablas nuevas',
       not exists (select 1 from pg_policies
                   where schemaname = 'public'
                     and tablename in ('lotes_proceso', 'articulos_competencia', 'lecturas_precio'))
union all
select 'La app sigue pudiendo crear fotos (anon inserta ruta)',
       has_column_privilege('anon', 'public.fotos', 'ruta', 'INSERT')
union all
select 'La app NO puede escribir estado_proceso',
       not has_column_privilege('anon', 'public.fotos', 'estado_proceso', 'INSERT')
union all
select 'Borrar visita borra sus fotos (on delete cascade)',
       (select confdeltype = 'c' from pg_constraint
        where conname = 'fotos_visita_id_fkey' and conrelid = 'public.fotos'::regclass)
union all
select 'Todas las fotos tienen estado_proceso (viejas = pendiente)',
       not exists (select 1 from public.fotos where estado_proceso is null)
union all
select '"6 × 355 ml" da contenido_base 2130',
       public.normalizar_contenido_base(355, 'ml', 6) = 2130
union all
select '"1.5 l" da 1500 ml',
       public.normalizar_contenido_base(1.5, 'l', 1) = 1500
       and public.normalizar_unidad_base('l') = 'ml'
union all
select '"1 l" y "1000 ml" dan la misma clave de artículo',
       public.clave_articulo_competencia('Marca X', 'Agua', 1, 'l', 1)
         = public.clave_articulo_competencia('MARCA  x', 'Agua ', 1000, 'ml', 1);
