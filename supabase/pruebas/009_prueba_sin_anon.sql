-- =============================================================================
-- pruebas/009_prueba_sin_anon.sql — Prueba de la migración B (sin sesión, nada)
-- =============================================================================
-- NO es una migración: es una PRUEBA que NO deja nada en la base.
-- Ejecútala DESPUÉS de 009_cerrar_anon.sql. (Antes de 009 los casos de anon
-- fallan a propósito: anon todavía puede leer.)
--
-- Cómo usarla: copia TODO este archivo en Supabase → SQL Editor → Run.
--   - begin … rollback: el usuario, la visita, la foto y el archivo de prueba se
--     crean, se prueban y se deshacen. Siempre termina con rollback.
--   - "Como anon" = set local role anon (lo mismo que la llave pública sin
--     login). "Como C1" = set local role authenticated + su JWT.
--   - Al final sale una tabla con todos los casos y una fila "0. RESUMEN".
--     Busca ok = true en todas las filas.
--   - Para revisar a fondo lo que puede hacer cada cuenta, corre también
--     pruebas/008_prueba_autenticacion.sql (sigue valiendo después de 009).
-- =============================================================================

begin;

create temp table prueba_resultado (
  n int, caso text, esperado text, obtenido text, ok boolean
) on commit drop;

create function pg_temp.error_texto(p_estado text, p_mensaje text) returns text language sql as $$
  select case
    when p_mensaje like 'new row violates row-level security policy%'
      then 'rechazado (regla RLS de ' || coalesce(substring(p_mensaje from 'for table "([^"]+)"'), '?') || ')'
    when p_estado = '42501' then 'rechazado (sin permiso)'
    else 'otro error: ' || p_mensaje
  end;
$$;

create function pg_temp.anotar(p_n int, p_caso text, p_esperado text, p_obtenido text)
returns void language sql as $$
  insert into pg_temp.prueba_resultado
  values (p_n, p_caso, p_esperado, coalesce(p_obtenido, '(vacío)'), p_obtenido = p_esperado);
$$;


-- -----------------------------------------------------------------------------
-- 1. Datos inventados: una cuenta de campo (C1), una tienda, una visita de C1,
-- una foto y su archivo (solo la fila de Storage; no hay archivo real).
-- -----------------------------------------------------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000901',
   'authenticated', 'authenticated', 'prueba009-campo1@ejemplo.invalid', '', now(),
   '{"provider": "email", "providers": ["email"]}', '{}', now(), now());

insert into public.competidores (nombre, activo, orden)
values ('PRUEBA 009 activa (se deshace)', true, 999);

insert into public.visitas (id, competidor_id, latitud, longitud, usuario_id)
select '00000000-0000-4000-8000-000000000911', id, 19.0, -99.0, '00000000-0000-4000-8000-000000000901'
from public.competidores where nombre = 'PRUEBA 009 activa (se deshace)';

insert into public.fotos (id, visita_id, ruta)
values ('00000000-0000-4000-8000-000000000921', '00000000-0000-4000-8000-000000000911',
        'visitas/00000000-0000-4000-8000-000000000911/prueba-009.jpg');

create temp table prueba_storage (preparado boolean, detalle text) on commit drop;
do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('fotos', 'visitas/00000000-0000-4000-8000-000000000911/00000000-0000-4000-8000-000000000931.jpg');
  insert into prueba_storage values (true, null);
exception when others then
  insert into prueba_storage values (false, sqlerrm);
end;
$$;


-- -----------------------------------------------------------------------------
-- 2. Casos.
-- -----------------------------------------------------------------------------
do $$
declare
  jwt_anon constant text := '{"role": "anon"}';
  jwt_c1   constant text := '{"sub": "00000000-0000-4000-8000-000000000901", "role": "authenticated",
    "email": "prueba009-campo1@ejemplo.invalid",
    "app_metadata": {"provider": "email", "providers": ["email"]}, "user_metadata": {}}';
  v1      constant uuid := '00000000-0000-4000-8000-000000000911';
  archivo constant text := 'visitas/00000000-0000-4000-8000-000000000911/00000000-0000-4000-8000-000000000931.jpg';
  v_tienda bigint;
  v_n   int;
  v_obt text;
  v_storage boolean;
