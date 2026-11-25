-- =============================================================================
-- 011_captura_rapida.sql — Captura rápida de productos (ADITIVA)
-- =============================================================================
-- Cómo usarlo: copia TODO este archivo en Supabase → SQL Editor → Run.
-- Se puede ejecutar más de una vez sin romper nada ("if not exists",
-- "drop … if exists" + "add" y "create or replace", todo en UNA transacción:
-- si algo falla, no se cambia nada y nunca hay un momento sin regla).
--
-- Qué es: la sección "Datos del levantamiento (manual)" pasa a tener SOLO 4
-- campos: artículo (con sugerencias del catálogo propio), precio regular,
-- precio de promoción por pieza (opcional) y observaciones (opcional).
--
-- Es ADITIVA: la app publicada (la de 010, con contenido, unidad, marca, área y
-- tipos de promoción) sigue funcionando igual:
--   - Las columnas de presentación (cantidad, unidad, piezas) se QUEDAN, pero
--     dejan de ser obligatorias. La app vieja las sigue mandando sin problema.
--   - Las columnas nuevas tienen valor por defecto o aceptan vacío.
--   - Las reglas de acceso (RLS) NO cambian. anon sigue sin ningún permiso.
--   - sugerencias_captura() (áreas y marcas de 010) se queda para la app vieja.
--
-- Qué hace:
--   BLOQUE 0. Freno: si falta 010 (o 005), se detiene sin cambiar nada.
--   BLOQUE 1. Presentación opcional: quita el NOT NULL de cantidad, unidad y
--             piezas (piezas conserva su default 1).
--   BLOQUE 2. Columnas nuevas: articulo_de_lista y promo_precio_pieza.
--   BLOQUE 3. Restricciones CHECK en la base.
--   BLOQUE 4. Permiso de crear las 2 columnas nuevas (solo authenticated).
--   BLOQUE 5. Función articulos_captura(): las descripciones del catálogo
--             propio para las sugerencias, en UN solo valor.
--   BLOQUE 6. Comprobación (solo lee).
--
-- ⚠️ Efecto en comprobaciones viejas (es normal, no es un error):
--   - La comprobación final de 010 marca false en la fila "14. Funciones de
--     public: …", porque ahora authenticated SÍ puede ejecutar
--     articulos_captura (a propósito). La fila 13 de este archivo revisa que el
--     resto de la Etapa 2 siga cerrado.
--   - La prueba 010b sigue pasando (46/46), pero describe el formulario
--     ANTERIOR. Después de esta migración usa pruebas/011_prueba_captura_rapida.sql.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- BLOQUE 0. Freno. Esta migración cambia la tabla de 010 y lee la vista de 005.
-- Si falta algo, se detiene SIN cambiar nada y dice qué falta.
-- -----------------------------------------------------------------------------
do $$
declare
  v_faltan text[] := array[]::text[];
begin
  if to_regclass('public.capturas_manuales') is null then
    v_faltan := v_faltan || 'tabla public.capturas_manuales (migración 010)'::text;
  end if;
  if to_regclass('public.catalogo_propio_actual') is null then
    v_faltan := v_faltan || 'vista public.catalogo_propio_actual (migración 005)'::text;
  end if;
  if to_regprocedure('privado.puede_usar_visita(uuid)') is null
     or to_regprocedure('privado.es_dueno_de_visita(uuid)') is null then
    v_faltan := v_faltan || 'funciones privado.* (migración 008b)'::text;
  end if;

  if cardinality(v_faltan) > 0 then
    raise exception using
      message = 'Falta: ' || array_to_string(v_faltan, ', ') || '. No se cambió nada.',
      detail  = format('Base: %s · rol: %s', current_database(), current_user),
      hint    = 'Ejecuta primero supabase/010_capturas_manuales.sql en este mismo proyecto '
                || '(y su prueba 010b); después vuelve a ejecutar este archivo.';
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- BLOQUE 1. La presentación deja de ser obligatoria.
-- El formulario nuevo no pide contenido ni unidad. Las columnas se quedan (la
-- app vieja y las filas ya guardadas las usan), pero aceptan vacío.
--   - cantidad, unidad: sin valor por defecto (vacío = "no se capturó").
--   - piezas: conserva su default 1 (si no se manda, queda 1).
--   - Sus CHECK de 010 siguen: si se manda un valor, debe ser válido
--     (cantidad > 0, unidad de la lista, piezas 1–1000). Un vacío pasa.
--   - unidad_base y contenido_base (generadas) quedan vacías si falta el dato:
--     las funciones de 004 devuelven null con null.
-- "drop not null" en una columna que ya acepta vacío no hace nada (repetible).
-- -----------------------------------------------------------------------------
alter table public.capturas_manuales
  alter column cantidad drop not null,
  alter column unidad   drop not null,
  alter column piezas   drop not null;

