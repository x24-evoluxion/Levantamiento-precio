-- =============================================================================
-- pruebas/012_prueba_editar_borrar.sql — Prueba de editar y borrar (012)
-- =============================================================================
-- NO es una migración: es una PRUEBA que NO deja nada en la base.
-- Ejecútala DESPUÉS de 012_editar_borrar.sql, en el MISMO proyecto.
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
-- "OTRA PETICIÓN": en la app, cada operación es su propia transacción, así que
-- una fila borrada deja de verse en la siguiente (la regla compara con now(),
-- que es la hora de inicio de cada transacción). Esta prueba es UNA sola
-- transacción (now() no cambia), así que pg_temp.otra_peticion() mueve un minuto
-- atrás la hora de lo recién borrado, como si ya fuera otra petición. Para eso
-- apaga los triggers SOLO un instante dentro de esta transacción (se deshace con
-- el rollback). Necesita que el SQL Editor sea dueño de las tablas (lo es).
--
-- Simula el FLUJO REAL DE LA APP: "update … where id = … returning id" (lo que
-- hace supabase-js con .update().eq().select("id")). "0 filas" = la app avisa.
--
-- Datos (TODOS inventados):
--   Personas: C1 = campo 1, C2 = campo 2, AD = admin.
--   Tiendas:  TA y TB activas, TI inactiva.
--   Visitas:  V1 de C1 (foto pendiente) · VF de C1 (foto YA LEÍDA) ·
--             VD de C1 (se borra) · V2 de C2 · VE de C1 (para "borrar y cambiar").
--   Productos: K1 y K1b de C1 en V1 · KD de C1 en VD · K2 de C2 en V2.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Freno: ¿está 012 en ESTA base? (solo lee)
-- -----------------------------------------------------------------------------
do $$
declare
  v_faltan text[] := array[]::text[];
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'visitas' and column_name = 'descartada_at') then
    v_faltan := v_faltan || 'columna visitas.descartada_at (012)'::text;
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'capturas_manuales'
                   and column_name = 'actualizado_por') then
    v_faltan := v_faltan || 'columna capturas_manuales.actualizado_por (012)'::text;
  end if;
  if to_regprocedure('privado.visita_sin_fotos_leidas(uuid)') is null then
    v_faltan := v_faltan || 'función privado.visita_sin_fotos_leidas (012)'::text;
  end if;
  if cardinality(v_faltan) > 0 then
    raise exception using
      message = 'Falta en ESTA base: ' || array_to_string(v_faltan, ', ') || '. No se probó nada.',
      detail  = format('Base: %s · rol actual: %s', current_database(), current_user),
      hint    = 'Ejecuta supabase/012_editar_borrar.sql en este mismo proyecto (13 filas ok = true) '
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
    when p_estado = '22023' then 'rechazado (trigger)'
    when p_estado = '23514' then 'rechazado (CHECK)'
    else 'otro error: ' || p_mensaje
  end;
$$;

create function pg_temp.anotar(p_n int, p_caso text, p_esperado text, p_obtenido text)
returns void language sql as $$
  insert into pg_temp.prueba_resultado
  values (p_n, p_caso, p_esperado, coalesce(p_obtenido, '(vacío)'), p_obtenido = p_esperado);
$$;

-- Simula "la siguiente petición" (ver encabezado). Solo para filas de prueba.
create function pg_temp.otra_peticion() returns void language plpgsql as $f$
begin
  alter table public.visitas disable trigger visitas_proteger_cambios;
  alter table public.capturas_manuales disable trigger capturas_manuales_hora_descarte;
  update public.visitas set descartada_at = descartada_at - interval '1 minute'
  where descartada_at = now() and id::text like '00000000-0000-4000-8000-0000000120%';
  update public.capturas_manuales set descartada_at = descartada_at - interval '1 minute'
  where descartada_at = now() and visita_id::text like '00000000-0000-4000-8000-0000000120%';
  alter table public.visitas enable trigger visitas_proteger_cambios;
  alter table public.capturas_manuales enable trigger capturas_manuales_hora_descarte;
end;
$f$;


