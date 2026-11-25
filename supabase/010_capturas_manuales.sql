-- =============================================================================
-- 010_capturas_manuales.sql — Captura manual de datos con sugerencias (ADITIVA)
-- =============================================================================
-- Cómo usarlo: copia TODO este archivo en Supabase → SQL Editor → Run.
-- Se puede ejecutar más de una vez sin romper nada ("if not exists",
-- "create or replace" y "drop policy if exists" + "create policy" dentro de la
-- misma transacción, así nunca hay un momento sin regla).
-- Todo va en una transacción: si algo falla, no se cambia nada.
--
-- Es ADITIVA: solo CREA cosas nuevas (una tabla, sus reglas y tres funciones).
-- No cambia visitas, fotos, competidores, Storage ni la Etapa 2. La app
-- publicada (la que no tiene la sección de captura manual) sigue igual.
--
-- Qué es: la persona de campo puede escribir a mano, en la pantalla de una
-- visita, una fila por producto (artículo, contenido, precio, marca, área,
-- promoción). Sirven después para comparar contra lo que lean los agentes y
-- como muestra verificada. En esta fase NINGÚN agente las lee.
--
-- Quién puede qué (rol authenticated = persona con sesión):
--   - Ver:      las filas de SUS visitas; el admin, todas.
--   - Crear:    solo en SUS visitas (también el admin: solo en las suyas).
--               El dueño (usuario_id) lo pone el servidor; la app no lo manda.
--   - Quitar:   poner descartada_at, solo en SUS propias filas, sin restaurar.
--   - Nadie:    cambiar otra columna, borrar.
--   - anon (sin sesión): nada.
--
-- Qué hace:
--   BLOQUE 0. Freno: si faltan 004, 005, 008 o 008b, se detiene sin cambiar nada.
--   BLOQUE 1. Normalización de unidad y contenido para authenticated (envoltorios
--             en el esquema privado de las MISMAS funciones de lecturas_precio).
--   BLOQUE 2. Tabla capturas_manuales con sus restricciones (CHECK).
--   BLOQUE 3. Hora del servidor al quitar una fila (trigger).
--   BLOQUE 4. Permisos de tabla y por columna.
--   BLOQUE 5. Reglas RLS de authenticated (con funciones de privado; nada de
--             subconsultas a otras tablas, ver 008b).
--   BLOQUE 6. Función sugerencias_captura(): solo (tipo, valor) de áreas y marcas.
--   BLOQUE 7. Comprobación (solo lee).
--
-- ⚠️ Efecto en comprobaciones viejas (es normal, no es un error):
--   - La comprobación final de 009 marca false en "Etapa 2: ninguna tabla o
--     vista abierta…" y "Etapa 2: ninguna función abierta…", porque ahora
--     authenticated SÍ puede usar capturas_manuales y sugerencias_captura (a
--     propósito). La comprobación de este archivo revisa que lo demás de la
--     Etapa 2 siga cerrado.
--   - La comprobación final de 008b marca false en "Las 5 funciones…" y "Las
--     reglas usan las funciones…" (ahora hay más funciones en privado y más
--     reglas que las usan).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- BLOQUE 0. Freno. Esta migración usa cosas de migraciones anteriores:
--   004 → funciones de normalización (normalizar_unidad_base, …_contenido_base,
--         normalizar_texto).
--   005 → catalogo_propio (de ahí salen los nombres de las áreas).
--   008 → visitas.usuario_id y es_admin().
--   008b → privado.es_dueno_de_visita y privado.puede_usar_visita.
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.normalizar_unidad_base(text)') is null
     or to_regprocedure('public.normalizar_contenido_base(numeric, text, integer)') is null
     or to_regprocedure('public.normalizar_texto(text)') is null
     or to_regclass('public.catalogo_propio') is null
     or not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'visitas'
                      and column_name = 'usuario_id')
     or to_regprocedure('public.es_admin()') is null
     or to_regprocedure('privado.es_dueno_de_visita(uuid)') is null
     or to_regprocedure('privado.puede_usar_visita(uuid)') is null
  then
    raise exception 'Faltan migraciones anteriores (004, 005, 008 u 008b). No se cambió nada.';
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- BLOQUE 1. Normalización de unidad y contenido.
-- capturas_manuales calcula unidad_base y contenido_base con las MISMAS reglas
-- que lecturas_precio y catalogo_propio (004), para poder comparar después:
--   unidad_base    = g (g, kg) · ml (ml, l) · pza
--   contenido_base = cantidad × piezas × (1000 si kg o l)
-- Problema: Postgres pide permiso de ejecutar la función de una columna
-- generada a QUIEN INSERTA la fila, y las funciones de 004 están cerradas para
-- authenticated (Etapa 2). Abrirlas en public las publicaría como /rpc/.
-- Solución: dos envoltorios en el esquema privado (la API no lo publica) que
-- solo llaman a las funciones de 004. "security definer": corren como su
-- dueño, que sí puede ejecutar las de 004. Son cálculos puros: no leen tablas.
-- -----------------------------------------------------------------------------
create or replace function privado.normalizar_unidad_base(p_unidad text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select public.normalizar_unidad_base(p_unidad);
$$;

create or replace function privado.normalizar_contenido_base(
  p_cantidad numeric, p_unidad text, p_piezas int)
returns numeric
language sql
immutable
security definer
set search_path = ''
as $$
  select public.normalizar_contenido_base(p_cantidad, p_unidad, p_piezas);
$$;

comment on function privado.normalizar_unidad_base(text) is
  'Envoltorio de public.normalizar_unidad_base (004) para columnas generadas de capturas_manuales (010). No lee tablas.';
comment on function privado.normalizar_contenido_base(numeric, text, int) is
  'Envoltorio de public.normalizar_contenido_base (004) para columnas generadas de capturas_manuales (010). No lee tablas.';

revoke all on function privado.normalizar_unidad_base(text)                  from public, anon;
revoke all on function privado.normalizar_contenido_base(numeric, text, int) from public, anon;
grant execute on function privado.normalizar_unidad_base(text)                  to authenticated;
grant execute on function privado.normalizar_contenido_base(numeric, text, int) to authenticated;


-- -----------------------------------------------------------------------------
-- BLOQUE 2. Tabla capturas_manuales: una fila por producto escrito a mano.
-- Las listas de valores (unidad, promo_tipo, promo_condicion) son las mismas
-- de lecturas_precio (004), con menos opciones de promoción (las que pidió el
-- usuario). Los números se guardan EXACTOS: si traen más decimales de los
-- permitidos, la base los RECHAZA (no los redondea en silencio).
-- -----------------------------------------------------------------------------
create table if not exists public.capturas_manuales (
  id                  uuid primary key default gen_random_uuid(),
  -- Si se borra la visita (solo desde el panel), se borran sus capturas.
  visita_id           uuid not null references public.visitas (id) on delete cascade,
  -- Quién la escribió. La pone el servidor (auth.uid()); la app NO tiene
  -- permiso de mandarla (BLOQUE 4), así nadie la puede falsear.
  usuario_id          uuid default auth.uid() references auth.users (id) on delete set null,

  -- Qué producto es
  articulo            text not null
                        check (btrim(articulo) <> '' and char_length(articulo) <= 200),
  -- Contenido de UNA pieza, como dice la etiqueta. Hasta 3 decimales.
  cantidad            numeric not null
                        check (cantidad > 0 and cantidad < 10000000 and scale(cantidad) <= 3),
  unidad              text not null check (unidad in ('g', 'kg', 'ml', 'l', 'pza')),
  -- Paquetes: "6 × 355 ml" → cantidad 355, unidad ml, piezas 6.
  piezas              int  not null default 1 check (piezas >= 1 and piezas <= 1000),
  unidad_base         text    generated always as (privado.normalizar_unidad_base(unidad)) stored,
  contenido_base      numeric generated always as
                        (privado.normalizar_contenido_base(cantidad, unidad, piezas)) stored,

  -- Precio regular con impuestos: el total de la presentación completa
  -- (paquete de 6 → precio del paquete), igual que lecturas_precio. Puede ser 0
  -- (la app avisa, pero no lo impide). Hasta 2 decimales.
  precio_regular      numeric not null
                        check (precio_regular >= 0 and precio_regular < 100000000
                               and scale(precio_regular) <= 2),

  -- Recomendados (pueden ir vacíos). *_de_lista = true si el valor salió de
  -- una sugerencia; false si la persona lo escribió.
  marca               text check (marca is null or (btrim(marca) <> '' and char_length(marca) <= 100)),
  area                text check (area  is null or (btrim(area)  <> '' and char_length(area)  <= 100)),
  marca_de_lista      boolean not null default false,
  area_de_lista       boolean not null default false,

  -- Promoción (opcional). Se copian los números del cartel; nada se calcula aquí.
  promo_tipo          text not null default 'ninguna'
                        check (promo_tipo in ('ninguna', 'precio_rebajado', 'n_por_precio', 'nxm', 'otro')),
  promo_piezas        int check (promo_piezas >= 1 and promo_piezas <= 1000),
  promo_precio_total  numeric
                        check (promo_precio_total >= 0 and promo_precio_total < 100000000
                               and scale(promo_precio_total) <= 2),
  -- Solo nxm: "lleva 3 paga 2" → promo_piezas 3, promo_paga_piezas 2
  -- (misma columna que lecturas_precio).
  promo_paga_piezas   int,
  promo_condicion     text not null default 'ninguna'
                        check (promo_condicion in ('ninguna', 'tarjeta', 'app', 'otro')),

  observaciones       text check (observaciones is null
                                  or (btrim(observaciones) <> '' and char_length(observaciones) <= 300)),

  created_at          timestamptz not null default now(),
  -- Hora (del servidor, BLOQUE 3) en que la persona QUITÓ la fila. Nula = vigente.
  -- No se borra nada: corregir = quitar y volver a escribir.
  descartada_at       timestamptz,

  -- Sin promoción → sin datos de promoción.
  constraint capturas_manuales_sin_promo_sin_datos
    check (promo_tipo <> 'ninguna'
           or (promo_piezas is null and promo_precio_total is null
               and promo_paga_piezas is null and promo_condicion = 'ninguna')),
  -- "Antes / ahora": el precio rebajado es obligatorio (por 1 pieza o paquete).
  constraint capturas_manuales_precio_rebajado
    check (promo_tipo <> 'precio_rebajado'
           or (promo_precio_total is not null and promo_piezas = 1 and promo_paga_piezas is null)),
  -- "2 x $30": al menos 2 piezas y el precio total.
  constraint capturas_manuales_n_por_precio
    check (promo_tipo <> 'n_por_precio'
           or (promo_piezas >= 2 and promo_precio_total is not null and promo_paga_piezas is null)),
  -- "Lleva 3 paga 2": paga menos de las que lleva; sin precio total.
  constraint capturas_manuales_nxm
    check (promo_tipo <> 'nxm'
           or (promo_piezas >= 2 and promo_paga_piezas >= 1 and promo_paga_piezas < promo_piezas
               and promo_precio_total is null)),
  -- promo_paga_piezas solo existe en nxm.
  constraint capturas_manuales_paga_solo_nxm
    check (promo_paga_piezas is null or promo_tipo = 'nxm')
);

comment on table public.capturas_manuales is
  'Datos del levantamiento escritos a mano en la app (010). Una fila por producto. '
  'Para comparar contra los agentes y como muestra verificada; los agentes NO la leen.';
comment on column public.capturas_manuales.usuario_id is
  'Quién la escribió. Default auth.uid(); authenticated no tiene permiso de mandarla.';
comment on column public.capturas_manuales.descartada_at is
  'Hora del servidor en que su autor la quitó. Nula = vigente. No se restaura desde la app.';

create index if not exists capturas_manuales_visita_idx  on public.capturas_manuales (visita_id);
create index if not exists capturas_manuales_usuario_idx on public.capturas_manuales (usuario_id);


-- -----------------------------------------------------------------------------
-- BLOQUE 3. Hora del servidor al quitar una fila (igual que fotos en 007).
-- La app manda cualquier hora; el trigger la cambia por now() del servidor.
-- -----------------------------------------------------------------------------
create or replace function public.capturas_manuales_hora_descarte()
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

drop trigger if exists capturas_manuales_hora_descarte on public.capturas_manuales;
create trigger capturas_manuales_hora_descarte
  before insert or update on public.capturas_manuales
  for each row execute function public.capturas_manuales_hora_descarte();

-- Un trigger no necesita permiso de ejecución de quien inserta: se cierra.
revoke all on function public.capturas_manuales_hora_descarte() from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- BLOQUE 4. Permisos. Supabase da a anon y authenticated TODO en cada tabla
-- nueva de public: primero se quita todo y luego se da lo justo.
--   authenticated: leer; crear SOLO con las columnas de la app (sin id,
--   usuario_id, created_at, descartada_at ni las generadas); cambiar SOLO
--   descartada_at. Sin DELETE ni TRUNCATE.
--   anon: nada.
-- -----------------------------------------------------------------------------
alter table public.capturas_manuales enable row level security;

revoke all on table public.capturas_manuales from public, anon, authenticated;

grant select on table public.capturas_manuales to authenticated;
grant insert (visita_id, articulo, cantidad, unidad, piezas, precio_regular,
              marca, area, marca_de_lista, area_de_lista,
              promo_tipo, promo_piezas, promo_precio_total, promo_paga_piezas, promo_condicion,
              observaciones)
  on public.capturas_manuales to authenticated;
grant update (descartada_at) on public.capturas_manuales to authenticated;

-- El proceso de servidor de la Etapa 2 (secret key) podrá leerla más adelante.
grant select, insert, update, delete on table public.capturas_manuales to service_role;


-- -----------------------------------------------------------------------------
-- BLOQUE 5. Reglas RLS de authenticated.
-- Ninguna regla consulta otra tabla con una subconsulta (eso causó el
-- "infinite recursion" de 008): usan las funciones de privado (008b).
-- Sin regla de DELETE (y sin permiso): nadie borra.
-- -----------------------------------------------------------------------------

-- Ver: filas de visitas que puedo usar (mías; el admin, todas).
drop policy if exists "authenticated lee capturas de sus visitas" on public.capturas_manuales;
create policy "authenticated lee capturas de sus visitas"
  on public.capturas_manuales for select to authenticated
  using (privado.puede_usar_visita(visita_id));

-- Crear: a mi nombre y solo en MIS visitas (también el admin).
drop policy if exists "authenticated crea capturas en sus visitas" on public.capturas_manuales;
create policy "authenticated crea capturas en sus visitas"
  on public.capturas_manuales for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and descartada_at is null
    and privado.es_dueno_de_visita(visita_id)
  );