alter table public.capturas_manuales
  alter column piezas set default 1;


-- -----------------------------------------------------------------------------
-- BLOQUE 2. Columnas nuevas.
--   articulo_de_lista: true SOLO si el texto guardado es EXACTAMENTE una
--     sugerencia elegida de la lista (si la persona la edita después, false).
--     Igual que marca_de_lista y area_de_lista de 010.
--   promo_precio_pieza: precio de promoción POR PIEZA (opcional). "2 x $42" →
--     21 (y "2x42" en observaciones). No se reutiliza promo_precio_total porque
--     es el TOTAL del grupo y en 010 está atado a promo_tipo (con 'ninguna'
--     debe ir vacío; en 'precio_rebajado' exige promo_piezas = 1): usarla
--     obligaría a inventar un tipo de promoción que la persona no eligió.
-- -----------------------------------------------------------------------------
alter table public.capturas_manuales
  add column if not exists articulo_de_lista  boolean not null default false,
  add column if not exists promo_precio_pieza numeric;

comment on column public.capturas_manuales.articulo_de_lista is
  '011: true solo si el artículo guardado es EXACTAMENTE una sugerencia elegida de articulos_captura().';
comment on column public.capturas_manuales.promo_precio_pieza is
  '011: precio de promoción POR PIEZA (opcional). "2 x $42" → 21; el detalle va en observaciones.';


-- -----------------------------------------------------------------------------
-- BLOQUE 3. Restricciones CHECK (en la base, no solo en la app).
-- Ya existen desde 010 y NO se tocan:
--   - articulo: no vacío y máximo 200 letras  (capturas_manuales_articulo_check)
--   - precio_regular: >= 0, hasta 2 decimales (capturas_manuales_precio_regular_check)
-- Nuevas o cambiadas:
--   a) promo_precio_pieza: vacía, o >= 0 con hasta 2 decimales.
--   b) observaciones: máximo 500 letras (antes 300). Se quita la regla vieja
--      de 300 y se pone la nueva. Sigue sin aceptar un texto de puros espacios
--      (la app manda vacío en ese caso).
--   c) cantidad y unidad van juntas: las dos vacías o las dos con valor (así no
--      queda un "600" sin unidad). Todas las filas de 010 cumplen.
-- Patrón repetible: "drop constraint if exists" + "add constraint".
-- -----------------------------------------------------------------------------

-- a) Precio de promoción por pieza.
alter table public.capturas_manuales
  drop constraint if exists capturas_manuales_promo_precio_pieza_valido;
alter table public.capturas_manuales
  add constraint capturas_manuales_promo_precio_pieza_valido
  check (promo_precio_pieza is null
         or (promo_precio_pieza >= 0 and promo_precio_pieza < 100000000
             and scale(promo_precio_pieza) <= 2));

-- b) Observaciones hasta 500. La regla de 010 se creó junto a la columna, sin
-- nombre propio: se busca por la columna (cualquier CHECK que solo mire
-- observaciones) y se quita, incluida la de una ejecución anterior de este
-- archivo; luego se crea la nueva con nombre.
do $$
declare
  v_nombre text;
begin
  for v_nombre in
    select c.conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid and a.attname = 'observaciones'
    where c.conrelid = 'public.capturas_manuales'::regclass
      and c.contype = 'c'
      and c.conkey = array[a.attnum]
  loop
    execute format('alter table public.capturas_manuales drop constraint %I', v_nombre);
  end loop;
end;
$$;

alter table public.capturas_manuales
  add constraint capturas_manuales_observaciones_largo
  check (observaciones is null
         or (btrim(observaciones) <> '' and char_length(observaciones) <= 500));

-- c) Cantidad y unidad juntas.
alter table public.capturas_manuales
  drop constraint if exists capturas_manuales_cantidad_unidad_juntas;
alter table public.capturas_manuales
  add constraint capturas_manuales_cantidad_unidad_juntas
  check ((cantidad is null) = (unidad is null));


-- -----------------------------------------------------------------------------
-- BLOQUE 4. Permisos de las columnas nuevas.
-- authenticated puede MANDAR las 2 columnas nuevas al crear una fila. Todo lo
-- demás queda igual que en 010: no manda id, usuario_id, created_at,
-- descartada_at ni las generadas; solo cambia descartada_at; no borra.
-- anon: se repite el "revoke all" (no tenía nada; así queda seguro).
-- Las reglas RLS de 010 NO se tocan.
-- -----------------------------------------------------------------------------
grant insert (articulo_de_lista, promo_precio_pieza)
  on public.capturas_manuales to authenticated;

revoke all on table public.capturas_manuales from anon;


