-- =============================================================================
-- pruebas/013_prueba_admin_visitas.sql — Prueba de reasignar visitas, corregir
-- ubicación y auditoría (013)
-- =============================================================================
-- NO es una migración: es una PRUEBA que NO deja nada en la base.
-- Ejecútala DESPUÉS de 013_admin_visitas.sql, en el MISMO proyecto.
--
-- Cómo usarla: copia TODO este archivo en Supabase → SQL Editor → Run.
--   - Todo va dentro de begin … rollback: usuarios, tiendas, visitas, fotos y
--     productos de prueba se crean, se prueban y al final se DESHACE todo.
--   - SIMULAR A UNA PERSONA: "set local role authenticated" + su JWT en
--     request.jwt.claims (lo mismo que hace Supabase con cada consulta).
--     "set local role anon" simula a alguien sin sesión.
--   - Cada caso atrapa su propio error y se anota. Al final: una tabla con TODOS
--     los casos y la fila "0. RESUMEN". Busca ok = true en todas.
--
-- Datos (TODOS inventados):
--   Personas: C1 = campo 1, C2 = campo 2, AD = admin.
--   Visitas:  V1 de C1 (con foto y producto de C1) · V2 de C2 (con ubicación) ·
--             V3 de C1 (sin ubicación) · V4 de C1 (para probar falsear).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Freno: ¿está 013 en ESTA base? (solo lee)
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.admin_reasignar_visita(uuid, uuid)') is null
     or to_regprocedure('public.admin_corregir_ubicacion(uuid, double precision, double precision, double precision)') is null
     or not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'visitas'
                      and column_name = 'ubicacion_original_latitud') then
    raise exception using
      message = 'Falta 013 en ESTA base. No se probó nada.',
      detail  = format('Base: %s · rol actual: %s', current_database(), current_user),
      hint    = 'Ejecuta supabase/013_admin_visitas.sql en este mismo proyecto (8 filas ok = true) '
                || 'y vuelve a correr esta prueba.';
  end if;
end;
$$;

create temp table prueba_resultado (
  n int, caso text, esperado text, obtenido text, ok boolean
) on commit drop;

create function pg_temp.error_texto(p_estado text, p_mensaje text) returns text language sql as $$
  select case
    when p_mensaje like 'new row violates row-level security policy%' then 'rechazado (regla RLS)'
    when p_estado = '42501' then 'rechazado (sin permiso)'
    when p_estado = '22023' then 'rechazado (dato inválido)'
    when p_estado = 'P0002' then 'rechazado (no existe)'
    when p_estado = '23514' then 'rechazado (CHECK)'
    else 'otro error: ' || p_mensaje
  end;
$$;

create function pg_temp.anotar(p_n int, p_caso text, p_esperado text, p_obtenido text)
returns void language sql as $$
  insert into pg_temp.prueba_resultado
  values (p_n, p_caso, p_esperado, coalesce(p_obtenido, '(vacío)'), p_obtenido = p_esperado);
$$;


-- -----------------------------------------------------------------------------
-- 1. Datos inventados (los crea el SQL Editor).
-- -----------------------------------------------------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000013001',
   'authenticated', 'authenticated', 'prueba013-campo1@ejemplo.invalid', '', now(),
   '{"provider": "email", "providers": ["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000013002',
   'authenticated', 'authenticated', 'prueba013-campo2@ejemplo.invalid', '', now(),
   '{"provider": "email", "providers": ["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000013003',
   'authenticated', 'authenticated', 'prueba013-admin@ejemplo.invalid', '', now(),
   '{"provider": "email", "providers": ["email"], "rol": "admin"}', '{}', now(), now());

insert into public.competidores (nombre, activo, orden) values
  ('PRUEBA 013 TA (se deshace)', true, 994),
  ('PRUEBA 013 TB (se deshace)', true, 995);

create temp table t on commit drop as
select (select id from public.competidores where nombre = 'PRUEBA 013 TA (se deshace)') as ta,
       (select id from public.competidores where nombre = 'PRUEBA 013 TB (se deshace)') as tb;