-- -----------------------------------------------------------------------------
-- 1. Datos inventados (los crea el SQL Editor).
-- -----------------------------------------------------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000012001',
   'authenticated', 'authenticated', 'prueba012-campo1@ejemplo.invalid', '', now(),
   '{"provider": "email", "providers": ["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000012002',
   'authenticated', 'authenticated', 'prueba012-campo2@ejemplo.invalid', '', now(),
   '{"provider": "email", "providers": ["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000012003',
   'authenticated', 'authenticated', 'prueba012-admin@ejemplo.invalid', '', now(),
   '{"provider": "email", "providers": ["email"], "rol": "admin"}', '{}', now(), now());

insert into public.competidores (nombre, activo, orden) values
  ('PRUEBA 012 TA (se deshace)', true, 991),
  ('PRUEBA 012 TB (se deshace)', true, 992),
  ('PRUEBA 012 TI inactiva (se deshace)', false, 993);

create temp table t on commit drop as
select (select id from public.competidores where nombre = 'PRUEBA 012 TA (se deshace)') as ta,
       (select id from public.competidores where nombre = 'PRUEBA 012 TB (se deshace)') as tb,
       (select id from public.competidores where nombre = 'PRUEBA 012 TI inactiva (se deshace)') as ti;

insert into public.visitas (id, competidor_id, latitud, longitud, usuario_id)
select v.id::uuid, (select ta from t), 19.0, -99.0, v.usuario::uuid
from (values
        ('00000000-0000-4000-8000-000000012011', '00000000-0000-4000-8000-000000012001'),  -- V1
        ('00000000-0000-4000-8000-000000012012', '00000000-0000-4000-8000-000000012001'),  -- VF
        ('00000000-0000-4000-8000-000000012013', '00000000-0000-4000-8000-000000012001'),  -- VD
        ('00000000-0000-4000-8000-000000012014', '00000000-0000-4000-8000-000000012002'),  -- V2
        ('00000000-0000-4000-8000-000000012015', '00000000-0000-4000-8000-000000012001')   -- VE
     ) as v(id, usuario);

insert into public.fotos (id, visita_id, ruta, estado_proceso, subida_por) values
  ('00000000-0000-4000-8000-000000012021', '00000000-0000-4000-8000-000000012011',
   'visitas/00000000-0000-4000-8000-000000012011/00000000-0000-4000-8000-000000012021.jpg',
   'pendiente', '00000000-0000-4000-8000-000000012001'),
  ('00000000-0000-4000-8000-000000012022', '00000000-0000-4000-8000-000000012012',
   'visitas/00000000-0000-4000-8000-000000012012/00000000-0000-4000-8000-000000012022.jpg',
   'procesada', '00000000-0000-4000-8000-000000012001'),
  ('00000000-0000-4000-8000-000000012023', '00000000-0000-4000-8000-000000012013',
   'visitas/00000000-0000-4000-8000-000000012013/00000000-0000-4000-8000-000000012023.jpg',
   'pendiente', '00000000-0000-4000-8000-000000012001');

insert into public.capturas_manuales (id, visita_id, usuario_id, articulo, precio_regular) values
  ('00000000-0000-4000-8000-000000012031', '00000000-0000-4000-8000-000000012011',
   '00000000-0000-4000-8000-000000012001', 'K1 prueba', 10),
  ('00000000-0000-4000-8000-000000012032', '00000000-0000-4000-8000-000000012011',
   '00000000-0000-4000-8000-000000012001', 'K1b prueba', 11),
  ('00000000-0000-4000-8000-000000012033', '00000000-0000-4000-8000-000000012013',
   '00000000-0000-4000-8000-000000012001', 'KD prueba', 12),
  ('00000000-0000-4000-8000-000000012034', '00000000-0000-4000-8000-000000012014',
   '00000000-0000-4000-8000-000000012002', 'K2 prueba', 13);


