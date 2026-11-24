-- =============================================================================
-- pruebas/008_prueba_autenticacion.sql — Prueba de login y dueño de visitas (A)
-- =============================================================================
-- NO es una migración: es una PRUEBA que NO deja nada en la base.
-- Ejecútala DESPUÉS de 008_autenticacion.sql Y DE 008b_romper_ciclo_rls.sql
-- (y ANTES o DESPUÉS de 009: los casos 40–41, "anon sigue funcionando", solo
-- aplican ANTES de 009; después de 009 usa también pruebas/009_prueba_sin_anon.sql).
-- Sin 008b fallan los casos 6–8, 42–56 y 57 con "infinite recursion".
--
-- Casos 42–56 (agregados con 008b): el FLUJO REAL DE LA APP. Cada persona (C1
-- de campo y el admin) crea su visita CON SUS REGLAS (insert … returning), la
-- abre, sube el archivo a Storage, registra la foto, la ve y la quita; y otra
-- cuenta de campo intenta lo mismo en esa visita (no debe poder).
--
-- Cómo usarla: copia TODO este archivo en Supabase → SQL Editor → Run.
--   - Todo va dentro de una transacción (begin … rollback): los usuarios, la
--     tienda, las visitas, las fotos y los archivos de prueba se crean, se
--     prueban y al final se DESHACE todo. Siempre termina con rollback.
--   - USUARIOS DE PRUEBA: se insertan directo en auth.users DENTRO de la
--     transacción (el SQL Editor sí puede). Correos @ejemplo.invalid (un
--     dominio que no existe). Con el rollback desaparecen; nunca reciben correo.
--     Si este paso falla con "permission denied for table users", avísale al
--     responsable: quiere decir que Supabase ya no deja crearlos así.
--   - SIMULAR A UNA PERSONA: "set local role authenticated" + el JWT (claims)
--     en request.jwt.claims, que es justo lo que hace Supabase con cada
--     consulta de la app. auth.uid() y es_admin() leen de ahí.
--   - Cada caso atrapa su propio error: la prueba no se detiene a la mitad. Al
--     final sale una tabla con TODOS los casos y una fila "0. RESUMEN". Busca
--     ok = true en todas las filas.
--
-- Datos (TODOS inventados):
--   Personas: C1 = campo 1, C2 = campo 2 (se puso "rol: admin" en su
--             user_metadata, como si lo hubiera hecho ella misma), AD = admin
--             (rol admin en app_metadata).
--   Tiendas:  "PRUEBA 008 activa", "PRUEBA 008 inactiva usada" (solo la usa una
--             visita de C1), "PRUEBA 008 inactiva sin usar".
--   Visitas:  V1 y V1b de C1 · V2 de C2 · V0 sin dueño (como las de antes).
--   Fotos:    F1p y F1q (V1, pendientes) · F1L (V1, procesada) ·
--             F2p (V2, pendiente) · F0p (V0, pendiente) · F0d (V0, quitada).
--   Storage:  un archivo en la carpeta de V1, otro en V2 y otro en V0.
-- =============================================================================

begin;

create temp table prueba_resultado (
  n int, caso text, esperado text, obtenido text, ok boolean
) on commit drop;

-- Nombre corto de cada id de prueba, para que el resultado se lea fácil.
create temp table prueba_nombres (id uuid primary key, nombre text) on commit drop;
insert into prueba_nombres values
  ('00000000-0000-4000-8000-000000000811', 'V1'),
  ('00000000-0000-4000-8000-000000000812', 'V1b'),
  ('00000000-0000-4000-8000-000000000813', 'V2'),
  ('00000000-0000-4000-8000-000000000814', 'V0'),
  ('00000000-0000-4000-8000-000000000821', 'F1p'),
  ('00000000-0000-4000-8000-000000000822', 'F1q'),
  ('00000000-0000-4000-8000-000000000823', 'F1L'),
  ('00000000-0000-4000-8000-000000000824', 'F2p'),
  ('00000000-0000-4000-8000-000000000825', 'F0p'),
  ('00000000-0000-4000-8000-000000000826', 'F0d');

-- Ayudantes (solo existen en esta sesión y se deshacen con el rollback).
-- nombres(): lista de ids → "V1, V1b" (o "ninguna").
create function pg_temp.nombres(p_ids uuid[]) returns text language sql as $$
  select coalesce(string_agg(n.nombre, ', ' order by n.nombre), 'ninguna')
  from pg_temp.prueba_nombres n where n.id = any (p_ids);
$$;

-- error_texto(): convierte un error en un texto corto y comparable.
create function pg_temp.error_texto(p_estado text, p_mensaje text) returns text language sql as $$
  select case
    when p_mensaje like 'new row violates row-level security policy%'
      then 'rechazado (regla RLS de ' || coalesce(substring(p_mensaje from 'for table "([^"]+)"'), '?') || ')'
    when p_mensaje like 'Solo el administrador%' then 'rechazado (solo admin)'
    when p_estado = '42501' then 'rechazado (sin permiso)'
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
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000801',
   'authenticated', 'authenticated', 'prueba008-campo1@ejemplo.invalid', '', now(),
   '{"provider": "email", "providers": ["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000802',
   'authenticated', 'authenticated', 'prueba008-campo2@ejemplo.invalid', '', now(),
   '{"provider": "email", "providers": ["email"]}', '{"rol": "admin"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000803',
   'authenticated', 'authenticated', 'prueba008-admin@ejemplo.invalid', '', now(),
   '{"provider": "email", "providers": ["email"], "rol": "admin"}', '{}', now(), now());

insert into public.competidores (nombre, activo, orden) values
  ('PRUEBA 008 activa (se deshace)', true, 997),
  ('PRUEBA 008 inactiva usada (se deshace)', false, 998),
  ('PRUEBA 008 inactiva sin usar (se deshace)', false, 999);

