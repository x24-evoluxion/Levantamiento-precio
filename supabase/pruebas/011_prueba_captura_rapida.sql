-- =============================================================================
-- pruebas/011_prueba_captura_rapida.sql — Prueba de la captura rápida (011)
-- =============================================================================
-- NO es una migración: es una PRUEBA que NO deja nada en la base.
-- Ejecútala DESPUÉS de 011_captura_rapida.sql, en el MISMO proyecto.
--
-- Cómo usarla: copia TODO este archivo en Supabase → SQL Editor → Run.
--   - Todo va dentro de una transacción (begin … rollback): usuarios, tienda,
--     visitas, artículos del catálogo y capturas de prueba se crean, se prueban
--     y al final se DESHACE todo. Siempre termina con rollback.
--   - SIMULAR A UNA PERSONA: "set local role authenticated" + su JWT en
--     request.jwt.claims (lo mismo que hace Supabase con cada consulta de la
--     app). "set local role anon" simula a alguien sin sesión.
--   - Cada caso atrapa su propio error: la prueba no se corta a la mitad. Al
--     final sale una tabla con TODOS los casos y una fila "0. RESUMEN".
--     Busca ok = true en todas las filas.
--   - NUNCA muestra descripciones reales del catálogo: de la función solo se
--     muestran CONTEOS y sí/no.
--
-- Simula el FLUJO REAL DE LA APP NUEVA:
--   - "Guardar datos": UN insert con varias filas … returning, con SOLO las
--     columnas del formulario (visita_id, articulo, articulo_de_lista,
--     precio_regular, promo_precio_pieza, observaciones).
--   - Sugerencias: select public.articulos_captura().
--   - "Quitar": update de descartada_at … returning id.
--
-- Datos (TODOS inventados):
--   Personas: C1 = campo 1, C2 = campo 2, AD = admin (rol en app_metadata).
--   Visitas:  V1 de C1 · V2 de C2 · VA del admin.
--   Catálogo: 1,200 artículos activos "PRUEBA011 ART 0001…1200" (para pasar de
--             1,000), uno repetido con otra clave (debe salir una vez), uno de
--             servicio, uno obsoleto y uno sin precio (no deben salir).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Freno: ¿está 011 en ESTA base? (solo lee; no crea nada)
-- -----------------------------------------------------------------------------
do $$
declare
  v_faltan text[] := array[]::text[];
begin
  if to_regclass('public.capturas_manuales') is null then
    v_faltan := v_faltan || 'tabla public.capturas_manuales (010)'::text;
  else
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'capturas_manuales'
                     and column_name = 'articulo_de_lista') then
      v_faltan := v_faltan || 'columna articulo_de_lista (011)'::text;
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'capturas_manuales'
                     and column_name = 'promo_precio_pieza') then
      v_faltan := v_faltan || 'columna promo_precio_pieza (011)'::text;
    end if;
  end if;
  if to_regprocedure('public.articulos_captura()') is null then
    v_faltan := v_faltan || 'función public.articulos_captura() (011)'::text;
  end if;

  if cardinality(v_faltan) > 0 then
    raise exception using
      message = 'Falta en ESTA base: ' || array_to_string(v_faltan, ', ') || '. No se probó nada.',
      detail  = format('Base: %s · rol actual: %s · usuario de la conexión: %s',
                       current_database(), current_user, session_user),
      hint    = 'Ejecuta supabase/011_captura_rapida.sql en este mismo proyecto y revisa que '
                || 'sus 13 filas salgan ok = true; después vuelve a correr esta prueba.';
  end if;
end;
$$;

create temp table prueba_resultado (
  n int, caso text, esperado text, obtenido text, ok boolean
) on commit drop;

-- error_texto(): convierte un error en un texto corto y comparable.
create function pg_temp.error_texto(p_estado text, p_mensaje text) returns text language sql as $$
  select case
    when p_mensaje like 'new row violates row-level security policy%'
      then 'rechazado (regla RLS)'
    when p_estado = '42501' then 'rechazado (sin permiso)'
    when p_estado = '23514' then 'rechazado (CHECK)'
    when p_estado = '23502' then 'rechazado (falta dato)'
    when p_estado = '22P02' then 'rechazado (valor inválido)'
    else 'otro error: ' || p_mensaje
  end;