insert into public.visitas (id, competidor_id, latitud, longitud, precision_metros, ubicacion_at, usuario_id)
values
  ('00000000-0000-4000-8000-000000013011', (select ta from t), 19.1, -99.1, 12, '2026-11-20 10:00+00',
   '00000000-0000-4000-8000-000000013001'),  -- V1 de C1
  ('00000000-0000-4000-8000-000000013012', (select ta from t), 20.5, -100.5, 30, '2026-11-20 11:00+00',
   '00000000-0000-4000-8000-000000013002'),  -- V2 de C2
  ('00000000-0000-4000-8000-000000013013', (select ta from t), null, null, null, null,
   '00000000-0000-4000-8000-000000013001'),  -- V3 de C1, sin ubicación
  ('00000000-0000-4000-8000-000000013014', (select ta from t), 19.4, -99.4, 8, '2026-11-20 12:00+00',
   '00000000-0000-4000-8000-000000013001');  -- V4 de C1

insert into public.fotos (id, visita_id, ruta, estado_proceso, subida_por) values
  ('00000000-0000-4000-8000-000000013021', '00000000-0000-4000-8000-000000013011',
   'visitas/00000000-0000-4000-8000-000000013011/00000000-0000-4000-8000-000000013021.jpg',
   'pendiente', '00000000-0000-4000-8000-000000013001');

insert into public.capturas_manuales (id, visita_id, usuario_id, articulo, precio_regular) values
  ('00000000-0000-4000-8000-000000013031', '00000000-0000-4000-8000-000000013011',
   '00000000-0000-4000-8000-000000013001', 'K1 prueba 013', 10);


-- -----------------------------------------------------------------------------
-- 2. Casos.
-- -----------------------------------------------------------------------------
do $$
declare
  jwt_c1 constant text := '{"sub": "00000000-0000-4000-8000-000000013001", "role": "authenticated",
    "app_metadata": {"provider": "email", "providers": ["email"]}, "user_metadata": {}}';
  jwt_c2 constant text := '{"sub": "00000000-0000-4000-8000-000000013002", "role": "authenticated",
    "app_metadata": {"provider": "email", "providers": ["email"]}, "user_metadata": {}}';
  jwt_ad constant text := '{"sub": "00000000-0000-4000-8000-000000013003", "role": "authenticated",
    "app_metadata": {"provider": "email", "providers": ["email"], "rol": "admin"}, "user_metadata": {}}';
  -- C1 intentando hacerse pasar por admin con user_metadata (que la persona SÍ puede cambiar).
  jwt_c1_falso constant text := '{"sub": "00000000-0000-4000-8000-000000013001", "role": "authenticated",
    "app_metadata": {"provider": "email", "providers": ["email"]}, "user_metadata": {"rol": "admin"}}';
  jwt_anon constant text := '{"role": "anon"}';

  c1 constant uuid := '00000000-0000-4000-8000-000000013001';
  c2 constant uuid := '00000000-0000-4000-8000-000000013002';
  ad constant uuid := '00000000-0000-4000-8000-000000013003';
  nadie constant uuid := '00000000-0000-4000-8000-000000013099';
  v1 constant uuid := '00000000-0000-4000-8000-000000013011';
  v2 constant uuid := '00000000-0000-4000-8000-000000013012';
  v3 constant uuid := '00000000-0000-4000-8000-000000013013';
  v4 constant uuid := '00000000-0000-4000-8000-000000013014';
  k1 constant uuid := '00000000-0000-4000-8000-000000013031';
  ta bigint := (select t.ta from t);
  tb bigint := (select t.tb from t);

  v_obt text;
  v_n   int;
  v_n_texto text;
  v_rol_editor constant text := current_user;