-- Quitar: solo MIS filas vigentes; después de quitar no se puede restaurar
-- (la fila nueva debe quedar con descartada_at). El permiso por columna
-- (BLOQUE 4) impide tocar cualquier otra columna.
drop policy if exists "authenticated descarta sus capturas" on public.capturas_manuales;
create policy "authenticated descarta sus capturas"
  on public.capturas_manuales for update to authenticated
  using (usuario_id = (select auth.uid()) and descartada_at is null)
  with check (usuario_id = (select auth.uid()) and descartada_at is not null);


-- -----------------------------------------------------------------------------
-- BLOQUE 6. sugerencias_captura(): listas para el autocompletado de la app.
-- Devuelve SOLO dos columnas: tipo ('area' o 'marca') y valor (el nombre).
--   - Áreas: los NOMBRES de área de catalogo_propio. Nunca claves, precios,
--     descripciones ni otra columna del catálogo.
--   - Marcas: las ya escritas en capturas_manuales (vigentes), de todas las
--     personas (solo el nombre de la marca, sin quién ni dónde).
-- Si el mismo nombre aparece con otras mayúsculas o acentos, se devuelve una
-- sola vez (la forma más usada).
-- "security definer": corre como su dueño, así lee catalogo_propio sin que
-- authenticated tenga ningún acceso a esa tabla. "search_path = ''": nadie le
-- puede colar otra tabla con el mismo nombre. Sin sesión no devuelve nada.
-- -----------------------------------------------------------------------------
create or replace function public.sugerencias_captura()
returns table (tipo text, valor text)
language sql
stable
security definer
set search_path = ''
as $$
  with juntas as (
    select 'area'::text as tipo, btrim(c.area) as valor
    from public.catalogo_propio c
    where btrim(coalesce(c.area, '')) <> ''
    union all
    select 'marca'::text, btrim(m.marca)
    from public.capturas_manuales m
    where m.descartada_at is null and btrim(coalesce(m.marca, '')) <> ''
  ),
  conteo as (
    select j.tipo, j.valor, public.normalizar_texto(j.valor) as clave, count(*) as veces
    from juntas j
    group by j.tipo, j.valor
  )
  select distinct on (x.tipo, x.clave) x.tipo, x.valor
  from conteo x
  where (select auth.uid()) is not null
  order by x.tipo, x.clave, x.veces desc, x.valor;
