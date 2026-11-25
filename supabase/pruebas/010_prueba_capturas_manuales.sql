-- =============================================================================
-- pruebas/010_prueba_capturas_manuales.sql — Prueba de la captura manual (010)
-- =============================================================================
-- NO es una migración: es una PRUEBA que NO deja nada en la base.
-- Ejecútala DESPUÉS de 010_capturas_manuales.sql.
--
-- Cómo usarla: copia TODO este archivo en Supabase → SQL Editor → Run.
--   - Todo va dentro de una transacción (begin … rollback): los usuarios, la
--     tienda, las visitas, el artículo del catálogo y las capturas de prueba se
--     crean, se prueban y al final se DESHACE todo. Siempre termina con rollback.
--   - USUARIOS DE PRUEBA: se insertan directo en auth.users DENTRO de la
--     transacción, con correos @ejemplo.invalid (como en la prueba 008).
--   - SIMULAR A UNA PERSONA: "set local role authenticated" + su JWT en
--     request.jwt.claims, que es lo que hace Supabase con cada consulta de la
--     app. "set local role anon" simula a alguien sin sesión.
--   - Cada caso atrapa su propio error: la prueba no se detiene a la mitad. Al
--     final sale una tabla con TODOS los casos y una fila "0. RESUMEN".
--     Busca ok = true en todas las filas.
--
-- Simula el FLUJO REAL DE LA APP:
--   - "Guardar datos": UN insert con varias filas … returning (todo o nada).
--   - Abrir la visita: select de las filas de esa visita.
--   - "Quitar": update de descartada_at … returning id.
--   - Sugerencias: select * from sugerencias_captura().
--
-- Datos (TODOS inventados):
--   Personas: C1 = campo 1, C2 = campo 2, AD = admin (rol en app_metadata).
--   Tienda:   "PRUEBA 010 activa".
--   Visitas:  V1 de C1 · V2 de C2 · VA del admin · V0 sin dueño.
--   Catálogo: un artículo con área "PRUEBA 010 ÁREA", clave y descripción
--             inventadas (para comprobar que la función NO las devuelve).
-- =============================================================================

begin;

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
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000001001',
   'authenticated', 'authenticated', 'prueba010-campo1@ejemplo.invalid', '', now(),
   '{"provider": "email", "providers": ["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000001002',
   'authenticated', 'authenticated', 'prueba010-campo2@ejemplo.invalid', '', now(),
   '{"provider": "email", "providers": ["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000001003',
   'authenticated', 'authenticated', 'prueba010-admin@ejemplo.invalid', '', now(),
   '{"provider": "email", "providers": ["email"], "rol": "admin"}', '{}', now(), now());

insert into public.competidores (nombre, activo, orden) values
  ('PRUEBA 010 activa (se deshace)', true, 996);

insert into public.visitas (id, competidor_id, latitud, longitud, usuario_id)
select v.id::uuid, c.id, 19.0, -99.0, v.usuario::uuid
from (values
        ('00000000-0000-4000-8000-000000001011', '00000000-0000-4000-8000-000000001001'),
        ('00000000-0000-4000-8000-000000001012', '00000000-0000-4000-8000-000000001002'),
        ('00000000-0000-4000-8000-000000001013', '00000000-0000-4000-8000-000000001003'),
        ('00000000-0000-4000-8000-000000001014', null)
     ) as v(id, usuario)
cross join public.competidores c
where c.nombre = 'PRUEBA 010 activa (se deshace)';

-- Un artículo del catálogo con clave y descripción inventadas. La función de
-- sugerencias debe devolver su ÁREA y nada más.
insert into public.catalogo_propio
  (clave, descripcion, area, contenido_origen, es_servicio, obsoleto, de_baja, fecha_corte_ultimo)
values
  ('PRUEBA010CLAVE', 'PRUEBA010 DESCRIPCION SECRETA', 'PRUEBA 010 ÁREA', 'sin_dato',
   false, false, false, current_date);