insert into public.visitas (id, competidor_id, latitud, longitud, usuario_id)
select v.id::uuid, c.id, 19.0, -99.0, v.usuario::uuid
from (values
        ('00000000-0000-4000-8000-000000000811', 'PRUEBA 008 activa (se deshace)',        '00000000-0000-4000-8000-000000000801'),
        ('00000000-0000-4000-8000-000000000812', 'PRUEBA 008 inactiva usada (se deshace)', '00000000-0000-4000-8000-000000000801'),
        ('00000000-0000-4000-8000-000000000813', 'PRUEBA 008 activa (se deshace)',        '00000000-0000-4000-8000-000000000802'),
        ('00000000-0000-4000-8000-000000000814', 'PRUEBA 008 activa (se deshace)',        null)
     ) as v(id, tienda, usuario)
join public.competidores c on c.nombre = v.tienda;

insert into public.fotos (id, visita_id, ruta, estado_proceso, descartada_at)
select f.id::uuid, f.visita::uuid,
       'visitas/' || f.visita || '/prueba-008-' || f.letra || '.jpg',
       f.estado, f.descartada
from (values
        ('00000000-0000-4000-8000-000000000821', '00000000-0000-4000-8000-000000000811', '1p', 'pendiente', null::timestamptz),
        ('00000000-0000-4000-8000-000000000822', '00000000-0000-4000-8000-000000000811', '1q', 'pendiente', null),
        ('00000000-0000-4000-8000-000000000823', '00000000-0000-4000-8000-000000000811', '1l', 'procesada', null),
        ('00000000-0000-4000-8000-000000000824', '00000000-0000-4000-8000-000000000813', '2p', 'pendiente', null),
        ('00000000-0000-4000-8000-000000000825', '00000000-0000-4000-8000-000000000814', '0p', 'pendiente', null),
        ('00000000-0000-4000-8000-000000000826', '00000000-0000-4000-8000-000000000814', '0d', 'pendiente', now())
     ) as f(id, visita, letra, estado, descartada);

-- Archivos de Storage de prueba (solo la fila; no hay archivo real). Si Supabase
-- no deja crearlos, los casos de Storage lo dicen y el resto de la prueba sigue.
create temp table prueba_storage (preparado boolean, detalle text) on commit drop;
do $$
begin
  insert into storage.objects (bucket_id, name) values
    ('fotos', 'visitas/00000000-0000-4000-8000-000000000811/00000000-0000-4000-8000-000000000831.jpg'),
    ('fotos', 'visitas/00000000-0000-4000-8000-000000000813/00000000-0000-4000-8000-000000000832.jpg'),
    ('fotos', 'visitas/00000000-0000-4000-8000-000000000814/00000000-0000-4000-8000-000000000833.jpg');
  insert into prueba_storage values (true, null);
exception when others then
  insert into prueba_storage values (false, sqlerrm);
end;
$$;


-- -----------------------------------------------------------------------------
-- 2. Casos. "Como C1" = set_config(JWT de C1) + set local role authenticated.
-- Si el bloque falla, Postgres deshace ese bloque (incluido el cambio de rol) y
-- se anota el error; si no falla, "reset role" vuelve al SQL Editor.
-- -----------------------------------------------------------------------------
do $$
declare
  -- JWT de cada persona (lo que Supabase pone en cada consulta de la app).
  jwt_c1 constant text := '{"sub": "00000000-0000-4000-8000-000000000801", "role": "authenticated",
    "email": "prueba008-campo1@ejemplo.invalid",
    "app_metadata": {"provider": "email", "providers": ["email"]}, "user_metadata": {}}';
  jwt_c2 constant text := '{"sub": "00000000-0000-4000-8000-000000000802", "role": "authenticated",
    "email": "prueba008-campo2@ejemplo.invalid",
    "app_metadata": {"provider": "email", "providers": ["email"]}, "user_metadata": {"rol": "admin"}}';
  jwt_ad constant text := '{"sub": "00000000-0000-4000-8000-000000000803", "role": "authenticated",
    "email": "prueba008-admin@ejemplo.invalid",
    "app_metadata": {"provider": "email", "providers": ["email"], "rol": "admin"}, "user_metadata": {}}';
  jwt_anon constant text := '{"role": "anon"}';

  c1 constant uuid := '00000000-0000-4000-8000-000000000801';
  c2 constant uuid := '00000000-0000-4000-8000-000000000802';
  ad constant uuid := '00000000-0000-4000-8000-000000000803';
  v1  constant uuid := '00000000-0000-4000-8000-000000000811';
  v2  constant uuid := '00000000-0000-4000-8000-000000000813';
  v0  constant uuid := '00000000-0000-4000-8000-000000000814';
  f1p constant uuid := '00000000-0000-4000-8000-000000000821';
  f1q constant uuid := '00000000-0000-4000-8000-000000000822';
  f1l constant uuid := '00000000-0000-4000-8000-000000000823';
  f2p constant uuid := '00000000-0000-4000-8000-000000000824';
  f0p constant uuid := '00000000-0000-4000-8000-000000000825';
  f0d constant uuid := '00000000-0000-4000-8000-000000000826';
  visitas_prueba constant uuid[] := array[
    '00000000-0000-4000-8000-000000000811', '00000000-0000-4000-8000-000000000812',
    '00000000-0000-4000-8000-000000000813', '00000000-0000-4000-8000-000000000814']::uuid[];
  fotos_prueba constant uuid[] := array[
    '00000000-0000-4000-8000-000000000821', '00000000-0000-4000-8000-000000000822',
    '00000000-0000-4000-8000-000000000823', '00000000-0000-4000-8000-000000000824',
    '00000000-0000-4000-8000-000000000825', '00000000-0000-4000-8000-000000000826']::uuid[];
  archivos_prueba constant text[] := array[
    'visitas/00000000-0000-4000-8000-000000000811/00000000-0000-4000-8000-000000000831.jpg',
    'visitas/00000000-0000-4000-8000-000000000813/00000000-0000-4000-8000-000000000832.jpg',
    'visitas/00000000-0000-4000-8000-000000000814/00000000-0000-4000-8000-000000000833.jpg'];
  hora_falsa constant timestamptz := '2000-01-01 00:00:00+00';

  v_tienda_activa   bigint;
  v_tienda_inactiva bigint;
  v_ids  uuid[];
  v_obt  text;
  v_n    int;
  v_b    boolean;
  v_uuid uuid;
  v_hora timestamptz;
  v_storage boolean;
  -- Flujo real de la app (casos 42–56): ids que crean las propias personas.
  v_nueva_c1 uuid;
  v_nueva_ad uuid;
  v_foto_c1a uuid;
  v_foto_c1b uuid;
  v_foto_ad  uuid;
  v_foto_ad2 uuid;