$$;

comment on function public.sugerencias_captura() is
  'Sugerencias para la captura manual (010): solo (tipo, valor) de áreas del catálogo y marcas ya capturadas.';

revoke all on function public.sugerencias_captura() from public, anon;
grant execute on function public.sugerencias_captura() to authenticated, service_role;

commit;

-- Que la API de Supabase vea la tabla y la función nuevas sin esperar.
notify pgrst, 'reload schema';


-- -----------------------------------------------------------------------------
-- BLOQUE 7. Comprobación (solo lee; no cambia nada).
-- Todas las filas deben salir con ok = true. Después ejecuta la prueba
-- pruebas/010_prueba_capturas_manuales.sql (fila "0. RESUMEN" con ok = true).
-- -----------------------------------------------------------------------------
select '1. Tabla capturas_manuales con RLS activado' as comprobacion,
       exists (select 1 from pg_class
               where oid = to_regclass('public.capturas_manuales') and relrowsecurity) as ok
union all
select '2. anon: ningún permiso en la tabla ni regla',
       not has_table_privilege('anon', 'public.capturas_manuales', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
       and not has_any_column_privilege('anon', 'public.capturas_manuales', 'SELECT, INSERT, UPDATE')
       and not exists (select 1 from pg_policies
                       where schemaname = 'public' and tablename = 'capturas_manuales'
                         and roles && array['anon', 'public']::name[])
union all
select '3. authenticated: lee y crea; NO manda id, usuario_id, created_at, descartada_at ni generadas',
       has_table_privilege('authenticated', 'public.capturas_manuales', 'SELECT')
       and has_column_privilege('authenticated', 'public.capturas_manuales', 'articulo', 'INSERT')
       and has_column_privilege('authenticated', 'public.capturas_manuales', 'visita_id', 'INSERT')
       and not has_column_privilege('authenticated', 'public.capturas_manuales', 'id', 'INSERT')
       and not has_column_privilege('authenticated', 'public.capturas_manuales', 'usuario_id', 'INSERT')
       and not has_column_privilege('authenticated', 'public.capturas_manuales', 'created_at', 'INSERT')
       and not has_column_privilege('authenticated', 'public.capturas_manuales', 'descartada_at', 'INSERT')
       and not has_column_privilege('authenticated', 'public.capturas_manuales', 'unidad_base', 'INSERT')
       and not has_column_privilege('authenticated', 'public.capturas_manuales', 'contenido_base', 'INSERT')
union all
select '4. authenticated: solo cambia descartada_at; no borra ni vacía',
       has_column_privilege('authenticated', 'public.capturas_manuales', 'descartada_at', 'UPDATE')
       and not exists (select 1 from information_schema.columns c
                       where c.table_schema = 'public' and c.table_name = 'capturas_manuales'
                         and c.column_name <> 'descartada_at'
                         and has_column_privilege('authenticated', 'public.capturas_manuales', c.column_name, 'UPDATE'))
       and not has_table_privilege('authenticated', 'public.capturas_manuales', 'DELETE, TRUNCATE')
union all
select '5. usuario_id: default auth.uid()',
       exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'capturas_manuales'
                 and column_name = 'usuario_id' and column_default like '%auth.uid()%')