-- -----------------------------------------------------------------------------
-- 2. Casos. "Como C1" = set_config(JWT de C1) + set local role authenticated.
-- Si el bloque falla, Postgres deshace ese bloque (incluido el cambio de rol) y
-- se anota el error; si no falla, "reset role" vuelve al SQL Editor.
-- -----------------------------------------------------------------------------
do $$
declare
  jwt_c1 constant text := '{"sub": "00000000-0000-4000-8000-000000001001", "role": "authenticated",
    "app_metadata": {"provider": "email", "providers": ["email"]}, "user_metadata": {}}';
  jwt_c2 constant text := '{"sub": "00000000-0000-4000-8000-000000001002", "role": "authenticated",
    "app_metadata": {"provider": "email", "providers": ["email"]}, "user_metadata": {}}';
  jwt_ad constant text := '{"sub": "00000000-0000-4000-8000-000000001003", "role": "authenticated",
    "app_metadata": {"provider": "email", "providers": ["email"], "rol": "admin"}, "user_metadata": {}}';
  jwt_anon constant text := '{"role": "anon"}';

  c1 constant uuid := '00000000-0000-4000-8000-000000001001';
  c2 constant uuid := '00000000-0000-4000-8000-000000001002';
  ad constant uuid := '00000000-0000-4000-8000-000000001003';
  v1 constant uuid := '00000000-0000-4000-8000-000000001011';
  v2 constant uuid := '00000000-0000-4000-8000-000000001012';
  va constant uuid := '00000000-0000-4000-8000-000000001013';
  v0 constant uuid := '00000000-0000-4000-8000-000000001014';
  visitas_prueba constant uuid[] := array[
    '00000000-0000-4000-8000-000000001011', '00000000-0000-4000-8000-000000001012',
    '00000000-0000-4000-8000-000000001013', '00000000-0000-4000-8000-000000001014']::uuid[];
  hora_falsa constant timestamptz := '2000-01-01 00:00:00+00';

  v_obt  text;
  v_n    int;
  v_ids  uuid[];
  v_duenos uuid[];
  v_uuid uuid;
  v_hora timestamptz;
  v_txt  text;
  v_fila_c1 uuid;   -- una fila de C1 (la que se descarta)
  v_fila_c1b uuid;  -- otra fila de C1 (sigue vigente)
  v_fila_c2 uuid;   -- la fila de C2