begin
  select id into v_tienda_activa   from public.competidores where nombre = 'PRUEBA 008 activa (se deshace)';
  select id into v_tienda_inactiva from public.competidores where nombre = 'PRUEBA 008 inactiva sin usar (se deshace)';
  select preparado into v_storage from prueba_storage;

  -- ===== VER VISITAS =========================================================
  -- 1. C1 ve solo sus visitas.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    select array_agg(id) into v_ids from public.visitas where id = any (visitas_prueba);
    reset role;
    v_obt := pg_temp.nombres(v_ids);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(1, 'C1 ve solo sus visitas (no la de C2 ni la sin dueño)', 'V1, V1b', v_obt);

  -- 2. C2 ve solo la suya.
  begin
    perform set_config('request.jwt.claims', jwt_c2, true); set local role authenticated;
    select array_agg(id) into v_ids from public.visitas where id = any (visitas_prueba);
    reset role;
    v_obt := pg_temp.nombres(v_ids);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(2, 'C2 ve solo su visita', 'V2', v_obt);

  -- 3. El admin ve todas, también la sin dueño.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    select array_agg(id) into v_ids from public.visitas where id = any (visitas_prueba);
    reset role;
    v_obt := pg_temp.nombres(v_ids);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(3, 'El admin ve todas (también V0, sin dueño)', 'V0, V1, V1b, V2', v_obt);

  -- 4. "rol: admin" en user_metadata NO da permisos de admin.
  begin
    perform set_config('request.jwt.claims', jwt_c2, true); set local role authenticated;
    v_b := public.es_admin();
    reset role;
    v_obt := case when v_b then 'ES admin' else 'no es admin' end;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(4, 'C2 con "rol: admin" en user_metadata NO es admin', 'no es admin', v_obt);

  -- 5. Y el admin de verdad sí lo es.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    v_b := public.es_admin();
    reset role;
    v_obt := case when v_b then 'ES admin' else 'no es admin' end;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(5, 'AD (rol admin en app_metadata) SÍ es admin', 'ES admin', v_obt);

  -- ===== CREAR Y CAMBIAR VISITAS ===============================================
  -- 6. C1 crea una visita sin mandar dueño → queda a su nombre.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into public.visitas (competidor_id, latitud, longitud)
    values (v_tienda_activa, 19.1, -99.1)
    returning usuario_id into v_uuid;
    reset role;
    v_obt := case when v_uuid = c1 then 'a nombre de C1' else 'a nombre de ' || coalesce(v_uuid::text, 'nadie') end;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(6, 'C1 crea una visita y queda a su nombre (default)', 'a nombre de C1', v_obt);

  -- 7. C1 intenta crear una visita a nombre de C2.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into public.visitas (competidor_id, latitud, longitud, usuario_id)
    values (v_tienda_activa, 19.1, -99.1, c2);
    reset role;
    v_obt := 'ACEPTADO';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(7, 'C1 NO crea una visita a nombre de C2', 'rechazado (sin permiso)', v_obt);

  -- 8. C1 intenta crear una visita con una tienda inactiva.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into public.visitas (competidor_id, latitud, longitud)
    values (v_tienda_inactiva, 19.1, -99.1);
    reset role;
    v_obt := 'ACEPTADO';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(8, 'C1 NO crea una visita con una tienda inactiva', 'rechazado (regla RLS de visitas)', v_obt);

  -- 9. C1 intenta cambiar la tienda de SU visita.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    update public.visitas set competidor_id = v_tienda_activa where id = v1;
    reset role;
    v_obt := 'ACEPTADO';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(9, 'C1 NO modifica su visita', 'rechazado (sin permiso)', v_obt);

  -- 10. C1 intenta borrar SU visita.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    delete from public.visitas where id = v1;
    reset role;
    v_obt := 'ACEPTADO';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(10, 'C1 NO borra su visita', 'rechazado (sin permiso)', v_obt);

  -- 11. C1 intenta usar la función del admin para corregir la tienda.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    perform public.admin_cambiar_competidor(v1, v_tienda_activa);
    reset role;
    v_obt := 'ACEPTADO';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(11, 'C1 NO usa admin_cambiar_competidor', 'rechazado (solo admin)', v_obt);

  -- 12. El admin corrige la tienda de V1b (de la inactiva a la activa).
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    perform public.admin_cambiar_competidor('00000000-0000-4000-8000-000000000812', v_tienda_activa);
    reset role;
    select case when competidor_id = v_tienda_activa then 'corregida' else 'SIN CAMBIO' end
      into v_obt from public.visitas where id = '00000000-0000-4000-8000-000000000812';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(12, 'El admin corrige la tienda con admin_cambiar_competidor', 'corregida', v_obt);
  -- (Se regresa V1b a la tienda inactiva para el caso 32.)
  update public.visitas
  set competidor_id = (select id from public.competidores where nombre = 'PRUEBA 008 inactiva usada (se deshace)')
  where id = '00000000-0000-4000-8000-000000000812';

  -- 13. El admin NO puede cambiar una visita directamente (solo con la función).
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    update public.visitas set latitud = 0 where id = v2;
    reset role;
    v_obt := 'ACEPTADO';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(13, 'El admin NO modifica visitas directo (solo con funciones)', 'rechazado (sin permiso)', v_obt);

  -- ===== VER Y SUBIR FOTOS =====================================================
  -- 14. C1 ve solo las fotos de sus visitas.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    select array_agg(id) into v_ids from public.fotos where id = any (fotos_prueba);
    reset role;
    v_obt := pg_temp.nombres(v_ids);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(14, 'C1 ve solo las fotos de sus visitas', 'F1L, F1p, F1q', v_obt);

  -- 15. El admin ve todas las fotos (también las quitadas, para poder restaurar).
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    select array_agg(id) into v_ids from public.fotos where id = any (fotos_prueba);
    reset role;
    v_obt := pg_temp.nombres(v_ids);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(15, 'El admin ve todas las fotos', 'F0d, F0p, F1L, F1p, F1q, F2p', v_obt);

  -- 16. C1 registra una foto en SU visita → queda "subida por" C1.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into public.fotos (visita_id, ruta)
    values (v1, 'visitas/' || v1 || '/prueba-008-nueva.jpg')
    returning subida_por into v_uuid;
    reset role;
    v_obt := case when v_uuid = c1 then 'subida por C1' else 'subida por ' || coalesce(v_uuid::text, 'nadie') end;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(16, 'C1 registra una foto en su visita (subida_por = C1)', 'subida por C1', v_obt);

  -- 17. C1 intenta registrar una foto en la visita de C2.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into public.fotos (visita_id, ruta)
    values (v2, 'visitas/' || v2 || '/prueba-008-ajena.jpg');
    reset role;
    v_obt := 'ACEPTADO';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(17, 'C1 NO registra fotos en la visita de C2', 'rechazado (regla RLS de fotos)', v_obt);

  -- 18. C1 intenta registrar una foto "subida por" C2.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into public.fotos (visita_id, ruta, subida_por)
    values (v1, 'visitas/' || v1 || '/prueba-008-falsa.jpg', c2);
    reset role;
    v_obt := 'ACEPTADO';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(18, 'C1 NO registra una foto a nombre de C2', 'rechazado (sin permiso)', v_obt);

  -- ===== QUITAR (DESCARTAR) FOTOS ==============================================
  -- 19. C1 quita una foto pendiente de SU visita, mandando una hora FALSA.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    update public.fotos set descartada_at = hora_falsa where id = f1p;
    get diagnostics v_n = row_count;
    reset role;
    select descartada_at into v_hora from public.fotos where id = f1p;
    v_obt := format('%s fila; hora %s', v_n,
                    case when v_hora = now() then 'del servidor'
                         when v_hora = hora_falsa then 'FALSA'
                         else coalesce(v_hora::text, 'vacía') end);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(19, 'C1 quita una foto pendiente de su visita (hora del servidor)', '1 fila; hora del servidor', v_obt);

  -- 20. C1 intenta quitar una foto de la visita de C2.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    update public.fotos set descartada_at = now() where id = f2p;
    get diagnostics v_n = row_count;
    reset role;
    select format('%s filas; %s', v_n, case when descartada_at is null then 'sigue a la vista' else 'QUITADA' end)
      into v_obt from public.fotos where id = f2p;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(20, 'C1 NO quita fotos de la visita de C2', '0 filas; sigue a la vista', v_obt);

  -- 21. C1 intenta quitar una foto procesada de SU visita.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    update public.fotos set descartada_at = now() where id = f1l;
    get diagnostics v_n = row_count;
    reset role;
    select format('%s filas; %s', v_n, case when descartada_at is null then 'sigue a la vista' else 'QUITADA' end)
      into v_obt from public.fotos where id = f1l;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(21, 'C1 NO quita una foto ya procesada (aunque sea suya)', '0 filas; sigue a la vista', v_obt);

  -- 22. C1 intenta restaurar la foto que quitó (ponerla en null).
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    update public.fotos set descartada_at = null where id = f1p;
    get diagnostics v_n = row_count;
    reset role;
    select format('%s filas; %s', v_n, case when descartada_at is null then 'RESTAURADA' else 'sigue quitada' end)
      into v_obt from public.fotos where id = f1p;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(22, 'C1 NO restaura una foto quitada', '0 filas; sigue quitada', v_obt);

  -- 23. C1 intenta usar la función del admin para restaurar.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    perform public.admin_restaurar_foto(f1p);
    reset role;
    v_obt := 'ACEPTADO';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(23, 'C1 NO usa admin_restaurar_foto', 'rechazado (solo admin)', v_obt);

  -- 24. C1 intenta cambiar otra columna (estado_proceso) de su foto pendiente.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    update public.fotos set estado_proceso = 'procesada' where id = f1q;
    reset role;
    v_obt := 'ACEPTADO';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(24, 'C1 NO modifica estado_proceso', 'rechazado (sin permiso)', v_obt);

  -- 25. C1 intenta cambiar la ruta junto con descartada_at.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    update public.fotos set descartada_at = now(), ruta = ruta || '-x' where id = f1q;
    reset role;
    v_obt := 'ACEPTADO';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(25, 'C1 NO modifica ruta (ni junto con descartada_at)', 'rechazado (sin permiso)', v_obt);

  -- 26. C1 intenta borrar su foto.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    delete from public.fotos where id = f1q;
    reset role;
    v_obt := 'ACEPTADO';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(26, 'C1 NO borra fotos', 'rechazado (sin permiso)', v_obt);

  -- 27. F1q quedó exactamente igual después de 24–26.
  select case when estado_proceso = 'pendiente' and descartada_at is null
                   and ruta = 'visitas/' || v1 || '/prueba-008-1q.jpg' then 'igual' else 'CAMBIÓ' end
    into v_obt from public.fotos where id = f1q;
  perform pg_temp.anotar(27, 'La foto F1q quedó igual (existe, pendiente, misma ruta)', 'igual', coalesce(v_obt, 'NO EXISTE'));

  -- ===== ADMIN: QUITAR, RESTAURAR Y CORREOS ====================================
  -- 28. El admin quita una foto pendiente de la visita sin dueño.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    update public.fotos set descartada_at = now() where id = f0p;
    get diagnostics v_n = row_count;
    reset role;
    v_obt := format('%s fila', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(28, 'El admin quita una foto pendiente de cualquier visita (V0)', '1 fila', v_obt);

  -- 29. El admin restaura una foto quitada con su función.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    perform public.admin_restaurar_foto(f0d);
    reset role;
    select case when descartada_at is null then 'a la vista' else 'SIGUE QUITADA' end
      into v_obt from public.fotos where id = f0d;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(29, 'El admin restaura una foto con admin_restaurar_foto', 'a la vista', v_obt);

  -- 30. El admin NO cambia otras columnas de fotos directo.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    update public.fotos set ruta = ruta || '-x' where id = f0d;
    reset role;
    v_obt := 'ACEPTADO';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(30, 'El admin NO modifica otras columnas de fotos directo', 'rechazado (sin permiso)', v_obt);

  -- 31. Correos: el admin los ve; C1 no.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    select count(*) into v_n from public.admin_correos_usuarios() where correo like 'prueba008-%';
    reset role;
    v_obt := format('admin ve %s correos de prueba', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    perform public.admin_correos_usuarios();
    reset role;
    v_obt := v_obt || '; C1 los ve (MAL)';
  exception when others then v_obt := v_obt || '; C1 ' || pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(31, 'Solo el admin ve el correo de cada cuenta',
                         'admin ve 3 correos de prueba; C1 rechazado (solo admin)', v_obt);

  -- ===== TIENDAS ===============================================================
  -- 32. C1 ve la tienda activa y la inactiva que usa su visita V1b; C2 solo la activa.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    select string_agg(replace(replace(nombre, 'PRUEBA 008 ', ''), ' (se deshace)', ''), ', ' order by nombre)
      into v_obt from public.competidores where nombre like 'PRUEBA 008 %';
    reset role;
    v_obt := 'C1: ' || coalesce(v_obt, 'ninguna');
    perform set_config('request.jwt.claims', jwt_c2, true); set local role authenticated;
    select v_obt || ' / C2: ' || coalesce(string_agg(replace(replace(nombre, 'PRUEBA 008 ', ''), ' (se deshace)', ''), ', ' order by nombre), 'ninguna')
      into v_obt from public.competidores where nombre like 'PRUEBA 008 %';
    reset role;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(32, 'Tiendas: activas + las inactivas de sus propias visitas',
                         'C1: activa, inactiva usada / C2: activa', v_obt);

  -- ===== STORAGE ===============================================================
  if not v_storage then
    perform pg_temp.anotar(33, 'Storage: no se pudieron preparar archivos de prueba', 'preparado',
                           'otro error: ' || (select detalle from prueba_storage));
  else
    -- 33. C1 ve solo el archivo de SU visita; el admin ve los 3.
    begin
      perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
      select count(*) into v_n from storage.objects where bucket_id = 'fotos' and name = any (archivos_prueba);
      reset role;
      v_obt := format('C1 ve %s', v_n);
      perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
      select count(*) into v_n from storage.objects where bucket_id = 'fotos' and name = any (archivos_prueba);
      reset role;
      v_obt := v_obt || format('; admin ve %s', v_n);
    exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
    end;
    perform pg_temp.anotar(33, 'Storage: C1 ve solo archivos de su visita; el admin todos', 'C1 ve 1; admin ve 3', v_obt);

    -- 34. C1 sube un archivo a SU visita.
    begin
      perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
      insert into storage.objects (bucket_id, name)
      values ('fotos', 'visitas/' || v1 || '/00000000-0000-4000-8000-000000000841.jpg');
      reset role;
      v_obt := 'aceptado';
    exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
    end;
    perform pg_temp.anotar(34, 'Storage: C1 sube a la carpeta de su visita', 'aceptado', v_obt);

    -- 35. C1 intenta subir a la carpeta de la visita de C2.
    begin
      perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
      insert into storage.objects (bucket_id, name)
      values ('fotos', 'visitas/' || v2 || '/00000000-0000-4000-8000-000000000842.jpg');
      reset role;
      v_obt := 'ACEPTADO';
    exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
    end;
    perform pg_temp.anotar(35, 'Storage: C1 NO sube a la carpeta de C2', 'rechazado (regla RLS de objects)', v_obt);

    -- 36. C1 intenta subir con un nombre que no es <uuid>.jpg.
    begin
      perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
      insert into storage.objects (bucket_id, name)
      values ('fotos', 'visitas/' || v1 || '/foto.jpg');
      reset role;
      v_obt := 'ACEPTADO';
    exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
    end;
    perform pg_temp.anotar(36, 'Storage: C1 NO sube con un nombre que no es <uuid>.jpg', 'rechazado (regla RLS de objects)', v_obt);

    -- 37. C1 intenta reemplazar (update) y borrar (delete) el archivo de su visita.
    -- Puede salir error o "0 filas": lo que importa es que el archivo siga igual.
    begin
      perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
      update storage.objects set name = name || '-x' where name = archivos_prueba[1];
      reset role;
    exception when others then null;
    end;
    begin
      perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
      delete from storage.objects where name = archivos_prueba[1];
      reset role;
    exception when others then null;
    end;
    select case when count(*) = 1 then 'sigue igual' else 'CAMBIÓ O SE BORRÓ' end
      into v_obt from storage.objects where bucket_id = 'fotos' and name = archivos_prueba[1];
    perform pg_temp.anotar(37, 'Storage: C1 NO reemplaza ni borra archivos', 'sigue igual', v_obt);
  end if;

  -- ===== FLUJO REAL DE LA APP (agregado con 008b) ==============================
  -- Los casos 1–37 usan visitas creadas por el SQL Editor (sin reglas). Aquí cada
  -- persona hace, CON SUS REGLAS, lo mismo que la app y en el mismo orden:
  --   nueva visita  → insert … returning id          (FormularioNuevaVisita)
  --   abrirla       → select con su tienda; la lista  (DetalleVisita, ListaVisitas)
  --   subir foto    → insert en storage.objects … returning (Storage API)
  --                 → insert en fotos … returning *    (SubirFotos)
  --   verla         → leer su archivo de Storage       (URLs firmadas)
  --   quitarla      → update descartada_at … returning id (FotosVisita)
  -- y luego OTRA cuenta de campo intenta lo mismo en esa visita.
  -- Sin 008b, el primer insert da "infinite recursion" (casos 6–8 y 42, 53).

  -- 42. C1 crea una visita como la app (con todas las columnas que manda).
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into public.visitas (competidor_id, latitud, longitud, precision_metros, ubicacion_at)
    values (v_tienda_activa, 19.3, -99.3, 12, now())
    returning id, usuario_id into v_nueva_c1, v_uuid;
    reset role;
    v_obt := case when v_uuid = c1 then 'creada a nombre de C1' else 'creada a nombre de ' || coalesce(v_uuid::text, 'nadie') end;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(42, 'App: C1 crea una visita (insert … returning id)', 'creada a nombre de C1', v_obt);

  -- 43. C1 la abre (con el nombre de la tienda) y la ve en "Mis visitas".
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    select coalesce(c.nombre, 'SIN TIENDA') into v_obt
    from public.visitas v left join public.competidores c on c.id = v.competidor_id
    where v.id = v_nueva_c1;
    select count(*) into v_n
    from public.visitas v
    left join lateral (select count(*) from public.fotos f
                       where f.visita_id = v.id and f.descartada_at is null) cuenta on true
    where v.id = v_nueva_c1;
    reset role;
    v_obt := case when v_obt like 'PRUEBA 008 activa%' then 'la abre con su tienda' else coalesce(v_obt, 'NO LA VE') end
             || format('; en la lista: %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(43, 'App: C1 abre su visita nueva y la ve en la lista', 'la abre con su tienda; en la lista: 1', v_obt);

  -- 44. C1 sube el archivo a Storage en su visita nueva.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into storage.objects (bucket_id, name)
    values ('fotos', 'visitas/' || v_nueva_c1 || '/00000000-0000-4000-8000-000000000851.jpg')
    returning name into v_obt;
    reset role;
    v_obt := 'aceptado';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(44, 'App: C1 sube el archivo a Storage (su visita nueva)', 'aceptado', v_obt);

  -- 45. C1 registra dos fotos en su visita nueva (A se quita en el 47; B la
  -- intenta quitar C2 en el 51).
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into public.fotos (visita_id, ruta, nombre_original, tamano_bytes, capturada_at, capturada_origen)
    values (v_nueva_c1, 'visitas/' || v_nueva_c1 || '/00000000-0000-4000-8000-000000000851.jpg',
            'IMG_0001.jpg', 123456, now(), 'exif')
    returning id, subida_por into v_foto_c1a, v_uuid;
    insert into public.fotos (visita_id, ruta, capturada_origen)
    values (v_nueva_c1, 'visitas/' || v_nueva_c1 || '/00000000-0000-4000-8000-000000000852.jpg', 'sin_dato')
    returning id into v_foto_c1b;
    reset role;
    v_obt := case when v_uuid = c1 and v_foto_c1b is not null then 'registradas por C1' else 'subida por ' || coalesce(v_uuid::text, 'nadie') end;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(45, 'App: C1 registra fotos en su visita nueva (insert … returning)', 'registradas por C1', v_obt);

  -- 46. C1 ve sus fotos y lee su archivo (lo que hace pedir la URL firmada).
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    select count(*) into v_n from public.fotos where visita_id = v_nueva_c1;
    v_obt := format('fotos %s', v_n);
    select count(*) into v_n from storage.objects
    where bucket_id = 'fotos' and name like 'visitas/' || v_nueva_c1 || '/%';
    reset role;
    v_obt := v_obt || format('; archivos %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(46, 'App: C1 ve sus fotos nuevas y su archivo (URL firmada)', 'fotos 2; archivos 1', v_obt);

  -- 47. C1 quita la foto A (como la app: update … returning id).
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    with cambio as (
      update public.fotos set descartada_at = now() where id = v_foto_c1a returning id
    ) select count(*) into v_n from cambio;
    reset role;
    v_obt := format('%s fila', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(47, 'App: C1 quita una foto de su visita nueva (update … returning)', '1 fila', v_obt);

  -- 48. C2 (otra cuenta de campo) NO ve la visita nueva de C1, ni sus fotos, ni su archivo.
  begin
    perform set_config('request.jwt.claims', jwt_c2, true); set local role authenticated;
    select count(*) into v_n from public.visitas where id = v_nueva_c1;
    v_obt := format('visita %s', v_n);
    select count(*) into v_n from public.fotos where visita_id = v_nueva_c1;
    v_obt := v_obt || format('; fotos %s', v_n);
    select count(*) into v_n from storage.objects
    where bucket_id = 'fotos' and name like 'visitas/' || v_nueva_c1 || '/%';
    reset role;
    v_obt := v_obt || format('; archivos %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(48, 'Ajena: C2 NO ve la visita nueva de C1 (ni fotos ni archivos)', 'visita 0; fotos 0; archivos 0', v_obt);

  -- 49. C2 NO sube un archivo a la carpeta de la visita nueva de C1.
  begin
    perform set_config('request.jwt.claims', jwt_c2, true); set local role authenticated;
    insert into storage.objects (bucket_id, name)
    values ('fotos', 'visitas/' || v_nueva_c1 || '/00000000-0000-4000-8000-000000000853.jpg');
    reset role;
    v_obt := 'ACEPTADO';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(49, 'Ajena: C2 NO sube archivos a la visita nueva de C1', 'rechazado (regla RLS de objects)', v_obt);

  -- 50. C2 NO registra una foto en la visita nueva de C1.
  begin
    perform set_config('request.jwt.claims', jwt_c2, true); set local role authenticated;
    insert into public.fotos (visita_id, ruta)
    values (v_nueva_c1, 'visitas/' || v_nueva_c1 || '/00000000-0000-4000-8000-000000000853.jpg');
    reset role;
    v_obt := 'ACEPTADO';
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(50, 'Ajena: C2 NO registra fotos en la visita nueva de C1', 'rechazado (regla RLS de fotos)', v_obt);

  -- 51. C2 NO quita la foto B de la visita nueva de C1.
  begin
    perform set_config('request.jwt.claims', jwt_c2, true); set local role authenticated;
    with cambio as (
      update public.fotos set descartada_at = now() where id = v_foto_c1b returning id
    ) select count(*) into v_n from cambio;
    reset role;
    select format('%s filas; %s', v_n, case when descartada_at is null then 'sigue a la vista' else 'QUITADA' end)
      into v_obt from public.fotos where id = v_foto_c1b;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(51, 'Ajena: C2 NO quita fotos de la visita nueva de C1', '0 filas; sigue a la vista', v_obt);

  -- 52. El admin crea una visita como la app (el error del 2026-11-24 fue aquí).
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    insert into public.visitas (competidor_id, latitud, longitud, precision_metros, ubicacion_at)
    values (v_tienda_activa, 19.4, -99.4, 8, now())
    returning id, usuario_id into v_nueva_ad, v_uuid;
    reset role;
    v_obt := case when v_uuid = ad then 'creada a nombre del admin' else 'creada a nombre de ' || coalesce(v_uuid::text, 'nadie') end;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(52, 'App: el admin crea una visita (insert … returning id)', 'creada a nombre del admin', v_obt);

  -- 53. El admin la abre con su tienda y la ve en "Todas las visitas".
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    select coalesce(c.nombre, 'SIN TIENDA') into v_obt
    from public.visitas v left join public.competidores c on c.id = v.competidor_id
    where v.id = v_nueva_ad;
    select count(*) into v_n
    from public.visitas v
    left join lateral (select count(*) from public.fotos f
                       where f.visita_id = v.id and f.descartada_at is null) cuenta on true
    where v.id = v_nueva_ad;
    reset role;
    v_obt := case when v_obt like 'PRUEBA 008 activa%' then 'la abre con su tienda' else coalesce(v_obt, 'NO LA VE') end
             || format('; en la lista: %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(53, 'App: el admin abre su visita nueva y la ve en la lista', 'la abre con su tienda; en la lista: 1', v_obt);

  -- 54. El admin sube el archivo, registra la foto, la ve y la quita.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    insert into storage.objects (bucket_id, name)
    values ('fotos', 'visitas/' || v_nueva_ad || '/00000000-0000-4000-8000-000000000861.jpg')
    returning name into v_obt;
    v_obt := 'sube';
    insert into public.fotos (visita_id, ruta, nombre_original, tamano_bytes, capturada_origen)
    values (v_nueva_ad, 'visitas/' || v_nueva_ad || '/00000000-0000-4000-8000-000000000861.jpg',
            'IMG_0002.jpg', 654321, 'sin_dato')
    returning id, subida_por into v_foto_ad, v_uuid;
    v_obt := v_obt || case when v_uuid = ad then '; registra' else '; registra a nombre de OTRO' end;
    -- Segunda foto, pendiente, para que C1 intente quitarla en el caso 55.
    insert into public.fotos (visita_id, ruta)
    values (v_nueva_ad, 'visitas/' || v_nueva_ad || '/00000000-0000-4000-8000-000000000864.jpg')
    returning id into v_foto_ad2;
    select count(*) into v_n from storage.objects
    where bucket_id = 'fotos' and name like 'visitas/' || v_nueva_ad || '/%';
    v_obt := v_obt || format('; ve %s archivo', v_n);
    with cambio as (
      update public.fotos set descartada_at = now() where id = v_foto_ad returning id
    ) select count(*) into v_n from cambio;
    reset role;
    v_obt := v_obt || format('; quita %s', v_n);
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(54, 'App: el admin sube, registra, ve y quita una foto en su visita nueva',
                         'sube; registra; ve 1 archivo; quita 1', v_obt);

  -- 55. C1 NO hace nada en la visita nueva del admin: no la ve, no sube archivo,
  -- no registra foto, no quita fotos.
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    select count(*) into v_n from public.visitas where id = v_nueva_ad;
    v_obt := format('ve %s', v_n);
    reset role;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into storage.objects (bucket_id, name)
    values ('fotos', 'visitas/' || v_nueva_ad || '/00000000-0000-4000-8000-000000000862.jpg');
    reset role;
    v_obt := v_obt || '; sube ACEPTADO';
  exception when others then v_obt := v_obt || '; sube ' || pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    insert into public.fotos (visita_id, ruta)
    values (v_nueva_ad, 'visitas/' || v_nueva_ad || '/00000000-0000-4000-8000-000000000862.jpg');
    reset role;
    v_obt := v_obt || '; registra ACEPTADO';
  exception when others then v_obt := v_obt || '; registra ' || pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  begin
    perform set_config('request.jwt.claims', jwt_c1, true); set local role authenticated;
    with cambio as (
      update public.fotos set descartada_at = now() where id = v_foto_ad2 returning id
    ) select count(*) into v_n from cambio;
    reset role;
    select v_obt || format('; quita %s filas (%s)', v_n,
                           case when descartada_at is null then 'sigue a la vista' else 'QUITADA' end)
      into v_obt from public.fotos where id = v_foto_ad2;
  exception when others then v_obt := v_obt || '; quita ' || pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(55, 'Ajena: C1 NO ve, sube, registra ni quita en la visita nueva del admin',
                         've 0; sube rechazado (regla RLS de objects); registra rechazado (regla RLS de fotos); quita 0 filas (sigue a la vista)', v_obt);

  -- 56. Por diseño (decisión 4), el admin SÍ trabaja en la visita nueva de C1:
  -- la ve con sus 2 fotos (también la quitada), sube archivo y registra foto.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    select count(*) into v_n from public.visitas where id = v_nueva_c1;
    v_obt := format('ve %s', v_n);
    select count(*) into v_n from public.fotos where visita_id = v_nueva_c1;
    v_obt := v_obt || format('; fotos %s', v_n);
    insert into storage.objects (bucket_id, name)
    values ('fotos', 'visitas/' || v_nueva_c1 || '/00000000-0000-4000-8000-000000000863.jpg');
    insert into public.fotos (visita_id, ruta)
    values (v_nueva_c1, 'visitas/' || v_nueva_c1 || '/00000000-0000-4000-8000-000000000863.jpg')
    returning subida_por into v_uuid;
    reset role;
    v_obt := v_obt || case when v_uuid = ad then '; sube y registra (subida por admin)' else '; registra a nombre de OTRO' end;
  exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(56, 'Admin (por diseño) SÍ ve y sube fotos en la visita nueva de C1',
                         've 1; fotos 2; sube y registra (subida por admin)', v_obt);

  -- ===== ETAPA 2 Y ANON ========================================================
  -- 38. Las tablas y vistas de la Etapa 2 siguen cerradas, también para el admin.
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    perform 1 from public.lecturas_precio limit 1;
    reset role;
    v_obt := 'lecturas_precio ABIERTA';
  exception when others then v_obt := 'lecturas_precio ' || pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  begin
    perform set_config('request.jwt.claims', jwt_ad, true); set local role authenticated;
    perform 1 from public.comparacion_precios limit 1;
    reset role;
    v_obt := v_obt || '; comparacion_precios ABIERTA';
  exception when others then v_obt := v_obt || '; comparacion_precios ' || pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(38, 'Etapa 2 cerrada también para el admin',
                         'lecturas_precio rechazado (sin permiso); comparacion_precios rechazado (sin permiso)', v_obt);

  -- 39. anon no puede usar es_admin ni las funciones del admin.
  begin
    perform set_config('request.jwt.claims', jwt_anon, true); set local role anon;
    perform public.es_admin();
    reset role;
    v_obt := 'es_admin ACEPTADO';
  exception when others then v_obt := 'es_admin ' || pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  begin
    perform set_config('request.jwt.claims', jwt_anon, true); set local role anon;
    perform public.admin_correos_usuarios();
    reset role;
    v_obt := v_obt || '; correos ACEPTADO';
  exception when others then v_obt := v_obt || '; correos ' || pg_temp.error_texto(sqlstate, sqlerrm);
  end;
  perform pg_temp.anotar(39, 'anon NO usa es_admin ni las funciones del admin',
                         'es_admin rechazado (sin permiso); correos rechazado (sin permiso)', v_obt);

  -- 40–41. Solo ANTES de 009: la app actual (anon) sigue funcionando.
  if has_table_privilege('anon', 'public.visitas', 'SELECT') then
    begin
      perform set_config('request.jwt.claims', jwt_anon, true); set local role anon;
      select count(*) into v_n from public.visitas where id = any (visitas_prueba);
      reset role;
      v_obt := format('anon ve %s', v_n);
    exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
    end;
    perform pg_temp.anotar(40, '(antes de 009) anon sigue viendo las visitas', 'anon ve 4', v_obt);

    begin
      perform set_config('request.jwt.claims', jwt_anon, true); set local role anon;
      insert into public.visitas (competidor_id, latitud, longitud)
      values (v_tienda_activa, 19.2, -99.2)
      returning usuario_id into v_uuid;
      reset role;
      v_obt := case when v_uuid is null then 'creada sin dueño' else 'creada con dueño ' || v_uuid end;
    exception when others then v_obt := pg_temp.error_texto(sqlstate, sqlerrm);
    end;
    perform pg_temp.anotar(41, '(antes de 009) anon sigue creando visitas (sin dueño)', 'creada sin dueño', v_obt);
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. Resultado visible (todas las filas deben tener ok = true).
-- -----------------------------------------------------------------------------
-- 57. Guardia: ningún caso terminó en "infinite recursion" (el error de reglas
-- que se llaman en círculo, corregido en 008b). Si sale false, ejecuta 008b.
insert into prueba_resultado
select 57, 'Ningún caso dio "infinite recursion" (si falla: ejecuta 008b)',
       'ninguno',
       coalesce(nullif(string_agg(n::text, ', ' order by n) filter (where obtenido like '%infinite recursion%'), ''), 'ninguno'),
       count(*) filter (where obtenido like '%infinite recursion%') = 0
from prueba_resultado;

-- Mínimo de casos: 1–39, 42–57 = 55 (más 40–41 antes de 009). Si salen menos,
-- la prueba se cortó a la mitad.
insert into prueba_resultado
select 0, 'RESUMEN',
       'todos los casos con ok = true',
       case when count(*) filter (where ok is not true) = 0
            then 'TODO PASÓ (' || count(*) || ' casos). No se guardó nada.'
            else count(*) filter (where ok is not true) || ' caso(s) FALLARON: '
                 || string_agg(n::text, ', ' order by n) filter (where ok is not true)
       end,
       count(*) >= 55 and count(*) filter (where ok is not true) = 0
from prueba_resultado;

select n, caso, esperado, obtenido, ok from prueba_resultado order by n;

-- Deshace TODO: usuarios, tiendas, visitas, fotos y archivos de prueba.
rollback;