-- -----------------------------------------------------------------------------
-- BLOQUE 5. articulos_captura(): lista para las sugerencias de "Artículo".
--
-- Devuelve UN SOLO valor: un arreglo de texto (text[]) con las DESCRIPCIONES de
-- nuestros artículos, sin repetir y en orden alfabético. Nada más: ni claves,
-- ni precios, ni ventas, ni áreas.
--   - Solo artículos ACTIVOS según la vista de 005 (catalogo_propio_actual.
--     activo: último corte, no obsoleto, no de baja, no servicio, precio > 0)
--     y, por si acaso, sin servicios (not es_servicio).
--   - Por qué un solo valor: la API de Supabase corta en unas 1,000 FILAS por
--     respuesta y el catálogo tiene más de 3,000 artículos. Un arreglo es UNA
--     fila, así que llega completo (lo revisa la fila 9 de la comprobación y la
--     prueba 011 con más de 1,000 elementos).
--   - "security definer": corre como su dueño, así lee el catálogo sin que
--     authenticated tenga ningún acceso a catalogo_propio ni a la Etapa 2.
--   - "search_path = ''": nadie le puede colar otra tabla con el mismo nombre.
--   - No es una regla RLS ni la usa una: no hay riesgo de "infinite recursion"
--     (008). No consulta capturas_manuales.
--   - La ejecuta SOLO authenticated (se quita a public, anon y service_role).
-- -----------------------------------------------------------------------------
create or replace function public.articulos_captura()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(x.descripcion order by x.descripcion), array[]::text[])
  from (
    select distinct btrim(a.descripcion) as descripcion
    from public.catalogo_propio_actual a
    where a.activo
      and not a.es_servicio
      and btrim(coalesce(a.descripcion, '')) <> ''
  ) x;
$$;

comment on function public.articulos_captura() is
  '011: descripciones de los artículos propios activos (sin servicios), distintas y ordenadas, en UN arreglo. '
  'Solo la descripción: nunca claves, precios ni ventas. Para las sugerencias de la captura rápida.';

revoke all on function public.articulos_captura() from public, anon, service_role;
grant execute on function public.articulos_captura() to authenticated;

commit;

-- Que la API de Supabase vea las columnas y la función nuevas sin esperar.
notify pgrst, 'reload schema';


-- -----------------------------------------------------------------------------
-- BLOQUE 6. Comprobación (solo lee; no cambia nada; NO muestra descripciones).
-- Todas las filas deben salir con ok = true. Después ejecuta la prueba
-- pruebas/011_prueba_captura_rapida.sql (fila "0. RESUMEN" con ok = true).
-- -----------------------------------------------------------------------------
select '1. Columna articulo_de_lista: boolean, no nula, default false' as comprobacion,
       exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'capturas_manuales'
                 and column_name = 'articulo_de_lista' and data_type = 'boolean'
                 and is_nullable = 'NO' and column_default = 'false') as ok
union all
select '2. Columna promo_precio_pieza: numeric, acepta vacío',
       exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'capturas_manuales'
                 and column_name = 'promo_precio_pieza' and data_type = 'numeric'
                 and is_nullable = 'YES')
union all
select '3. cantidad, unidad y piezas aceptan vacío; piezas con default 1; articulo y precio_regular siguen obligatorios',
       (select count(*) = 3 from information_schema.columns
        where table_schema = 'public' and table_name = 'capturas_manuales'
          and column_name in ('cantidad', 'unidad', 'piezas') and is_nullable = 'YES')
       and exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'capturas_manuales'
                     and column_name = 'piezas' and column_default = '1')
       and (select count(*) = 2 from information_schema.columns
            where table_schema = 'public' and table_name = 'capturas_manuales'
              and column_name in ('articulo', 'precio_regular') and is_nullable = 'NO')
union all
select '4. CHECK: artículo no vacío y máx. 200; precio_regular >= 0',
       exists (select 1 from pg_constraint
               where conrelid = 'public.capturas_manuales'::regclass and contype = 'c'
                 and pg_get_constraintdef(oid) like '%btrim(articulo)%'
                 and pg_get_constraintdef(oid) like '%char_length(articulo) <= 200%')
       and exists (select 1 from pg_constraint
                   where conrelid = 'public.capturas_manuales'::regclass and contype = 'c'
                     and pg_get_constraintdef(oid) like '%precio_regular >= (0)%')
union all
select '5. CHECK: promo_precio_pieza vacía o >= 0 (hasta 2 decimales)',
       exists (select 1 from pg_constraint
               where conrelid = 'public.capturas_manuales'::regclass
                 and conname = 'capturas_manuales_promo_precio_pieza_valido' and contype = 'c')