$$;

-- anotar(): guarda un caso; ok = (lo obtenido es igual a lo esperado).
create function pg_temp.anotar(p_n int, p_caso text, p_esperado text, p_obtenido text)
returns void language sql as $$
  insert into pg_temp.prueba_resultado
  values (p_n, p_caso, p_esperado, coalesce(p_obtenido, '(vacío)'), p_obtenido = p_esperado);
$$;


-- -----------------------------------------------------------------------------
-- 1. Datos inventados (los crea el SQL Editor, que puede todo).
-- -----------------------------------------------------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000011001',
   'authenticated', 'authenticated', 'prueba011-campo1@ejemplo.invalid', '', now(),
   '{"provider": "email", "providers": ["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000011002',
   'authenticated', 'authenticated', 'prueba011-campo2@ejemplo.invalid', '', now(),
   '{"provider": "email", "providers": ["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000011003',
   'authenticated', 'authenticated', 'prueba011-admin@ejemplo.invalid', '', now(),
   '{"provider": "email", "providers": ["email"], "rol": "admin"}', '{}', now(), now());

insert into public.competidores (nombre, activo, orden) values
  ('PRUEBA 011 activa (se deshace)', true, 995);

insert into public.visitas (id, competidor_id, latitud, longitud, usuario_id)
select v.id::uuid, c.id, 19.0, -99.0, v.usuario::uuid
from (values
        ('00000000-0000-4000-8000-000000011011', '00000000-0000-4000-8000-000000011001'),
        ('00000000-0000-4000-8000-000000011012', '00000000-0000-4000-8000-000000011002'),
        ('00000000-0000-4000-8000-000000011013', '00000000-0000-4000-8000-000000011003')
     ) as v(id, usuario)
cross join public.competidores c
where c.nombre = 'PRUEBA 011 activa (se deshace)';

-- Catálogo inventado. Se usa la fecha del corte más reciente que ya exista (o
-- hoy, si no hay ninguno): así los artículos reales siguen activos y los de
-- prueba también. Claves "PRUEBA011-…" y precios inventados (para comprobar
-- que la función NO los devuelve).
create temp table prueba_corte on commit drop as
select coalesce((select max(fecha_corte) from public.catalogo_propio_cortes), current_date) as fecha;

insert into public.catalogo_propio
  (clave, descripcion, area, contenido_origen, es_servicio, obsoleto, de_baja, fecha_corte_ultimo)
select 'PRUEBA011-' || lpad(g::text, 4, '0'),
       'PRUEBA011 ART ' || lpad(g::text, 4, '0'),
       'PRUEBA 011 ÁREA', 'sin_dato', false, false, false, (select fecha from prueba_corte)
from generate_series(1, 1200) as g
union all
-- La misma descripción que el 0001, con otra clave: debe salir UNA vez.
select 'PRUEBA011-REPETIDO', 'PRUEBA011 ART 0001', 'PRUEBA 011 ÁREA', 'sin_dato',
       false, false, false, (select fecha from prueba_corte)
union all
select 'PRUEBA011-SERVICIO', 'PRUEBA011 NO SERVICIO', 'PRUEBA 011 ÁREA', 'sin_dato',
       true, false, false, (select fecha from prueba_corte)
union all
select 'PRUEBA011-OBSOLETO', 'PRUEBA011 NO OBSOLETO', 'PRUEBA 011 ÁREA', 'sin_dato',
       false, true, false, (select fecha from prueba_corte)
union all
select 'PRUEBA011-SINPRECIO', 'PRUEBA011 NO SIN PRECIO', 'PRUEBA 011 ÁREA', 'sin_dato',
       false, false, false, (select fecha from prueba_corte);

insert into public.catalogo_propio_cortes (fecha_corte, clave, precio_regular)
select (select fecha from prueba_corte), clave,
       case when clave = 'PRUEBA011-SINPRECIO' then 0 else 98765.43 end
from public.catalogo_propio
where clave like 'PRUEBA011-%';