-- -----------------------------------------------------------------------------
-- 2. Casos.
-- -----------------------------------------------------------------------------
do $$
declare
  jwt_c1 constant text := '{"sub": "00000000-0000-4000-8000-000000012001", "role": "authenticated",
    "app_metadata": {"provider": "email", "providers": ["email"]}, "user_metadata": {}}';
  jwt_c2 constant text := '{"sub": "00000000-0000-4000-8000-000000012002", "role": "authenticated",
    "app_metadata": {"provider": "email", "providers": ["email"]}, "user_metadata": {}}';
  jwt_ad constant text := '{"sub": "00000000-0000-4000-8000-000000012003", "role": "authenticated",
    "app_metadata": {"provider": "email", "providers": ["email"], "rol": "admin"}, "user_metadata": {}}';
  jwt_anon constant text := '{"role": "anon"}';

  c1 constant uuid := '00000000-0000-4000-8000-000000012001';
  c2 constant uuid := '00000000-0000-4000-8000-000000012002';
  ad constant uuid := '00000000-0000-4000-8000-000000012003';
  v1 constant uuid := '00000000-0000-4000-8000-000000012011';
  vf constant uuid := '00000000-0000-4000-8000-000000012012';
  vd constant uuid := '00000000-0000-4000-8000-000000012013';
  v2 constant uuid := '00000000-0000-4000-8000-000000012014';
  ve constant uuid := '00000000-0000-4000-8000-000000012015';
  f_pend constant uuid := '00000000-0000-4000-8000-000000012021';
  f_leida constant uuid := '00000000-0000-4000-8000-000000012022';
  k1  constant uuid := '00000000-0000-4000-8000-000000012031';
  k1b constant uuid := '00000000-0000-4000-8000-000000012032';
  kd  constant uuid := '00000000-0000-4000-8000-000000012033';
  k2  constant uuid := '00000000-0000-4000-8000-000000012034';
  hora_falsa constant timestamptz := '2000-01-01 00:00:00+00';
  ta bigint := (select t.ta from t);
  tb bigint := (select t.tb from t);
  ti bigint := (select t.ti from t);

  v_obt  text;
  v_n    int;
  v_hora timestamptz;
  v_rol_editor constant text := current_user;