begin
  select id into v_tienda from public.competidores where nombre = 'PRUEBA 009 activa (se deshace)';
  select preparado into v_storage from prueba_storage;

  -- 1–3. anon NO lee ninguna de las 3 tablas.
  begin
    perform set_config('request.jwt.claims', jwt_anon, true); set local role anon;
    perform 1 from public.visitas limit 1;
    reset role;
    v_obt := 'LEYÓ';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(1, 'anon NO lee visitas', 'rechazado (sin permiso)', v_obt);

  begin
    perform set_config('request.jwt.claims', jwt_anon, true); set local role anon;
    perform 1 from public.fotos limit 1;
    reset role;
    v_obt := 'LEYÓ';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(2, 'anon NO lee fotos', 'rechazado (sin permiso)', v_obt);

  begin
    perform set_config('request.jwt.claims', jwt_anon, true); set local role anon;
    perform 1 from public.competidores limit 1;
    reset role;
    v_obt := 'LEYÓ';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(3, 'anon NO lee competidores', 'rechazado (sin permiso)', v_obt);

  -- 4. anon NO crea visitas.
  begin
    perform set_config('request.jwt.claims', jwt_anon, true); set local role anon;
    insert into public.visitas (competidor_id, latitud, longitud) values (v_tienda, 19.1, -99.1);
    reset role;
    v_obt := 'ACEPTADO';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(4, 'anon NO crea visitas', 'rechazado (sin permiso)', v_obt);

  -- 5. anon NO quita fotos.
  begin
    perform set_config('request.jwt.claims', jwt_anon, true); set local role anon;
    update public.fotos set descartada_at = now() where id = '00000000-0000-4000-8000-000000000921';
    reset role;
    v_obt := 'ACEPTADO';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(5, 'anon NO quita fotos', 'rechazado (sin permiso)', v_obt);

  -- 6. Bucket privado.
  select case when public then 'público' else 'privado' end into v_obt
  from storage.buckets where id = 'fotos';
  perform pg_temp.anotar(6, 'El bucket "fotos" es privado', 'privado', v_obt);

  if not v_storage then
    perform pg_temp.anotar(7, 'Storage: no se pudieron preparar archivos de prueba', 'preparado',
                           'otro error: ' || (select detalle from prueba_storage));
  else
    -- 7. anon NO ve archivos del bucket.
    begin
      perform set_config('request.jwt.claims', jwt_anon, true); set local role anon;
      select count(*) into v_n from storage.objects where bucket_id = 'fotos';
      reset role;
      v_obt := format('anon ve %s archivos', v_n);
    exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
    end;
    perform pg_temp.anotar(7, 'Storage: anon NO ve ningún archivo de "fotos"', 'anon ve 0 archivos', v_obt);

    -- 8. anon NO sube archivos.
    begin
      perform set_config('request.jwt.claims', jwt_anon, true); set local role anon;
      insert into storage.objects (bucket_id, name)
      values ('fotos', 'visitas/' || v1 || '/00000000-0000-4000-8000-000000000932.jpg');
      reset role;
      v_obt := 'ACEPTADO';
    exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
    end;
    perform pg_temp.anotar(8, 'Storage: anon NO sube archivos', 'rechazado (regla RLS de objects)', v_obt);

    -- 9. C1 (con sesión) sí ve el archivo de su visita.
    begin
      perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
      select count(*) into v_n from storage.objects where bucket_id = 'fotos' and name = archivo;
      reset role;
      v_obt := format('C1 ve %s', v_n);
    exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
    end;
    perform pg_temp.anotar(9, 'Storage: C1 (con sesión) sí ve el archivo de su visita', 'C1 ve 1', v_obt);
  end if;

  -- 10. anon NO usa es_admin.
  begin
    perform set_config('request.jwt.claims', jwt_anon, true); set local role anon;
    perform public.es_admin();
    reset role;
    v_obt := 'ACEPTADO';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(10, 'anon NO usa es_admin', 'rechazado (sin permiso)', v_obt);

  -- 11. C1 (con sesión) sigue viendo su visita y su foto.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    select count(*) into v_n from public.visitas where id = v1;
    v_obt := format('visitas %s', v_n);
    select count(*) into v_n from public.fotos where visita_id = v1;
    reset role;
    v_obt := v_obt || format('; fotos %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(11, 'C1 (con sesión) sigue viendo su visita y su foto', 'visitas 1; fotos 1', v_obt);

  -- 12. C1 (con sesión) sigue creando visitas.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into public.visitas (competidor_id, latitud, longitud) values (v_tienda, 19.1, -99.1);
    reset role;
    v_obt := 'aceptado';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(12, 'C1 (con sesión) sigue creando visitas', 'aceptado', v_obt);
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. Resultado visible (todas las filas deben tener ok = true).
-- -----------------------------------------------------------------------------
insert into prueba_resultado
select 0, 'RESUMEN',
       '12 casos con ok = true',
       case when count(*) filter (where ok is not true) = 0
            then 'TODO PASÓ (' || count(*) || ' casos). No se guardó nada.'
            else count(*) filter (where ok is not true) || ' caso(s) FALLARON: '
                 || string_agg(n::text, ', ' order by n) filter (where ok is not true)
       end,
       count(*) = 12 and count(*) filter (where ok is not true) = 0
from prueba_resultado;

select n, caso, esperado, obtenido, ok from prueba_resultado order by n;

-- Deshace TODO.
rollback;