union all
select '6. Las 3 reglas de authenticated (leer, crear, descartar) y ninguna de DELETE',
       (select count(*) = 3 from pg_policies
        where schemaname = 'public' and tablename = 'capturas_manuales'
          and roles = array['authenticated']::name[]
          and cmd in ('SELECT', 'INSERT', 'UPDATE'))
       and not exists (select 1 from pg_policies
                       where schemaname = 'public' and tablename = 'capturas_manuales'
                         and cmd in ('DELETE', 'ALL'))
union all
select '7. Las reglas no consultan otras tablas directo (usan privado.*)',
       not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = 'capturas_manuales'
                     and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~* '\mfrom\M')
       and (select count(*) = 2 from pg_policies
            where schemaname = 'public' and tablename = 'capturas_manuales'
              and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) like '%privado.%')
union all
select '8. Restricciones CHECK en la base (al menos 17)',
       (select count(*) >= 17 from pg_constraint
        where conrelid = to_regclass('public.capturas_manuales') and contype = 'c')
union all
select '9. Trigger de hora del servidor al quitar',
       exists (select 1 from pg_trigger
               where tgrelid = to_regclass('public.capturas_manuales')
                 and tgname = 'capturas_manuales_hora_descarte' and not tgisinternal)
       and not has_function_privilege('authenticated', 'public.capturas_manuales_hora_descarte()', 'EXECUTE')
       and not has_function_privilege('anon', 'public.capturas_manuales_hora_descarte()', 'EXECUTE')