union all
select '6. CHECK: observaciones máx. 500 (ya no queda la regla de 300)',
       exists (select 1 from pg_constraint
               where conrelid = 'public.capturas_manuales'::regclass
                 and conname = 'capturas_manuales_observaciones_largo'
                 and pg_get_constraintdef(oid) like '%<= 500%')
       and not exists (select 1 from pg_constraint
                       where conrelid = 'public.capturas_manuales'::regclass and contype = 'c'
                         and pg_get_constraintdef(oid) like '%observaciones%<= 300%')
union all
select '7. authenticated manda articulo_de_lista y promo_precio_pieza; sigue SIN mandar id, usuario_id, created_at ni descartada_at',
       has_column_privilege('authenticated', 'public.capturas_manuales', 'articulo_de_lista', 'INSERT')
       and has_column_privilege('authenticated', 'public.capturas_manuales', 'promo_precio_pieza', 'INSERT')
       and not has_column_privilege('authenticated', 'public.capturas_manuales', 'id', 'INSERT')
       and not has_column_privilege('authenticated', 'public.capturas_manuales', 'usuario_id', 'INSERT')
       and not has_column_privilege('authenticated', 'public.capturas_manuales', 'created_at', 'INSERT')
       and not has_column_privilege('authenticated', 'public.capturas_manuales', 'descartada_at', 'INSERT')
       and not has_column_privilege('authenticated', 'public.capturas_manuales', 'articulo_de_lista', 'UPDATE')
       and not has_column_privilege('authenticated', 'public.capturas_manuales', 'promo_precio_pieza', 'UPDATE')
       and not has_table_privilege('authenticated', 'public.capturas_manuales', 'DELETE, TRUNCATE')
union all
select '8. Reglas RLS sin cambios: las 3 de 010 (leer, crear, descartar), ninguna de DELETE, ninguna para anon',
       (select count(*) = 3 from pg_policies
        where schemaname = 'public' and tablename = 'capturas_manuales'
          and roles = array['authenticated']::name[]
          and policyname in ('authenticated lee capturas de sus visitas',
                             'authenticated crea capturas en sus visitas',
                             'authenticated descarta sus capturas'))
       and (select count(*) = 3 from pg_policies
            where schemaname = 'public' and tablename = 'capturas_manuales')
       and not exists (select 1 from pg_policies
                       where schemaname = 'public' and tablename = 'capturas_manuales'
                         and (cmd in ('DELETE', 'ALL') or (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~* '\mfrom\M'))
union all
select '9. articulos_captura: UN solo valor (text[], no conjunto de filas) con TODOS los artículos activos: '
       || cardinality(public.articulos_captura()) || ' elementos',
       exists (select 1 from pg_proc p
               where p.oid = to_regprocedure('public.articulos_captura()')
                 and not p.proretset
                 and p.prorettype = 'text[]'::regtype)
       and cardinality(public.articulos_captura())
           = (select count(distinct btrim(a.descripcion)) from public.catalogo_propio_actual a
              where a.activo and not a.es_servicio and btrim(coalesce(a.descripcion, '')) <> '')
union all
select '10. articulos_captura: security definer y search_path vacío',
       exists (select 1 from pg_proc p
               where p.oid = to_regprocedure('public.articulos_captura()')
                 and p.prosecdef and p.proconfig @> array['search_path=""'])
union all
select '11. articulos_captura: SOLO authenticated la ejecuta (anon y public no)',
       has_function_privilege('authenticated', 'public.articulos_captura()', 'EXECUTE')
       and not has_function_privilege('anon', 'public.articulos_captura()', 'EXECUTE')
       and not exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
                       where p.oid = to_regprocedure('public.articulos_captura()')
                         and x.grantee = 0 and x.privilege_type = 'EXECUTE')
union all
select '12. anon: ningún permiso en capturas_manuales',
       not has_table_privilege('anon', 'public.capturas_manuales', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
       and not has_any_column_privilege('anon', 'public.capturas_manuales', 'SELECT, INSERT, UPDATE')
union all
select '13. Etapa 2 sigue cerrada: authenticated sin acceso a catalogo_propio ni a su vista; funciones de public solo las de la app',
       not has_table_privilege('authenticated', 'public.catalogo_propio', 'SELECT, INSERT, UPDATE, DELETE')
       and not has_table_privilege('authenticated', 'public.catalogo_propio_actual', 'SELECT, INSERT, UPDATE, DELETE')
       and not has_table_privilege('anon', 'public.catalogo_propio', 'SELECT, INSERT, UPDATE, DELETE')
       and not exists (
         select 1 from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
           and (has_function_privilege('anon', p.oid, 'EXECUTE')
                or (has_function_privilege('authenticated', p.oid, 'EXECUTE')
                    and p.proname not in ('es_admin', 'admin_cambiar_competidor',
                                          'admin_restaurar_foto', 'admin_correos_usuarios',
                                          'sugerencias_captura', 'articulos_captura'))));