-- -----------------------------------------------------------------------------
-- 2. Casos. "Como C1" = set_config(JWT de C1) + set local role authenticated.
-- Si el bloque falla, Postgres deshace ese bloque (incluido el cambio de rol) y
-- se anota el error; si no falla, "reset role" vuelve al SQL Editor.
-- -----------------------------------------------------------------------------
do $$
declare
  jwt_c1 constant text := '{"sub": "00000000-0000-4000-8000-000000011001", "role": "authenticated",
    "app_metadata": {"provider": "email", "providers": ["email"]}, "user_metadata": {}}';
  jwt_c2 constant text := '{"sub": "00000000-0000-4000-8000-000000011002", "role": "authenticated",
    "app_metadata": {"provider": "email", "providers": ["email"]}, "user_metadata": {}}';
  jwt_ad constant text := '{"sub": "00000000-0000-4000-8000-000000011003", "role": "authenticated",
    "app_metadata": {"provider": "email", "providers": ["email"], "rol": "admin"}, "user_metadata": {}}';
  jwt_anon constant text := '{"role": "anon"}';

  c1 constant uuid := '00000000-0000-4000-8000-000000011001';
  c2 constant uuid := '00000000-0000-4000-8000-000000011002';
  v1 constant uuid := '00000000-0000-4000-8000-000000011011';
  v2 constant uuid := '00000000-0000-4000-8000-000000011012';
  va constant uuid := '00000000-0000-4000-8000-000000011013';
  visitas_prueba constant uuid[] := array[
    '00000000-0000-4000-8000-000000011011', '00000000-0000-4000-8000-000000011012',
    '00000000-0000-4000-8000-000000011013']::uuid[];

  v_obt  text;
  v_n    int;
  v_ids  uuid[];
  v_duenos uuid[];
  v_lista text[];
  v_fila_c1 uuid;
  v_rol_editor constant text := current_user;