union all
select '10. sugerencias_captura: security definer, search_path vacío, devuelve solo (tipo, valor)',
       exists (select 1 from pg_proc p
               where p.oid = to_regprocedure('public.sugerencias_captura()')
                 and p.prosecdef
                 and p.proconfig @> array['search_path=""']
                 and pg_get_function_result(p.oid) = 'TABLE(tipo text, valor text)')
union all
select '11. sugerencias_captura: authenticated SÍ la ejecuta; anon NO',
       has_function_privilege('authenticated', 'public.sugerencias_captura()', 'EXECUTE')
       and not has_function_privilege('anon', 'public.sugerencias_captura()', 'EXECUTE')
union all
select '12. Envoltorios de privado: security definer, inmutables; authenticated sí, anon no',
       (select count(*) = 2 from pg_proc p
        where p.oid in (to_regprocedure('privado.normalizar_unidad_base(text)'),
                        to_regprocedure('privado.normalizar_contenido_base(numeric, text, integer)'))
          and p.prosecdef and p.provolatile = 'i'
          and p.proconfig @> array['search_path=""']
          and has_function_privilege('authenticated', p.oid, 'EXECUTE')
          and not has_function_privilege('anon', p.oid, 'EXECUTE'))
union all
select '13. Etapa 2 sigue cerrada: ninguna otra tabla o vista nueva abierta a anon ni authenticated',
       not exists (
         select 1 from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')
           and c.relname not in ('competidores', 'visitas', 'fotos', 'capturas_manuales')
           and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
           and (has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
                or has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')))
union all
select '14. Funciones de public: anon ninguna; authenticated solo es_admin, admin_* y sugerencias_captura',
       not exists (
         select 1 from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
           and (has_function_privilege('anon', p.oid, 'EXECUTE')
                or (has_function_privilege('authenticated', p.oid, 'EXECUTE')
                    and p.proname not in ('es_admin', 'admin_cambiar_competidor',
                                          'admin_restaurar_foto', 'admin_correos_usuarios',
                                          'sugerencias_captura'))))
union all
select '15. authenticated sigue sin acceso a catalogo_propio',
       not has_table_privilege('authenticated', 'public.catalogo_propio', 'SELECT, INSERT, UPDATE, DELETE')
       and not has_table_privilege('anon', 'public.catalogo_propio', 'SELECT, INSERT, UPDATE, DELETE');