begin
  -- ===== REASIGNAR (a) =========================================================
  -- 1. AD reasigna V1 (de C1) a C2.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    perform public.admin_reasignar_visita(v1, c2);
    reset role;
    select format('dueño %s; último cambio por %s; hora %s',
                  case usuario_id when c2 then 'C2' when c1 then 'C1' else coalesce(usuario_id::text, 'nadie') end,
                  case actualizado_por when ad then 'AD' else coalesce(actualizado_por::text, 'nadie') end,
                  case when actualizado_at = now() then 'del servidor' else 'otra' end)
      into v_obt from public.visitas where id = v1;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(1, 'AD reasigna V1 de C1 a C2; la auditoría dice AD y hora del servidor',
    'dueño C2; último cambio por AD; hora del servidor', v_obt);

  -- 2. C1 ya no ve V1, ni su foto, ni su producto.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    select format('visita %s, fotos %s, productos %s',
                  (select count(*) from public.visitas where id = v1),
                  (select count(*) from public.fotos where visita_id = v1),
                  (select count(*) from public.capturas_manuales where visita_id = v1))
      into v_obt;
    reset role;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(2, 'Después de reasignar, C1 ya NO ve V1 ni sus fotos ni productos',
    'visita 0, fotos 0, productos 0', v_obt);

  -- 3. C2 ve V1 con su foto y su producto.
  begin
    perform set_config('request.jwt.claims', jwt_c2, true); set local role authenticated;
    select format('visita %s, fotos %s, productos %s',
                  (select count(*) from public.visitas where id = v1),
                  (select count(*) from public.fotos where visita_id = v1),
                  (select count(*) from public.capturas_manuales where visita_id = v1))
      into v_obt;
    reset role;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(3, 'Después de reasignar, C2 ve V1 con su foto y su producto',
    'visita 1, fotos 1, productos 1', v_obt);

  -- 4. El producto conserva a su AUTOR (C1): C2 lo ve pero no lo edita; el admin sí.
  begin
    perform set_config('request.jwt.claims', jwt_c2, true); set local role authenticated;
    with cambiadas as (update public.capturas_manuales set precio_regular = 1 where id = k1 returning id)
    select count(*) into v_n from cambiadas;
    reset role;
    v_obt := format('C2 %s filas', v_n);
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    with cambiadas as (update public.capturas_manuales set precio_regular = 15 where id = k1 returning id)
    select count(*) into v_n from cambiadas;
    reset role;
    v_obt := v_obt || format('; AD %s fila; autor %s', v_n,
      (select case usuario_id when c1 then 'C1' else coalesce(usuario_id::text, 'nadie') end
       from public.capturas_manuales where id = k1));
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(4, 'Producto de V1: sigue a nombre de C1; C2 no lo edita, el admin sí',
    'C2 0 filas; AD 1 fila; autor C1', v_obt);

  -- 5. C1 ya no cambia la tienda de V1 (ya no es suya).
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    with cambiadas as (update public.visitas set competidor_id = tb where id = v1 returning id)
    select count(*) into v_n from cambiadas;
    reset role;
    v_obt := format('%s filas', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(5, 'C1 ya NO cambia la tienda de V1 (ya no es suya)', '0 filas', v_obt);

  -- 6–8. Datos inválidos para reasignar.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    perform public.admin_reasignar_visita(v4, nadie);
    reset role;
    v_obt := 'cambiado';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(6, 'AD NO reasigna a una cuenta que no existe', 'rechazado (dato inválido)', v_obt);

  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    perform public.admin_reasignar_visita(v4, null);
    reset role;
    v_obt := 'cambiado';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(7, 'AD NO deja una visita sin dueño (null)', 'rechazado (dato inválido)', v_obt);

  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    perform public.admin_reasignar_visita('00000000-0000-4000-8000-000000013098', c1);
    reset role;
    v_obt := 'cambiado';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(8, 'AD: visita inexistente → aviso (no "éxito" en silencio)', 'rechazado (no existe)', v_obt);

  -- ===== CORREGIR UBICACIÓN (b) =================================================
  -- 9. AD corrige la ubicación de V2 (de C2): se guarda la original y quién corrigió.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    perform public.admin_corregir_ubicacion(v2, 20.6, -100.6, null);
    reset role;
    select format('nueva %s,%s prec %s; original %s,%s prec %s hora %s; corrigió %s %s; dueño %s',
                  latitud, longitud, coalesce(precision_metros::text, 'nula'),
                  ubicacion_original_latitud, ubicacion_original_longitud,
                  ubicacion_original_precision_metros,
                  case when ubicacion_original_at = '2026-11-20 11:00+00' then 'del celular' else 'otra' end,
                  case ubicacion_corregida_por when ad then 'AD' else coalesce(ubicacion_corregida_por::text, 'nadie') end,
                  case when ubicacion_corregida_at = now() then 'ahora' else 'otra hora' end,
                  case usuario_id when c2 then 'C2' else 'otro' end)
      into v_obt from public.visitas where id = v2;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(9, 'AD corrige la ubicación de V2 (de C2); queda la original del celular y quién corrigió',
    'nueva 20.6,-100.6 prec nula; original 20.5,-100.5 prec 30 hora del celular; corrigió AD ahora; dueño C2', v_obt);

  -- 10. Segunda corrección: la ORIGINAL no cambia (sigue la del celular).
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    perform public.admin_corregir_ubicacion(v2, 20.7, -100.7, 5);
    reset role;
    select format('nueva %s,%s prec %s; original %s,%s', latitud, longitud, precision_metros,
                  ubicacion_original_latitud, ubicacion_original_longitud)
      into v_obt from public.visitas where id = v2;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(10, 'Segunda corrección: la ubicación ORIGINAL se conserva',
    'nueva 20.7,-100.7 prec 5; original 20.5,-100.5', v_obt);

  -- 11. C2 (dueño) ve que su visita fue corregida y por quién (el id; el nombre lo pone la app).
  begin
    perform set_config('request.jwt.claims', jwt_c2, true); set local role authenticated;
    select format('corregida %s por %s', (ubicacion_corregida_at is not null)::text,
                  case ubicacion_corregida_por when ad then 'AD' else 'otro' end)
      into v_obt from public.visitas where id = v2;
    reset role;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(11, 'C2 ve el marcador "corregida" en su visita', 'corregida true por AD', v_obt);

  -- 12. Visita SIN ubicación: se corrige; la original queda vacía.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    perform public.admin_corregir_ubicacion(v3, 19.3, -99.3);
    reset role;
    select format('nueva %s,%s; original %s; corregida %s', latitud, longitud,
                  coalesce(ubicacion_original_latitud::text, 'vacía'), (ubicacion_corregida_at is not null)::text)
      into v_obt from public.visitas where id = v3;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(12, 'Visita sin ubicación: se corrige y la original queda vacía',
    'nueva 19.3,-99.3; original vacía; corregida true', v_obt);

  -- 13–16. Coordenadas inválidas.
  declare
    casos constant text[][] := array[
      array['13', 'latitud 200',           '200', '-99', 'null'],
      array['14', 'longitud nula',         '19',  'null', 'null'],
      array['15', 'latitud NaN',           '''NaN''', '-99', 'null'],
      array['16', 'precisión negativa',    '19',  '-99', '-5']
    ];
    i int;
  begin
    for i in 1 .. array_length(casos, 1) loop
      begin
        perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
        execute format('select public.admin_corregir_ubicacion(%L, %s::double precision, %s::double precision, %s::double precision)',
                       v4, casos[i][3], casos[i][4], casos[i][5]);
        reset role;
        v_obt := 'cambiado';
      exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
      end;
      perform pg_temp.anotar(casos[i][1]::int, 'AD NO guarda una ubicación inválida: ' || casos[i][2],
                             'rechazado (dato inválido)', v_obt);
    end loop;
  end;

  -- ===== EL PERSONAL DE CAMPO NO USA LAS FUNCIONES DE ADMIN ======================
  -- 17. C1 intenta reasignar SU visita a C2.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    perform public.admin_reasignar_visita(v4, c2);
    reset role;
    v_obt := 'cambiado';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(17, 'C1 NO usa admin_reasignar_visita (ni en su propia visita)', 'rechazado (sin permiso)', v_obt);

  -- 18. C1 intenta corregir la ubicación de SU visita.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    perform public.admin_corregir_ubicacion(v4, 1, 1);
    reset role;
    v_obt := 'cambiado';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(18, 'C1 NO usa admin_corregir_ubicacion (ni en su propia visita)', 'rechazado (sin permiso)', v_obt);

  -- 19. C1 con "rol: admin" en user_metadata (que sí puede cambiar) sigue sin ser admin.
  begin
    perform set_config('request.jwt.claims', jwt_c1_falso, true); set local role authenticated;
    perform public.admin_reasignar_visita(v2, c1);
    reset role;
    v_obt := 'cambiado';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(19, 'C1 con rol admin en user_metadata NO es admin', 'rechazado (sin permiso)', v_obt);

  -- 20. C2 intenta reasignar la visita de C1 a sí mismo.
  begin
    perform set_config('request.jwt.claims', jwt_c2, true); set local role authenticated;
    perform public.admin_reasignar_visita(v4, c2);
    reset role;
    v_obt := 'cambiado';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(20, 'C2 NO se queda con la visita de C1', 'rechazado (sin permiso)', v_obt);

  -- ===== NADIE FALSEA DUEÑO, UBICACIÓN NI AUDITORÍA CON UN UPDATE DIRECTO =======
  declare
    casos constant text[][] := array[
      array['21', 'usuario_id (darse o regalar la visita)', $q$usuario_id = '00000000-0000-4000-8000-000000013002'$q$],
      array['22', 'latitud y longitud',                     $q$latitud = 1, longitud = 1$q$],
      array['23', 'actualizado_por',                        $q$actualizado_por = '00000000-0000-4000-8000-000000013003'$q$],
      array['24', 'actualizado_at',                         $q$actualizado_at = '2000-01-01'$q$],
      array['25', 'ubicacion_corregida_por',                $q$ubicacion_corregida_por = '00000000-0000-4000-8000-000000013003'$q$],
      array['26', 'ubicacion_original_latitud',             $q$ubicacion_original_latitud = 1$q$]
    ];
    i int;
  begin
    for i in 1 .. array_length(casos, 1) loop
      begin
        perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
        execute format('update public.visitas set %s where id = %L', casos[i][3], v4);
        reset role;
        v_obt := 'cambiado';
      exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
      end;
      perform pg_temp.anotar(casos[i][1]::int, 'C1 NO cambia ' || casos[i][2] || ' de su visita (update directo)',
                             'rechazado (sin permiso)', v_obt);
    end loop;
  end;

  -- 27. Tampoco el admin con un update directo de usuario_id (solo por la función).
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    update public.visitas set usuario_id = ad where id = v4;
    reset role;
    v_obt := 'cambiado';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(27, 'AD NO cambia usuario_id con un update directo (solo con la función)',
    'rechazado (sin permiso)', v_obt);

  -- 28. Al CREAR una visita, C1 no puede mandar dueño ni auditoría.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into public.visitas (competidor_id, latitud, longitud, actualizado_por, ubicacion_corregida_por)
    values (ta, 19, -99, ad, ad);
    reset role;
    v_obt := 'creada';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into public.visitas (competidor_id, latitud, longitud, usuario_id)
    values (ta, 19, -99, c2);
    reset role;
    v_obt := v_obt || '; creada';
  exception when others then v_obt := v_obt || '; ' || pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  -- Control: la misma persona SÍ crea una visita normal, y la auditoría nace vacía.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    with creadas as (
      insert into public.visitas (competidor_id, latitud, longitud) values (ta, 19, -99)
      returning usuario_id, actualizado_por, ubicacion_corregida_at
    )
    select format('creada a nombre de %s; auditoría %s',
                  case usuario_id when c1 then 'C1' else 'otro' end,
                  case when actualizado_por is null and ubicacion_corregida_at is null then 'vacía' else 'llena' end)
      into v_n_texto from creadas;
    reset role;
    v_obt := v_obt || '; ' || v_n_texto;
  exception when others then v_obt := v_obt || '; ' || pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(28, 'C1 NO manda auditoría ni otro dueño al crear (pero sí crea una visita normal)',
    'rechazado (sin permiso); rechazado (sin permiso); creada a nombre de C1; auditoría vacía', v_obt);

  -- 29. C1 cambia la tienda de SU visita (permitido por 012): la auditoría dice C1
  -- y la ubicación NO queda marcada como corregida.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    with cambiadas as (update public.visitas set competidor_id = tb where id = v4 returning id)
    select count(*) into v_n from cambiadas;
    reset role;
    select format('%s fila; último cambio por %s; ubicación corregida %s', v_n,
                  case actualizado_por when c1 then 'C1' else coalesce(actualizado_por::text, 'nadie') end,
                  (ubicacion_corregida_at is not null)::text)
      into v_obt from public.visitas where id = v4;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(29, 'C1 cambia la tienda de su visita: auditoría C1, ubicación sin marcar',
    '1 fila; último cambio por C1; ubicación corregida false', v_obt);

  -- 30. El admin cambia la tienda de una visita AJENA (update directo, 012): auditoría AD.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    with cambiadas as (update public.visitas set competidor_id = ta where id = v4 returning id)
    select count(*) into v_n from cambiadas;
    reset role;
    select format('%s fila; último cambio por %s', v_n,
                  case actualizado_por when ad then 'AD' else coalesce(actualizado_por::text, 'nadie') end)
      into v_obt from public.visitas where id = v4;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(30, 'AD edita lo de otro (tienda de V4 de C1): auditoría AD',
    '1 fila; último cambio por AD', v_obt);

  -- 31. C2 no ve las visitas de C1 (ni su auditoría).
  begin
    perform set_config('request.jwt.claims', jwt_c2, true); set local role authenticated;
    select count(*) into v_n from public.visitas where id in (v3, v4);
    reset role;
    v_obt := format('ve %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(31, 'C2 NO ve las visitas de C1', 've 0', v_obt);

  -- ===== anon ======================================================================
  begin
    perform set_config('request.jwt.claims', jwt_anon, true); set local role anon;
    select count(*) into v_n from public.visitas;
    reset role;
    v_obt := format('ve %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  begin
    perform set_config('request.jwt.claims', jwt_anon, true); set local role anon;
    perform public.admin_reasignar_visita(v4, c2);
    reset role;
    v_obt := v_obt || '; cambiado';
  exception when others then v_obt := v_obt || '; ' || pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  begin
    perform set_config('request.jwt.claims', jwt_anon, true); set local role anon;
    perform public.admin_corregir_ubicacion(v4, 1, 1);
    reset role;
    v_obt := v_obt || '; cambiado';
  exception when others then v_obt := v_obt || '; ' || pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(32, 'anon NO ve visitas ni usa las funciones de admin',
    'rechazado (sin permiso); rechazado (sin permiso); rechazado (sin permiso)', v_obt);

  -- 33. Nadie borra visitas (DELETE).
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    delete from public.visitas where id = v4;
    reset role;
    v_obt := 'borrada';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(33, 'Ni el admin borra visitas con DELETE', 'rechazado (sin permiso)', v_obt);

  -- 34. Después de "reset role" se vuelve al rol del SQL Editor.
  v_obt := case when current_user = v_rol_editor then 'mismo rol' else 'otro rol: ' || current_user end;
  perform pg_temp.anotar(34, 'Después de "reset role" se vuelve al rol del SQL Editor', 'mismo rol', v_obt);
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. Resultado visible (todas las filas deben tener ok = true).
-- -----------------------------------------------------------------------------
insert into prueba_resultado
select 35, 'Ningún caso dio "infinite recursion"', 'ninguno',
       coalesce(nullif(string_agg(n::text, ', ' order by n) filter (where obtenido like '%infinite recursion%'), ''), 'ninguno'),
       count(*) filter (where obtenido like '%infinite recursion%') = 0
from prueba_resultado;

insert into prueba_resultado
select 0, 'RESUMEN', 'todos los casos con ok = true',
       case when count(*) filter (where ok is not true) = 0
            then 'TODO PASÓ (' || count(*) || ' casos). No se guardó nada.'
            else count(*) filter (where ok is not true) || ' caso(s) FALLARON: '
                 || string_agg(n::text, ', ' order by n) filter (where ok is not true)
       end,
       count(*) >= 35 and count(*) filter (where ok is not true) = 0
from prueba_resultado;

select n, caso, esperado, obtenido, ok from prueba_resultado order by n;

-- Deshace TODO.
rollback;