begin
  -- ===== CREAR ("Guardar datos": un solo insert con varias filas) ============
  -- 1. C1 guarda 2 filas en SU visita. El servidor pone usuario_id.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    with nuevas as (
      insert into public.capturas_manuales
        (visita_id, articulo, cantidad, unidad, piezas, precio_regular, marca, area,
         marca_de_lista, area_de_lista, promo_tipo, promo_piezas, promo_precio_total,
         promo_paga_piezas, promo_condicion, observaciones)
      values
        (v1, 'Refresco cola prueba', 600, 'ml', 1, 18.50, 'Marca Prueba', 'PRUEBA 010 ÁREA',
         false, true, 'ninguna', null, null, null, 'ninguna', null),
        (v1, 'Galletas prueba', 1.5, 'kg', 2, 99.90, 'MARCA PRUEBA', null,
         true, false, 'n_por_precio', 2, 180.00, null, 'tarjeta', 'Cartel amarillo')
      returning id, usuario_id
    )
    select array_agg(id), array_agg(distinct usuario_id) into v_ids, v_duenos from nuevas;
    reset role;
    v_fila_c1 := v_ids[1];
    v_fila_c1b := v_ids[2];
    v_obt := format('creadas %s, dueño %s', coalesce(cardinality(v_ids), 0),
                    case when v_duenos = array[c1] then 'C1' else coalesce(v_duenos::text, 'ninguno') end);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(1, 'C1 guarda 2 filas en su visita (insert … returning); el dueño lo pone el servidor',
                         'creadas 2, dueño C1', v_obt);

  -- 2. Columnas generadas con la normalización de lecturas_precio: 1.5 kg × 2 = 3000 g.
  select format('%s %s', unidad_base, trim_scale(contenido_base)) into v_obt
  from public.capturas_manuales where id = v_fila_c1b;
  perform pg_temp.anotar(2, 'Normalización igual que lecturas_precio (1.5 kg × 2 piezas)', 'g 3000', v_obt);

  -- 3. C1 abre su visita: ve sus 2 filas.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    select count(*) into v_n from public.capturas_manuales where visita_id = v1;
    reset role;
    v_obt := format('ve %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(3, 'C1 ve las filas de su visita', 've 2', v_obt);

  -- 4. C2 guarda 1 fila en SU visita.
  begin
    perform set_config('request.jwt.claims', jwt_c2, true); set local role authenticated;
    insert into public.capturas_manuales (visita_id, articulo, cantidad, unidad, piezas, precio_regular)
    values (v2, 'Leche prueba', 1, 'l', 1, 0)
    returning id into v_fila_c2;
    reset role;
    v_obt := case when v_fila_c2 is not null then 'creada' else 'no creada' end;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(4, 'C2 guarda una fila en su visita (precio 0 se acepta)', 'creada', v_obt);

  -- ===== NO VER NI CREAR EN VISITAS AJENAS ==================================
  -- 5. C2 no ve las filas de la visita de C1.
  begin
    perform set_config('request.jwt.claims', jwt_c2, true); set local role authenticated;
    select count(*) into v_n from public.capturas_manuales where visita_id = v1;
    reset role;
    v_obt := format('ve %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(5, 'C2 NO ve las filas de la visita de C1', 've 0', v_obt);

  -- 6. C1 tampoco ve la de C2 (en total ve solo las suyas).
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    select count(*) into v_n from public.capturas_manuales where visita_id = any (visitas_prueba);
    reset role;
    v_obt := format('ve %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(6, 'C1 ve solo sus 2 filas (no la de C2)', 've 2', v_obt);

  -- 7. C2 no puede crear en la visita de C1.
  begin
    perform set_config('request.jwt.claims', jwt_c2, true); set local role authenticated;
    insert into public.capturas_manuales (visita_id, articulo, cantidad, unidad, precio_regular)
    values (v1, 'Intruso', 1, 'pza', 10);
    reset role;
    v_obt := 'creada';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(7, 'C2 NO crea filas en la visita de C1', 'rechazado (regla RLS)', v_obt);

  -- 8. C1 no puede crear en una visita sin dueño (de antes del login).
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into public.capturas_manuales (visita_id, articulo, cantidad, unidad, precio_regular)
    values (v0, 'Intruso', 1, 'pza', 10);
    reset role;
    v_obt := 'creada';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(8, 'C1 NO crea filas en una visita sin dueño', 'rechazado (regla RLS)', v_obt);

  -- ===== ADMIN ===============================================================
  -- 9. El admin ve todas las filas (de C1 y de C2).
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    select count(*) into v_n from public.capturas_manuales where visita_id = any (visitas_prueba);
    reset role;
    v_obt := format('ve %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(9, 'El admin ve todas las filas', 've 3', v_obt);

  -- 10. El admin crea en SU visita.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    insert into public.capturas_manuales (visita_id, articulo, cantidad, unidad, precio_regular)
    values (va, 'Agua prueba', 1, 'l', 12)
    returning usuario_id into v_uuid;
    reset role;
    v_obt := case when v_uuid = ad then 'creada a nombre del admin' else 'dueño ' || coalesce(v_uuid::text, 'ninguno') end;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(10, 'El admin crea filas en su propia visita', 'creada a nombre del admin', v_obt);

  -- 11. El admin NO crea en la visita de otra persona (solo ve).
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    insert into public.capturas_manuales (visita_id, articulo, cantidad, unidad, precio_regular)
    values (v1, 'Admin en ajena', 1, 'pza', 10);
    reset role;
    v_obt := 'creada';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(11, 'El admin NO crea filas en la visita de C1', 'rechazado (regla RLS)', v_obt);

  -- ===== NO FALSEAR, NO MODIFICAR, NO BORRAR =================================
  -- 12. C1 no puede mandar usuario_id (ni siquiera el de otra persona).
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into public.capturas_manuales (visita_id, usuario_id, articulo, cantidad, unidad, precio_regular)
    values (v1, c2, 'Falsa', 1, 'pza', 10);
    reset role;
    v_obt := 'creada';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(12, 'C1 NO puede mandar usuario_id (no se falsea el autor)', 'rechazado (sin permiso)', v_obt);

  -- 13. C1 no puede crear una fila ya quitada (descartada_at en el insert).
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into public.capturas_manuales (visita_id, articulo, cantidad, unidad, precio_regular, descartada_at)
    values (v1, 'Ya quitada', 1, 'pza', 10, now());
    reset role;
    v_obt := 'creada';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(13, 'C1 NO manda descartada_at al crear', 'rechazado (sin permiso)', v_obt);

  -- 14. C1 no puede cambiar el precio de su fila.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    update public.capturas_manuales set precio_regular = 1 where id = v_fila_c1;
    reset role;
    v_obt := 'cambiada';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(14, 'C1 NO cambia el precio de su fila', 'rechazado (sin permiso)', v_obt);

  -- 15. C1 no puede mover su fila a otra visita ni cambiar el autor.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    update public.capturas_manuales set visita_id = v2, usuario_id = c2 where id = v_fila_c1;
    reset role;
    v_obt := 'cambiada';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(15, 'C1 NO cambia visita_id ni usuario_id', 'rechazado (sin permiso)', v_obt);

  -- 16. C1 no puede borrar su fila.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    delete from public.capturas_manuales where id = v_fila_c1;
    reset role;
    v_obt := 'borrada';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(16, 'C1 NO borra su fila', 'rechazado (sin permiso)', v_obt);

  -- ===== QUITAR (descartada_at) ==============================================
  -- 17. C2 intenta quitar una fila de C1: no la ve, no cambia nada.
  begin
    perform set_config('request.jwt.claims', jwt_c2, true); set local role authenticated;
    with cambiadas as (
      update public.capturas_manuales set descartada_at = now() where id = v_fila_c1 returning id
    ) select count(*) into v_n from cambiadas;
    reset role;
    v_obt := format('%s filas', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(17, 'C2 NO quita filas de C1', '0 filas', v_obt);

  -- 18. El admin tampoco quita filas de otra persona (solo su autor).
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    with cambiadas as (
      update public.capturas_manuales set descartada_at = now() where id = v_fila_c1 returning id
    ) select count(*) into v_n from cambiadas;
    reset role;
    v_obt := format('%s filas', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(18, 'El admin NO quita filas de C1', '0 filas', v_obt);

  -- 19. C1 quita su fila (como la app: update … returning id). Manda una hora
  -- falsa; el servidor pone la suya.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    with cambiadas as (
      update public.capturas_manuales set descartada_at = hora_falsa where id = v_fila_c1 returning id
    ) select count(*) into v_n from cambiadas;
    reset role;
    select descartada_at into v_hora from public.capturas_manuales where id = v_fila_c1;
    v_obt := format('%s fila, hora %s', v_n,
                    case when v_hora = hora_falsa then 'FALSA' when v_hora is null then 'vacía' else 'del servidor' end);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(19, 'C1 quita su fila; la hora la pone el servidor', '1 fila, hora del servidor', v_obt);

  -- 20. C1 no puede restaurarla (descartada_at = null).
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    with cambiadas as (
      update public.capturas_manuales set descartada_at = null where id = v_fila_c1 returning id
    ) select count(*) into v_n from cambiadas;
    reset role;
    v_obt := format('%s filas', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(20, 'C1 NO restaura una fila quitada', '0 filas', v_obt);

  -- 21. Al abrir la visita, la app pide las vigentes: queda 1.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    select count(*) into v_n from public.capturas_manuales where visita_id = v1 and descartada_at is null;
    reset role;
    v_obt := format('ve %s vigente', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(21, 'C1 ve 1 fila vigente después de quitar otra', 've 1 vigente', v_obt);

  -- ===== CHECK: la base rechaza valores inválidos ============================
  -- Cada uno como C1 en su visita. Una fila válida de base y se cambia un dato.
  declare
    casos constant text[][] := array[
      array['22', 'unidad "litro" (no está en la lista)', $q$(v, 'X', 1, 'litro', 1, 10, 'ninguna', null, null, null, 'ninguna')$q$],
      array['23', 'cantidad 0',                             $q$(v, 'X', 0, 'g', 1, 10, 'ninguna', null, null, null, 'ninguna')$q$],
      array['24', 'cantidad con 4 decimales',               $q$(v, 'X', 1.2345, 'g', 1, 10, 'ninguna', null, null, null, 'ninguna')$q$],
      array['25', 'precio negativo',                        $q$(v, 'X', 1, 'g', 1, -1, 'ninguna', null, null, null, 'ninguna')$q$],
      array['26', 'precio con 3 decimales',                 $q$(v, 'X', 1, 'g', 1, 10.555, 'ninguna', null, null, null, 'ninguna')$q$],
      array['27', 'piezas 0',                               $q$(v, 'X', 1, 'g', 0, 10, 'ninguna', null, null, null, 'ninguna')$q$],
      array['28', 'artículo en blanco',                     $q$(v, '   ', 1, 'g', 1, 10, 'ninguna', null, null, null, 'ninguna')$q$],
      array['29', 'promo_tipo "combo" (no está en la lista)', $q$(v, 'X', 1, 'g', 1, 10, 'combo', 2, 10, null, 'ninguna')$q$],
      array['30', 'condición "monedero" (no está en la lista)', $q$(v, 'X', 1, 'g', 1, 10, 'precio_rebajado', 1, 8, null, 'monedero')$q$],
      array['31', 'sin promoción pero con precio de promoción', $q$(v, 'X', 1, 'g', 1, 10, 'ninguna', null, 8, null, 'ninguna')$q$],
      array['32', '"2 x $" con 1 pieza',                    $q$(v, 'X', 1, 'g', 1, 10, 'n_por_precio', 1, 15, null, 'ninguna')$q$],
      array['33', '"lleva 3 paga 3"',                        $q$(v, 'X', 1, 'g', 1, 10, 'nxm', 3, null, 3, 'ninguna')$q$]
    ];
    i int;
  begin
    for i in 1 .. array_length(casos, 1) loop
      begin
        perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
        execute format(
          'insert into public.capturas_manuales (visita_id, articulo, cantidad, unidad, piezas, precio_regular,
             promo_tipo, promo_piezas, promo_precio_total, promo_paga_piezas, promo_condicion)
           values %s',
          replace(casos[i][3], '(v,', format('(%L::uuid,', v1)));
        reset role;
        v_obt := 'aceptado';
      exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
      end;
      perform pg_temp.anotar(casos[i][1]::int, 'CHECK rechaza: ' || casos[i][2], 'rechazado (CHECK)', v_obt);
    end loop;
  end;

  -- 34. Una promoción válida de cada tipo sí entra.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into public.capturas_manuales
      (visita_id, articulo, cantidad, unidad, piezas, precio_regular,
       promo_tipo, promo_piezas, promo_precio_total, promo_paga_piezas, promo_condicion)
    values
      (v1, 'Rebajado', 500, 'g',   1, 30, 'precio_rebajado', 1, 25,   null, 'app'),
      (v1, 'Dos por',  355, 'ml',  6, 90, 'n_por_precio',    2, 160,  null, 'ninguna'),
      (v1, 'Tres x 2', 1,   'pza', 1, 15, 'nxm',             3, null, 2,    'ninguna'),
      (v1, 'Otra',     1,   'pza', 1, 15, 'otro',            null, null, null, 'otro');
    get diagnostics v_n = row_count;
    reset role;
    v_obt := format('aceptadas %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(34, 'Promociones válidas (rebajado, 2 x $, 3 x 2, otro) sí entran', 'aceptadas 4', v_obt);

  -- 35. "Guardar datos" es todo o nada: si una fila del grupo es inválida, no
  -- se guarda ninguna.
  begin
    select count(*) into v_n from public.capturas_manuales where visita_id = v1;
    begin
      perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
      insert into public.capturas_manuales (visita_id, articulo, cantidad, unidad, precio_regular)
      values (v1, 'Buena 1', 1, 'pza', 10),
             (v1, 'Buena 2', 1, 'pza', 11),
             (v1, 'Mala',    1, 'onza', 12);
      reset role;
    exception when others then null;
    end;
    select format('antes %s, después %s', v_n, count(*)) into v_obt
    from public.capturas_manuales where visita_id = v1;
    v_obt := case when v_obt = format('antes %s, después %s', v_n, v_n) then 'no se guardó ninguna' else v_obt end;
  end;
  perform pg_temp.anotar(35, 'Guardar varias filas es todo o nada (una mala → ninguna)', 'no se guardó ninguna', v_obt);

  -- ===== ANON (sin sesión) ===================================================
  -- 36. anon no lee.
  begin
    perform set_config('request.jwt.claims', jwt_anon, true); set local role anon;
    select count(*) into v_n from public.capturas_manuales;
    reset role;
    v_obt := format('ve %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(36, 'anon NO ve nada', 'rechazado (sin permiso)', v_obt);

  -- 37. anon no crea.
  begin
    perform set_config('request.jwt.claims', jwt_anon, true); set local role anon;
    insert into public.capturas_manuales (visita_id, articulo, cantidad, unidad, precio_regular)
    values (v0, 'Anon', 1, 'pza', 10);
    reset role;
    v_obt := 'creada';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(37, 'anon NO crea', 'rechazado (sin permiso)', v_obt);

  -- 38. anon no usa la función de sugerencias.
  begin
    perform set_config('request.jwt.claims', jwt_anon, true); set local role anon;
    select count(*) into v_n from public.sugerencias_captura();
    reset role;
    v_obt := format('devolvió %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(38, 'anon NO ejecuta sugerencias_captura', 'rechazado (sin permiso)', v_obt);

  -- ===== SUGERENCIAS =========================================================
  -- 39. Como C1: devuelve solo las columnas tipo y valor.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    select string_agg(distinct k, ', ' order by k) into v_obt
    from public.sugerencias_captura() s, jsonb_object_keys(to_jsonb(s)) as k;
    reset role;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(39, 'Sugerencias: solo columnas tipo y valor', 'tipo, valor', v_obt);

  -- 40. El área del catálogo aparece como nombre; la clave y la descripción NO.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    select format('área %s; clave %s; descripción %s',
                  case when bool_or(tipo = 'area' and valor = 'PRUEBA 010 ÁREA') then 'sí' else 'no' end,
                  case when bool_or(valor ilike '%PRUEBA010CLAVE%') then 'SÍ' else 'no' end,
                  case when bool_or(valor ilike '%DESCRIPCION SECRETA%') then 'SÍ' else 'no' end)
      into v_obt
    from public.sugerencias_captura();
    reset role;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(40, 'Sugerencias: el área sale como nombre; nunca la clave ni la descripción',
                         'área sí; clave no; descripción no', v_obt);

  -- 41. Marcas: "Marca Prueba" y "MARCA PRUEBA" salen una sola vez.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    select count(*)::text into v_obt
    from public.sugerencias_captura()
    where tipo = 'marca' and lower(valor) = 'marca prueba';
    reset role;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(41, 'Sugerencias: la misma marca con otras mayúsculas sale una vez', '1', v_obt);

  -- 42. Solo hay tipos 'area' y 'marca' (ningún precio ni otro dato).
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    select coalesce(string_agg(distinct tipo, ', ' order by tipo), 'ninguno') into v_obt
    from public.sugerencias_captura();
    reset role;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(42, 'Sugerencias: solo tipos area y marca', 'area, marca', v_obt);

  -- 43. La app (authenticated) sigue SIN acceso a catalogo_propio.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    select count(*) into v_n from public.catalogo_propio;
    reset role;
    v_obt := format('ve %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(43, 'C1 NO lee catalogo_propio directo', 'rechazado (sin permiso)', v_obt);

  -- 44. Ni el admin (la Etapa 2 sigue cerrada en la app).
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    select count(*) into v_n from public.catalogo_propio;
    reset role;
    v_obt := format('ve %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(44, 'El admin NO lee catalogo_propio directo', 'rechazado (sin permiso)', v_obt);
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. Resultado visible (todas las filas deben tener ok = true).
-- -----------------------------------------------------------------------------
-- 45. Guardia: ningún caso terminó en "infinite recursion".
insert into prueba_resultado
select 45, 'Ningún caso dio "infinite recursion"',
       'ninguno',
       coalesce(nullif(string_agg(n::text, ', ' order by n) filter (where obtenido like '%infinite recursion%'), ''), 'ninguno'),
       count(*) filter (where obtenido like '%infinite recursion%') = 0
from prueba_resultado;

-- Mínimo de casos: 1–45. Si salen menos, la prueba se cortó a la mitad.
insert into prueba_resultado
select 0, 'RESUMEN',
       'todos los casos con ok = true',
       case when count(*) filter (where ok is not true) = 0
            then 'TODO PASÓ (' || count(*) || ' casos). No se guardó nada.'
            else count(*) filter (where ok is not true) || ' caso(s) FALLARON: '
                 || string_agg(n::text, ', ' order by n) filter (where ok is not true)
       end,
       count(*) >= 45 and count(*) filter (where ok is not true) = 0
from prueba_resultado;

select n, caso, esperado, obtenido, ok from prueba_resultado order by n;

-- Deshace TODO: usuarios, tienda, visitas, catálogo y capturas de prueba.
rollback;