begin
  -- ===== CREAR CON EL FORMULARIO NUEVO ======================================
  -- 1. Solo artículo y precio regular: entra; la presentación queda vacía,
  -- piezas = 1 (default), articulo_de_lista = false, promoción vacía.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into public.capturas_manuales (visita_id, articulo, precio_regular)
    values (v1, 'Refresco prueba 600 ml', 18.50)
    returning format('creada; cantidad %s, unidad %s, piezas %s, de_lista %s, promo %s, contenido_base %s',
                     coalesce(cantidad::text, 'vacía'), coalesce(unidad, 'vacía'), piezas,
                     articulo_de_lista::text, coalesce(promo_precio_pieza::text, 'vacía'),
                     coalesce(contenido_base::text, 'vacío'))
      into v_obt;
    reset role;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(1, 'Solo artículo y precio regular: entra (presentación y promoción vacías)',
    'creada; cantidad vacía, unidad vacía, piezas 1, de_lista false, promo vacía, contenido_base vacío', v_obt);

  -- 2. "Guardar datos" como la app nueva: UN insert con varias filas y solo las
  -- columnas del formulario. El dueño lo pone el servidor.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    with nuevas as (
      insert into public.capturas_manuales
        (visita_id, articulo, articulo_de_lista, precio_regular, promo_precio_pieza, observaciones)
      values
        (v1, 'PRUEBA011 ART 0002', true,  25.00, 21.00, '2x42'),
        (v1, 'Galletas prueba',    false, 30.50, null,  null)
      returning id, usuario_id
    )
    select array_agg(id), array_agg(distinct usuario_id) into v_ids, v_duenos from nuevas;
    reset role;
    v_fila_c1 := v_ids[1];
    v_obt := format('creadas %s, dueño %s', coalesce(cardinality(v_ids), 0),
                    case when v_duenos = array[c1] then 'C1' else coalesce(v_duenos::text, 'ninguno') end);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(2, 'Guardar 2 filas con el formulario nuevo (insert … returning); dueño por el servidor',
                         'creadas 2, dueño C1', v_obt);

  -- 3. Después de "reset role" se vuelve al rol del SQL Editor.
  v_obt := case when current_user = v_rol_editor then 'mismo rol'
                else format('otro rol: %s (antes %s)', current_user, v_rol_editor) end;
  perform pg_temp.anotar(3, 'Después de "reset role" se vuelve al rol del SQL Editor', 'mismo rol', v_obt);

  -- 4. articulo_de_lista y la promoción por pieza se guardan como se mandaron.
  begin
    select format('de_lista %s, promo %s', articulo_de_lista::text, trim_scale(promo_precio_pieza)) into v_obt
    from public.capturas_manuales where id = v_fila_c1;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(4, 'articulo_de_lista y promo_precio_pieza se guardan tal cual', 'de_lista true, promo 21', v_obt);

  -- 5. cantidad y unidad vacías mandadas a propósito: se aceptan.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into public.capturas_manuales (visita_id, articulo, cantidad, unidad, precio_regular)
    values (v1, 'Sin presentación', null, null, 10);
    reset role;
    v_obt := 'aceptada';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(5, 'cantidad y unidad vacías (null) se aceptan', 'aceptada', v_obt);

  -- 6. La app vieja (010) sigue pudiendo guardar con presentación completa.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into public.capturas_manuales (visita_id, articulo, cantidad, unidad, piezas, precio_regular)
    values (v1, 'Formato viejo', 1.5, 'kg', 2, 99.90)
    returning format('aceptada; %s %s', unidad_base, trim_scale(contenido_base)) into v_obt;
    reset role;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(6, 'App publicada (formato 010): sigue guardando con presentación', 'aceptada; g 3000', v_obt);

  -- 7. Promoción en 0 se acepta (>= 0).
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into public.capturas_manuales (visita_id, articulo, precio_regular, promo_precio_pieza)
    values (v1, 'Regalo prueba', 10, 0);
    reset role;
    v_obt := 'aceptada';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(7, 'Promoción por pieza en 0 se acepta', 'aceptada', v_obt);

  -- 8. Artículo de 200 letras y observaciones de 500: se aceptan (justo el límite).
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into public.capturas_manuales (visita_id, articulo, precio_regular, observaciones)
    values (v1, repeat('a', 200), 10, repeat('o', 500));
    reset role;
    v_obt := 'aceptada';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(8, 'Artículo de 200 letras y observaciones de 500 se aceptan', 'aceptada', v_obt);

  -- ===== LA BASE RECHAZA VALORES INVÁLIDOS ===================================
  declare
    casos constant text[][] := array[
      array['9',  'artículo vacío',                     $q$(v, '', 10, null, null, null, null)$q$,     'rechazado (CHECK)'],
      array['10', 'artículo de puros espacios',         $q$(v, '   ', 10, null, null, null, null)$q$,  'rechazado (CHECK)'],
      array['11', 'artículo de 201 letras',             $q$(v, repeat('a', 201), 10, null, null, null, null)$q$, 'rechazado (CHECK)'],
      array['12', 'precio regular negativo',            $q$(v, 'X', -1, null, null, null, null)$q$,    'rechazado (CHECK)'],
      array['13', 'precio regular con 3 decimales',     $q$(v, 'X', 10.555, null, null, null, null)$q$, 'rechazado (CHECK)'],
      array['14', 'precio regular vacío',               $q$(v, 'X', null, null, null, null, null)$q$,  'rechazado (falta dato)'],
      array['15', 'promoción negativa',                 $q$(v, 'X', 10, -0.01, null, null, null)$q$,   'rechazado (CHECK)'],
      array['16', 'promoción con 3 decimales',          $q$(v, 'X', 10, 8.999, null, null, null)$q$,   'rechazado (CHECK)'],
      array['17', 'observaciones de 501 letras',        $q$(v, 'X', 10, null, repeat('o', 501), null, null)$q$, 'rechazado (CHECK)'],
      array['18', 'contenido sin unidad',               $q$(v, 'X', 10, null, null, 600, null)$q$,     'rechazado (CHECK)'],
      array['19', 'unidad sin contenido',               $q$(v, 'X', 10, null, null, null, 'ml')$q$,    'rechazado (CHECK)']
    ];
    i int;
  begin
    for i in 1 .. array_length(casos, 1) loop
      begin
        perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
        execute format(
          'insert into public.capturas_manuales
             (visita_id, articulo, precio_regular, promo_precio_pieza, observaciones, cantidad, unidad)
           values %s',
          replace(casos[i][3], '(v,', format('(%L::uuid,', v1)));
        reset role;
        v_obt := 'aceptado';
      exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
      end;
      perform pg_temp.anotar(casos[i][1]::int, 'La base rechaza: ' || casos[i][2], casos[i][4], v_obt);
    end loop;
  end;

  -- 20. "Guardar datos" sigue siendo todo o nada.
  begin
    select count(*) into v_n from public.capturas_manuales where visita_id = v1;
    begin
      perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
      insert into public.capturas_manuales (visita_id, articulo, precio_regular)
      values (v1, 'Buena 1', 10), (v1, 'Buena 2', 11), (v1, '', 12);
      reset role;
    exception when others then null;
    end;
    select case when count(*) = v_n then 'no se guardó ninguna'
                else format('antes %s, después %s', v_n, count(*)) end
      into v_obt
    from public.capturas_manuales where visita_id = v1;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(20, 'Guardar varias filas es todo o nada (una mala → ninguna)', 'no se guardó ninguna', v_obt);

  -- ===== NO FALSEAR NI MODIFICAR =============================================
  -- 21. C1 no puede mandar usuario_id (ni el de otra persona).
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into public.capturas_manuales (visita_id, usuario_id, articulo, precio_regular)
    values (v1, c2, 'Falsa', 10);
    reset role;
    v_obt := 'creada';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(21, 'C1 NO puede mandar usuario_id (no se falsea el autor)', 'rechazado (sin permiso)', v_obt);

  -- 22. C1 no puede cambiar articulo_de_lista ni la promoción de una fila guardada.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    update public.capturas_manuales set articulo_de_lista = false, promo_precio_pieza = 1 where id = v_fila_c1;
    reset role;
    v_obt := 'cambiada';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(22, 'C1 NO cambia articulo_de_lista ni la promoción (solo puede quitar)', 'rechazado (sin permiso)', v_obt);

  -- 23. C1 quita su fila nueva (como la app): sigue funcionando.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    with cambiadas as (
      update public.capturas_manuales set descartada_at = now() where id = v_fila_c1 returning id
    ) select count(*) into v_n from cambiadas;
    reset role;
    v_obt := format('%s fila', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(23, 'C1 quita su fila (descartada_at) como antes', '1 fila', v_obt);

  -- ===== AISLAMIENTO ENTRE PERSONAS (igual que 010) ==========================
  -- 24. C2 guarda en SU visita.
  begin
    perform set_config('request.jwt.claims', jwt_c2, true); set local role authenticated;
    insert into public.capturas_manuales (visita_id, articulo, precio_regular) values (v2, 'Leche prueba', 22);
    reset role;
    v_obt := 'creada';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(24, 'C2 guarda en su visita', 'creada', v_obt);

  -- 25. C2 NO ve las filas de la visita de C1.
  begin
    perform set_config('request.jwt.claims', jwt_c2, true); set local role authenticated;
    select count(*) into v_n from public.capturas_manuales where visita_id = v1;
    reset role;
    v_obt := format('ve %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(25, 'C2 NO ve las filas de la visita de C1', 've 0', v_obt);

  -- 26. C1 ve solo lo suyo (no la fila de C2).
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    select count(*) into v_n from public.capturas_manuales where visita_id = v2;
    reset role;
    v_obt := format('ve %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(26, 'C1 NO ve las filas de la visita de C2', 've 0', v_obt);

  -- 27. C2 NO crea en la visita de C1.
  begin
    perform set_config('request.jwt.claims', jwt_c2, true); set local role authenticated;
    insert into public.capturas_manuales (visita_id, articulo, precio_regular) values (v1, 'Intruso', 10);
    reset role;
    v_obt := 'creada';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(27, 'C2 NO crea filas en la visita de C1', 'rechazado (regla RLS)', v_obt);

  -- 28. C2 NO quita filas de C1.
  begin
    perform set_config('request.jwt.claims', jwt_c2, true); set local role authenticated;
    with cambiadas as (
      update public.capturas_manuales set descartada_at = now()
      where visita_id = v1 and descartada_at is null returning id
    ) select count(*) into v_n from cambiadas;
    reset role;
    v_obt := format('%s filas', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(28, 'C2 NO quita filas de C1', '0 filas', v_obt);

  -- 29. El admin ve las filas de todas las visitas de prueba.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    select count(distinct visita_id) into v_n from public.capturas_manuales where visita_id = any (visitas_prueba);
    reset role;
    v_obt := format('ve filas de %s visitas', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(29, 'El admin ve filas de las visitas de C1 y C2', 've filas de 2 visitas', v_obt);

  -- 30. El admin NO crea en la visita de C1 (solo en las suyas).
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    insert into public.capturas_manuales (visita_id, articulo, precio_regular) values (v1, 'Admin en ajena', 10);
    reset role;
    v_obt := 'creada';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(30, 'El admin NO crea filas en la visita de C1', 'rechazado (regla RLS)', v_obt);

  -- 31. El admin crea en SU visita.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    insert into public.capturas_manuales (visita_id, articulo, precio_regular) values (va, 'Agua prueba', 12);
    reset role;
    v_obt := 'creada';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(31, 'El admin crea filas en su propia visita', 'creada', v_obt);

  -- ===== ANON (sin sesión) ===================================================
  -- 32. anon no lee la tabla.
  begin
    perform set_config('request.jwt.claims', jwt_anon, true); set local role anon;
    select count(*) into v_n from public.capturas_manuales;
    reset role;
    v_obt := format('ve %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(32, 'anon NO lee capturas_manuales', 'rechazado (sin permiso)', v_obt);

  -- 33. anon no crea (tampoco con las columnas nuevas).
  begin
    perform set_config('request.jwt.claims', jwt_anon, true); set local role anon;
    insert into public.capturas_manuales (visita_id, articulo, articulo_de_lista, precio_regular, promo_precio_pieza)
    values (v1, 'Anon', true, 10, 5);
    reset role;
    v_obt := 'creada';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(33, 'anon NO crea filas', 'rechazado (sin permiso)', v_obt);

  -- 34. anon NO ejecuta articulos_captura.
  begin
    perform set_config('request.jwt.claims', jwt_anon, true); set local role anon;
    select cardinality(public.articulos_captura()) into v_n;
    reset role;
    v_obt := format('devolvió %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(34, 'anon NO ejecuta articulos_captura', 'rechazado (sin permiso)', v_obt);

  -- ===== SUGERENCIAS: articulos_captura() ====================================
  -- 35. authenticated la ejecuta y recibe UN solo valor (una fila), tipo text[].
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    select count(*), min(pg_typeof(r)::text) into v_n, v_obt
    from (select public.articulos_captura() as r) x;
    reset role;
    v_obt := format('%s fila, tipo %s', v_n, v_obt);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(35, 'authenticated la ejecuta: UN solo valor de tipo text[]', '1 fila, tipo text[]', v_obt);

  -- 36. Con 1,200 artículos de prueba: más de 1,000 elementos y TODOS los de
  -- prueba (nada truncado). Solo se muestran conteos.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    v_lista := public.articulos_captura();
    reset role;
    select format('más de 1000: %s; de prueba: %s',
                  case when cardinality(v_lista) > 1000 then 'sí' else 'no (' || cardinality(v_lista) || ')' end,
                  count(*) filter (where e like 'PRUEBA011 ART %'))
      into v_obt
    from unnest(v_lista) as e;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(36, 'Devuelve más de 1,000 elementos sin truncar (1,200 de prueba)',
                         'más de 1000: sí; de prueba: 1200', v_obt);

  -- 37. Total = artículos activos distintos de la vista (reales + prueba).
  begin
    select case when cardinality(v_lista)
                     = (select count(distinct btrim(a.descripcion)) from public.catalogo_propio_actual a
                        where a.activo and not a.es_servicio and btrim(coalesce(a.descripcion, '')) <> '')
                then 'igual al catálogo activo'
                else 'distinto' end
      into v_obt;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(37, 'El total coincide con los artículos activos del catálogo (conteo)',
                         'igual al catálogo activo', v_obt);

  -- 38. Sin repetidos y en orden.
  begin
    select format('repetidos %s; ordenada %s',
                  cardinality(v_lista) - (select count(distinct e) from unnest(v_lista) e),
                  case when v_lista = (select array_agg(e order by e) from unnest(v_lista) e)
                       then 'sí' else 'no' end)
      into v_obt;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(38, 'Descripciones distintas y ordenadas (la repetida sale una vez)', 'repetidos 0; ordenada sí', v_obt);

  -- 39. Solo artículos activos: ni servicio, ni obsoleto, ni sin precio.
  begin
    select format('excluidos que salen: %s', count(*) filter (where e like 'PRUEBA011 NO %'))
      into v_obt
    from unnest(v_lista) as e;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(39, 'No salen servicios, obsoletos ni artículos sin precio', 'excluidos que salen: 0', v_obt);

  -- 40. Solo la descripción: ni claves, ni precios, ni áreas.
  begin
    select format('claves %s; precios %s; áreas %s',
                  count(*) filter (where e like '%PRUEBA011-%'),
                  count(*) filter (where e like '%98765%'),
                  count(*) filter (where e like '%PRUEBA 011 ÁREA%'))
      into v_obt
    from unnest(v_lista) as e;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(40, 'Nunca devuelve claves, precios ni áreas (solo descripciones)', 'claves 0; precios 0; áreas 0', v_obt);

  -- 41. La app sigue SIN acceso a catalogo_propio ni a su vista.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    select count(*) into v_n from public.catalogo_propio_actual;
    reset role;
    v_obt := format('ve %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(41, 'C1 NO lee catalogo_propio_actual directo', 'rechazado (sin permiso)', v_obt);

  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    select count(*) into v_n from public.catalogo_propio;
    reset role;
    v_obt := format('ve %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(42, 'El admin NO lee catalogo_propio directo', 'rechazado (sin permiso)', v_obt);
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. Reglas sin cambios (solo lee).
-- -----------------------------------------------------------------------------
insert into prueba_resultado
select 43, 'Reglas RLS de capturas_manuales sin cambios (las 3 de 010)',
       '3 reglas de 010',
       format('%s reglas de 010', count(*) filter (where policyname in (
                'authenticated lee capturas de sus visitas',
                'authenticated crea capturas en sus visitas',
                'authenticated descarta sus capturas')))
       || case when count(*) <> 3 then format(' (%s en total)', count(*)) else '' end,
       count(*) = 3 and count(*) filter (where policyname in (
                'authenticated lee capturas de sus visitas',
                'authenticated crea capturas en sus visitas',
                'authenticated descarta sus capturas')) = 3
from pg_policies
where schemaname = 'public' and tablename = 'capturas_manuales';

-- -----------------------------------------------------------------------------
-- 4. Resultado visible (todas las filas deben tener ok = true).
-- -----------------------------------------------------------------------------
-- 44. Guardia: ningún caso terminó en "infinite recursion".
insert into prueba_resultado
select 44, 'Ningún caso dio "infinite recursion"',
       'ninguno',
       coalesce(nullif(string_agg(n::text, ', ' order by n) filter (where obtenido like '%infinite recursion%'), ''), 'ninguno'),
       count(*) filter (where obtenido like '%infinite recursion%') = 0
from prueba_resultado;

-- Mínimo de casos: 1–44. Si salen menos, la prueba se cortó a la mitad.
insert into prueba_resultado
select 0, 'RESUMEN',
       'todos los casos con ok = true',
       case when count(*) filter (where ok is not true) = 0
            then 'TODO PASÓ (' || count(*) || ' casos). No se guardó nada.'
            else count(*) filter (where ok is not true) || ' caso(s) FALLARON: '
                 || string_agg(n::text, ', ' order by n) filter (where ok is not true)
       end,
       count(*) >= 44 and count(*) filter (where ok is not true) = 0
from prueba_resultado;

select n, caso, esperado, obtenido, ok from prueba_resultado order by n;

-- Deshace TODO: usuarios, tienda, visitas, catálogo y capturas de prueba.
rollback;