begin
  -- ===== PRODUCTOS: EL DUEÑO EDITA LO SUYO ==================================
  -- 1. C1 edita K1 (un solo UPDATE con los 5 campos) → 1 fila; se guarda quién y cuándo.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    with cambiadas as (
      update public.capturas_manuales
      set articulo = 'K1 corregido', articulo_de_lista = true, precio_regular = 20.5,
          promo_precio_pieza = 18, observaciones = '2x36'
      where id = k1 returning id
    ) select count(*) into v_n from cambiadas;
    reset role;
    select format('%s fila; %s %s %s %s %s; editó %s; hora %s', v_n, articulo, articulo_de_lista::text,
                  trim_scale(precio_regular), trim_scale(promo_precio_pieza), observaciones,
                  case when actualizado_por = c1 then 'C1' else coalesce(actualizado_por::text, 'nadie') end,
                  case when actualizado_at = now() then 'del servidor' else 'otra' end)
      into v_obt from public.capturas_manuales where id = k1;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(1, 'C1 edita su producto (un UPDATE); actualizado_por/at los pone el servidor',
    '1 fila; K1 corregido true 20.5 18 2x36; editó C1; hora del servidor', v_obt);

  -- 2–6. Columnas que nadie cambia desde la app.
  declare
    casos constant text[][] := array[
      array['2', 'actualizado_por (falsear quién editó)', $q$actualizado_por = '00000000-0000-4000-8000-000000012002'$q$],
      array['3', 'actualizado_at',                        $q$actualizado_at = '2000-01-01'$q$],
      array['4', 'usuario_id',                            $q$usuario_id = '00000000-0000-4000-8000-000000012002'$q$],
      array['5', 'visita_id',                             $q$visita_id = '00000000-0000-4000-8000-000000012015'$q$],
      array['6', 'created_at',                            $q$created_at = '2000-01-01'$q$]
    ];
    i int;
  begin
    for i in 1 .. array_length(casos, 1) loop
      begin
        perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
        execute format('update public.capturas_manuales set %s where id = %L', casos[i][3], k1);
        reset role;
        v_obt := 'cambiado';
      exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
      end;
      perform pg_temp.anotar(casos[i][1]::int, 'C1 NO cambia ' || casos[i][2] || ' de su producto',
                             'rechazado (sin permiso)', v_obt);
    end loop;
  end;

  -- ===== PRODUCTOS: OTRA PERSONA NO TOCA LO AJENO ============================
  -- 7. C2 edita K1 → 0 filas.
  begin
    perform set_config('request.jwt.claims', jwt_c2, true); set local role authenticated;
    with cambiadas as (update public.capturas_manuales set precio_regular = 1 where id = k1 returning id)
    select count(*) into v_n from cambiadas;
    reset role;
    v_obt := format('%s filas', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(7, 'C2 NO edita el producto de C1', '0 filas', v_obt);

  -- 8. C2 borra K1 → 0 filas.
  begin
    perform set_config('request.jwt.claims', jwt_c2, true); set local role authenticated;
    with cambiadas as (update public.capturas_manuales set descartada_at = now() where id = k1 returning id)
    select count(*) into v_n from cambiadas;
    reset role;
    v_obt := format('%s filas', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(8, 'C2 NO borra el producto de C1', '0 filas', v_obt);

  -- ===== PRODUCTOS: BORRAR = DESCARTAR =======================================
  -- 9. Borrar y cambiar el contenido en la misma operación → rechazado.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    update public.capturas_manuales set descartada_at = now(), precio_regular = 1 where id = k1;
    reset role;
    v_obt := 'aceptado';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(9, 'Al borrar NO se cambia el contenido en la misma operación', 'rechazado (trigger)', v_obt);

  -- 10. C1 borra K1b con una hora falsa (como la app: update … returning id).
  -- En la MISMA operación la fila sí se devuelve; la hora la pone el servidor.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    with cambiadas as (
      update public.capturas_manuales set descartada_at = hora_falsa where id = k1b returning id
    ) select count(*) into v_n from cambiadas;
    reset role;
    select descartada_at into v_hora from public.capturas_manuales where id = k1b;
    v_obt := format('%s fila, hora %s', v_n,
                    case when v_hora = hora_falsa then 'FALSA' when v_hora = now() then 'del servidor' else 'otra' end);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(10, 'C1 borra su producto (descartada_at); la hora la pone el servidor',
                         '1 fila, hora del servidor', v_obt);

  perform pg_temp.otra_peticion();

  -- 11. En la siguiente petición, C1 ya no ve K1b (ni en la lista ni en el conteo).
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    select count(*) into v_n from public.capturas_manuales where visita_id = v1;
    reset role;
    v_obt := format('ve %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(11, 'C1 ya no ve su producto borrado (solo K1 en V1)', 've 1', v_obt);

  -- 12. C1 NO edita una fila borrada → 0 filas.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    with cambiadas as (update public.capturas_manuales set precio_regular = 5 where id = k1b returning id)
    select count(*) into v_n from cambiadas;
    reset role;
    v_obt := format('%s filas', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(12, 'C1 NO edita su producto ya borrado', '0 filas', v_obt);

  -- 13. C1 NO restaura → 0 filas.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    with cambiadas as (update public.capturas_manuales set descartada_at = null where id = k1b returning id)
    select count(*) into v_n from cambiadas;
    reset role;
    v_obt := format('%s filas', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(13, 'C1 NO restaura su producto borrado', '0 filas', v_obt);

  -- ===== PRODUCTOS: ADMIN ====================================================
  -- 14. El admin ve el producto borrado.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    select count(*) into v_n from public.capturas_manuales where id = k1b and descartada_at is not null;
    reset role;
    v_obt := format('ve %s borrado', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(14, 'El admin ve los productos borrados', 've 1 borrado', v_obt);

  -- 15. El admin edita el producto de C2 → 1 fila; queda a nombre del admin.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    with cambiadas as (update public.capturas_manuales set precio_regular = 14 where id = k2 returning id)
    select count(*) into v_n from cambiadas;
    reset role;
    select format('%s fila; editó %s', v_n, case when actualizado_por = ad then 'admin' else 'otro' end)
      into v_obt from public.capturas_manuales where id = k2;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(15, 'El admin edita el producto de otra persona', '1 fila; editó admin', v_obt);

  -- 16. El admin borra el producto de C2 → 1 fila.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    with cambiadas as (update public.capturas_manuales set descartada_at = now() where id = k2 returning id)
    select count(*) into v_n from cambiadas;
    reset role;
    v_obt := format('%s fila', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(16, 'El admin borra el producto de otra persona', '1 fila', v_obt);

  -- 17. Volver a "borrar" con otra hora NO cambia la hora original.
  begin
    select descartada_at into v_hora from public.capturas_manuales where id = k2;
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    update public.capturas_manuales set descartada_at = hora_falsa where id = k2;
    reset role;
    select case when descartada_at = v_hora then 'se conserva' else 'cambió' end into v_obt
    from public.capturas_manuales where id = k2;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(17, 'No se falsea descartada_at de una fila ya borrada', 'se conserva', v_obt);

  -- 18. El admin restaura K1b → 1 fila; C1 la vuelve a ver.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    with cambiadas as (update public.capturas_manuales set descartada_at = null where id = k1b returning id)
    select count(*) into v_n from cambiadas;
    perform set_config('request.jwt.claims', jwt_c1, true);
    select format('%s fila; C1 ve %s', v_n, count(*)) into v_obt
    from public.capturas_manuales where id = k1b;
    reset role;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(18, 'El admin restaura; el dueño la vuelve a ver', '1 fila; C1 ve 1', v_obt);

  -- 19. Nadie hace DELETE (ni el dueño ni el admin).
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    delete from public.capturas_manuales where id = k1;
    reset role;
    v_obt := 'borrado físico';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    delete from public.capturas_manuales where id = k2;
    reset role;
    v_obt := v_obt || '; admin: borrado físico';
  exception when others then v_obt := v_obt || '; admin: ' || pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(19, 'authenticated NO hace DELETE de productos (dueño ni admin)',
    'rechazado (sin permiso); admin: rechazado (sin permiso)', v_obt);

  -- ===== VISITAS: CAMBIAR LA TIENDA ==========================================
  -- 20. C1 cambia la tienda de V1 (sin fotos leídas) a otra activa → 1 fila.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    with cambiadas as (update public.visitas set competidor_id = tb where id = v1 returning id)
    select count(*) into v_n from cambiadas;
    reset role;
    v_obt := format('%s fila', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(20, 'C1 cambia la tienda de su visita (sin fotos leídas)', '1 fila', v_obt);

  -- 21. A una tienda inactiva → rechazado.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    update public.visitas set competidor_id = ti where id = v1;
    reset role;
    v_obt := 'aceptado';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(21, 'La tienda nueva debe estar activa', 'rechazado (trigger)', v_obt);

  -- 22. Visita con una foto YA LEÍDA: C1 no cambia la tienda → 0 filas.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    with cambiadas as (update public.visitas set competidor_id = tb where id = vf returning id)
    select count(*) into v_n from cambiadas;
    reset role;
    v_obt := format('%s filas', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(22, 'C1 NO cambia la tienda de una visita con fotos leídas', '0 filas', v_obt);

  -- 23. …ni la borra → 0 filas.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    with cambiadas as (update public.visitas set descartada_at = now() where id = vf returning id)
    select count(*) into v_n from cambiadas;
    reset role;
    v_obt := format('%s filas', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(23, 'C1 NO borra una visita con fotos leídas', '0 filas', v_obt);

  -- 24. C2 no cambia la tienda ni borra la visita de C1 → 0 filas.
  begin
    perform set_config('request.jwt.claims', jwt_c2, true); set local role authenticated;
    with cambiadas as (update public.visitas set competidor_id = ta where id = v1 returning id)
    select count(*) into v_n from cambiadas;
    v_obt := format('tienda %s filas', v_n);
    with cambiadas as (update public.visitas set descartada_at = now() where id = v1 returning id)
    select count(*) into v_n from cambiadas;
    reset role;
    v_obt := v_obt || format('; borrar %s filas', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(24, 'C2 NO cambia la tienda ni borra la visita de C1', 'tienda 0 filas; borrar 0 filas', v_obt);

  -- 25–28. Columnas de la visita que nadie cambia desde la app.
  declare
    casos constant text[][] := array[
      array['25', 'usuario_id', $q$usuario_id = '00000000-0000-4000-8000-000000012002'$q$],
      array['26', 'la ubicación (latitud)', $q$latitud = 20$q$],
      array['27', 'created_at', $q$created_at = '2000-01-01'$q$],
      array['28', 'la hora de ubicación', $q$ubicacion_at = '2000-01-01'$q$]
    ];
    i int;
  begin
    for i in 1 .. array_length(casos, 1) loop
      begin
        perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
        execute format('update public.visitas set %s where id = %L', casos[i][3], v1);
        reset role;
        v_obt := 'cambiado';
      exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
      end;
      perform pg_temp.anotar(casos[i][1]::int, 'C1 NO cambia ' || casos[i][2] || ' de su visita',
                             'rechazado (sin permiso)', v_obt);
    end loop;
  end;

  -- ===== VISITAS: BORRAR =====================================================
  -- 29. Borrar y cambiar la tienda en la misma operación → rechazado.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    update public.visitas set descartada_at = now(), competidor_id = tb where id = ve;
    reset role;
    v_obt := 'aceptado';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(29, 'Al borrar una visita NO se cambia la tienda en la misma operación', 'rechazado (trigger)', v_obt);

  -- 30. C1 borra VD con hora falsa → 1 fila; la hora la pone el servidor.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    with cambiadas as (update public.visitas set descartada_at = hora_falsa where id = vd returning id)
    select count(*) into v_n from cambiadas;
    reset role;
    select descartada_at into v_hora from public.visitas where id = vd;
    v_obt := format('%s fila, hora %s', v_n,
                    case when v_hora = hora_falsa then 'FALSA' when v_hora = now() then 'del servidor' else 'otra' end);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(30, 'C1 borra su visita (sin fotos leídas); hora del servidor', '1 fila, hora del servidor', v_obt);

  perform pg_temp.otra_peticion();

  -- 31. C1 ya no ve la visita borrada, ni sus fotos, ni sus productos.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    select format('visita %s; fotos %s; productos %s',
                  (select count(*) from public.visitas where id = vd),
                  (select count(*) from public.fotos where visita_id = vd),
                  (select count(*) from public.capturas_manuales where visita_id = vd))
      into v_obt;
    reset role;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(31, 'C1 NO ve su visita borrada ni sus fotos ni sus productos',
                         'visita 0; fotos 0; productos 0', v_obt);

  -- 32. En su lista de visitas no cuenta (la ve sin VD).
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    select count(*) into v_n from public.visitas where id in (v1, vf, vd, ve);
    reset role;
    v_obt := format('ve %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(32, 'La visita borrada no aparece en la lista ni en el conteo de C1', 've 3', v_obt);

  -- 33. C1 no escribe productos ni registra fotos en su visita borrada.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into public.capturas_manuales (visita_id, articulo, precio_regular) values (vd, 'En borrada', 1);
    reset role;
    v_obt := 'producto creado';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into public.fotos (visita_id, ruta)
    values (vd, 'visitas/00000000-0000-4000-8000-000000012013/00000000-0000-4000-8000-000000012029.jpg');
    reset role;
    v_obt := v_obt || '; foto creada';
  exception when others then v_obt := v_obt || '; ' || pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(33, 'C1 NO escribe productos ni fotos en su visita borrada',
                         'rechazado (regla RLS); rechazado (regla RLS)', v_obt);

  -- 34. C1 no restaura su visita → 0 filas.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    with cambiadas as (update public.visitas set descartada_at = null where id = vd returning id)
    select count(*) into v_n from cambiadas;
    reset role;
    v_obt := format('%s filas', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(34, 'C1 NO restaura su visita borrada', '0 filas', v_obt);

  -- 35. El admin ve la visita borrada, sus fotos y sus productos.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    select format('visita %s; fotos %s; productos %s',
                  (select count(*) from public.visitas where id = vd and descartada_at is not null),
                  (select count(*) from public.fotos where visita_id = vd),
                  (select count(*) from public.capturas_manuales where visita_id = vd))
      into v_obt;
    reset role;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(35, 'El admin ve la visita borrada con sus fotos y productos',
                         'visita 1; fotos 1; productos 1', v_obt);

  -- 36. El admin restaura la visita → 1 fila; C1 la vuelve a ver con su producto.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    with cambiadas as (update public.visitas set descartada_at = null where id = vd returning id)
    select count(*) into v_n from cambiadas;
    perform set_config('request.jwt.claims', jwt_c1, true);
    select format('%s fila; C1 ve visita %s y productos %s', v_n,
                  (select count(*) from public.visitas where id = vd),
                  (select count(*) from public.capturas_manuales where visita_id = vd))
      into v_obt;
    reset role;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(36, 'El admin restaura la visita; el dueño la vuelve a ver completa',
                         '1 fila; C1 ve visita 1 y productos 1', v_obt);

  -- 37. El admin cambia la tienda de una visita con fotos leídas (él sí puede).
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    with cambiadas as (update public.visitas set competidor_id = tb where id = vf returning id)
    select count(*) into v_n from cambiadas;
    reset role;
    v_obt := format('%s fila', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(37, 'El admin cambia la tienda aunque haya fotos leídas', '1 fila', v_obt);

  -- 38. El admin tampoco elige una tienda inactiva.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    update public.visitas set competidor_id = ti where id = v2;
    reset role;
    v_obt := 'aceptado';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(38, 'El admin tampoco elige una tienda inactiva', 'rechazado (trigger)', v_obt);

  -- 39. El admin borra la visita de C2 → 1 fila.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    with cambiadas as (update public.visitas set descartada_at = now() where id = v2 returning id)
    select count(*) into v_n from cambiadas;
    reset role;
    v_obt := format('%s fila', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(39, 'El admin borra la visita de otra persona', '1 fila', v_obt);

  -- 40. Nadie hace DELETE de visitas.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    delete from public.visitas where id = ve;
    reset role;
    v_obt := 'borrada físicamente';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(40, 'authenticated NO hace DELETE de visitas', 'rechazado (sin permiso)', v_obt);

  -- ===== FOTOS ===============================================================
  -- 41. C1 sigue quitando una foto pendiente de su visita.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    with cambiadas as (update public.fotos set descartada_at = now() where id = f_pend returning id)
    select count(*) into v_n from cambiadas;
    reset role;
    v_obt := format('%s fila', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(41, 'C1 sigue quitando fotos pendientes de su visita', '1 fila', v_obt);

  -- 42. C1 NO quita una foto ya leída.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    with cambiadas as (update public.fotos set descartada_at = now() where id = f_leida returning id)
    select count(*) into v_n from cambiadas;
    reset role;
    v_obt := format('%s filas', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(42, 'C1 NO quita una foto ya leída', '0 filas', v_obt);

  -- 43. El admin quita la foto leída y la restaura.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    with cambiadas as (update public.fotos set descartada_at = now() where id = f_leida returning id)
    select count(*) into v_n from cambiadas;
    v_obt := format('quita %s', v_n);
    with cambiadas as (update public.fotos set descartada_at = null where id = f_leida returning id)
    select count(*) into v_n from cambiadas;
    reset role;
    v_obt := v_obt || format('; restaura %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(43, 'El admin quita y restaura cualquier foto (también leída)', 'quita 1; restaura 1', v_obt);

  -- ===== ANON ================================================================
  -- 44. anon no ve visitas, fotos ni productos.
  begin
    perform set_config('request.jwt.claims', jwt_anon, true); set local role anon;
    select count(*) into v_n from public.visitas;
    reset role;
    v_obt := format('ve %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  begin
    perform set_config('request.jwt.claims', jwt_anon, true); set local role anon;
    select count(*) into v_n from public.capturas_manuales;
    reset role;
    v_obt := v_obt || format('; ve %s', v_n);
  exception when others then v_obt := v_obt || '; ' || pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  begin
    perform set_config('request.jwt.claims', jwt_anon, true); set local role anon;
    select count(*) into v_n from public.fotos;
    reset role;
    v_obt := v_obt || format('; ve %s', v_n);
  exception when others then v_obt := v_obt || '; ' || pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(44, 'anon NO ve visitas, productos ni fotos',
    'rechazado (sin permiso); rechazado (sin permiso); rechazado (sin permiso)', v_obt);

  -- 45. anon no edita ni borra.
  begin
    perform set_config('request.jwt.claims', jwt_anon, true); set local role anon;
    update public.capturas_manuales set descartada_at = now() where id = k1;
    reset role;
    v_obt := 'cambiado';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(45, 'anon NO edita ni borra productos', 'rechazado (sin permiso)', v_obt);

  -- 46. Después de "reset role" se vuelve al rol del SQL Editor.
  v_obt := case when current_user = v_rol_editor then 'mismo rol' else 'otro rol: ' || current_user end;
  perform pg_temp.anotar(46, 'Después de "reset role" se vuelve al rol del SQL Editor', 'mismo rol', v_obt);
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. Resultado visible (todas las filas deben tener ok = true).
-- -----------------------------------------------------------------------------
insert into prueba_resultado
select 47, 'Ningún caso dio "infinite recursion"', 'ninguno',
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
       count(*) >= 47 and count(*) filter (where ok is not true) = 0
from prueba_resultado;

select n, caso, esperado, obtenido, ok from prueba_resultado order by n;

-- Deshace TODO.
rollback;
