-- =============================================================================
-- pruebas/007_prueba_descartar_fotos.sql — Prueba de "quitar fotos" (descarte)
-- =============================================================================
-- NO es una migración: es una PRUEBA que NO deja nada en la base.
-- Ejecútala DESPUÉS de 007_descartar_fotos.sql.
--
-- Cómo usarla: copia TODO este archivo en Supabase → SQL Editor → Run.
--   - Todo va dentro de una transacción (begin … rollback): las filas de prueba
--     se insertan, se prueban y al final se DESHACE todo. Siempre termina con
--     rollback, pase o falle.
--   - Las acciones "de la app" se hacen como el rol anon (set local role anon),
--     es decir, con los mismos permisos que la llave pública.
--   - Cada caso atrapa su propio error, así que la prueba NO se detiene a la
--     mitad: al final muestra una tabla con TODOS los casos y una fila
--     "0. RESUMEN" que dice si todo pasó. Busca ok = true en todas las filas.
--     (Si la tabla no aparece y sale un error, lo más probable es que falte
--     ejecutar 007_descartar_fotos.sql. Tampoco se guarda nada.)
--
-- Datos: TODOS inventados (competidor "PRUEBA 007", clave PRUEBA-D07-01,
-- artículo "PRUEBA 007 articulo"). Solo se consultan esas filas.
--
-- Fotos de prueba (todas de la misma visita inventada):
--   A = pendiente   B = pendiente (testigo)   C = en_lote   D = procesada   E = error
--   A y B tienen una lectura con equivalencia aprobada (para probar las vistas).
--
-- Casos:
--   a. anon puede descartar una foto pendiente (A); la hora la pone el servidor.
--   b. anon NO puede descartar una foto en_lote (C), procesada (D) ni con error (E).
--   c. anon NO puede restaurar (A → null), ni cambiar la hora de una ya
--      descartada, ni dejar en null una pendiente (B).
--   d. anon NO puede modificar otra columna (estado_proceso, ruta).
--   e. anon NO puede borrar una foto.
--   f. Las vistas lecturas_analisis y comparacion_precios ignoran la descartada.
--   g. (extra) anon NO puede crear una foto ya descartada.
--   h. (extra) alguien del equipo SÍ puede restaurar desde el SQL Editor y la
--      foto vuelve a aparecer en las vistas (descarte reversible).
-- =============================================================================

begin;

create temp table prueba_resultado (
  n int, caso text, esperado text, obtenido text, ok boolean
) on commit drop;

-- Fecha del corte de prueba = el corte más reciente que ya exista (así nuestro
-- artículo de prueba queda "activo"). Las fotos se toman el día siguiente.
create temp table prueba_fecha on commit drop as
select coalesce((select max(fecha_corte) from public.catalogo_propio_cortes), date '2026-01-01') as f;


-- -----------------------------------------------------------------------------
-- 1. Datos inventados (los crea el SQL Editor, no anon)
-- -----------------------------------------------------------------------------
insert into public.competidores (nombre, activo, orden)
values ('PRUEBA 007 (se deshace)', false, 999);

insert into public.visitas (id, competidor_id, latitud, longitud)
select '00000000-0000-4000-8000-000000000701', c.id, 19.0, -99.0
from public.competidores c where c.nombre = 'PRUEBA 007 (se deshace)';

insert into public.fotos (id, visita_id, ruta, capturada_at, capturada_origen, estado_proceso)
select v.id::uuid,
       '00000000-0000-4000-8000-000000000701',
       'visitas/00000000-0000-4000-8000-000000000701/prueba-007-' || v.letra || '.jpg',
       ((p.f + 1)::timestamp + interval '12 hours') at time zone 'America/Mexico_City',
       'exif',
       v.estado
from prueba_fecha p,
     (values ('00000000-0000-4000-8000-000000000702', 'a', 'pendiente'),
             ('00000000-0000-4000-8000-000000000703', 'b', 'pendiente'),
             ('00000000-0000-4000-8000-000000000704', 'c', 'en_lote'),
             ('00000000-0000-4000-8000-000000000705', 'd', 'procesada'),
             ('00000000-0000-4000-8000-000000000706', 'e', 'error')
     ) as v(id, letra, estado);

-- Nuestro artículo (activo, $11) y el de la competencia, con equivalencia aprobada.
insert into public.catalogo_propio
  (clave, descripcion, cantidad, unidad, contenido_origen, es_servicio, obsoleto, de_baja, fecha_corte_ultimo)
select 'PRUEBA-D07-01', 'PRUEBA 007 REFRESCO 600 ML', 600, 'ml', 'archivo', false, false, false, p.f
from prueba_fecha p;

insert into public.catalogo_propio_cortes (fecha_corte, clave, precio_regular)
select p.f, 'PRUEBA-D07-01', 11.00 from prueba_fecha p;

insert into public.articulos_competencia (marca, articulo, cantidad, unidad, piezas)
values ('PRUEBA', 'PRUEBA 007 articulo', 600, 'ml', 1);

insert into public.equivalencias (articulo_competencia_id, clave_propia, tipo, estado)
select id, 'PRUEBA-D07-01', 'mismo_articulo', 'aprobada'
from public.articulos_competencia where articulo = 'PRUEBA 007 articulo';

-- Una lectura aprobada ($10) en la foto A y otra en la foto B.
insert into public.lecturas_precio
  (foto_id, orden_en_foto, articulo_competencia_id, articulo, marca, cantidad, unidad, piezas,
   precio_regular, confianza_articulo, confianza_presentacion, confianza_precio,
   estado, valores_agente, modelo)
select f.id, 1, a.id, a.articulo, a.marca, a.cantidad, a.unidad, a.piezas,
       10.00, 'alta', 'alta', 'alta', 'aprobada', '{}'::jsonb, 'prueba-sin-modelo'
from public.articulos_competencia a,
     (values ('00000000-0000-4000-8000-000000000702'::uuid),
             ('00000000-0000-4000-8000-000000000703'::uuid)) as f(id)
where a.articulo = 'PRUEBA 007 articulo';

-- Cuántas veces aparece cada foto de prueba en cada vista ANTES de descartar.
create temp table prueba_vistas_antes on commit drop as
select (select count(*) from public.lecturas_analisis
        where foto_id = '00000000-0000-4000-8000-000000000702') as la_a,
       (select count(*) from public.comparacion_precios
        where foto_id = '00000000-0000-4000-8000-000000000702') as cp_a;


-- -----------------------------------------------------------------------------
-- 2. Casos. En cada bloque: "set local role anon" = actuar como la app.
-- Si el bloque falla, Postgres deshace ese bloque (incluido el cambio de rol) y
-- se anota el error; si no falla, "reset role" vuelve al SQL Editor.
-- -----------------------------------------------------------------------------
do $$
declare
  c_a constant uuid := '00000000-0000-4000-8000-000000000702';
  c_b constant uuid := '00000000-0000-4000-8000-000000000703';
  c_c constant uuid := '00000000-0000-4000-8000-000000000704';
  c_d constant uuid := '00000000-0000-4000-8000-000000000705';
  c_e constant uuid := '00000000-0000-4000-8000-000000000706';
  c_falsa constant timestamptz := '2000-01-01 00:00:00+00';
  v_n    int;
  v_ok   boolean;
  v_obt  text;
  v_hora timestamptz;
  v_id   uuid;
  r      record;
begin
  -- a. Descartar una foto pendiente, mandando una hora FALSA desde el "celular".
  begin
    set local role anon;
    update public.fotos set descartada_at = c_falsa where id = c_a;
    get diagnostics v_n = row_count;
    reset role;
    select descartada_at into v_hora from public.fotos where id = c_a;
    v_ok  := v_n = 1 and v_hora = now() and v_hora <> c_falsa;
    v_obt := format('%s fila; hora guardada = %s', v_n,
                    case when v_hora = now() then 'la del servidor'
                         when v_hora = c_falsa then 'la FALSA del celular'
                         else coalesce(v_hora::text, 'vacía') end);
  exception when others then
    v_ok := false; v_obt := 'error: ' || sqlerrm;
  end;
  insert into prueba_resultado values (1, 'a. anon descarta una foto pendiente',
    '1 fila; hora guardada = la del servidor', v_obt, v_ok);

  -- b. No se pueden descartar fotos que ya no están pendientes.
  for r in select * from (values (2, 'en_lote', c_c), (3, 'procesada', c_d), (4, 'error', c_e))
                         as t(n, estado, id) loop
    begin
      set local role anon;
      update public.fotos set descartada_at = now() where id = r.id;
      get diagnostics v_n = row_count;
      reset role;
      select descartada_at into v_hora from public.fotos where id = r.id;
      v_ok  := v_n = 0 and v_hora is null;
      v_obt := format('%s filas; sigue %s', v_n, case when v_hora is null then 'a la vista' else 'DESCARTADA' end);
    exception when others then
      v_ok := false; v_obt := 'error: ' || sqlerrm;
    end;
    insert into prueba_resultado values (r.n, 'b. anon NO descarta una foto ' || r.estado,
      '0 filas; sigue a la vista', v_obt, v_ok);
  end loop;

  -- c1. Restaurar la foto A (ponerla en null).
  begin
    set local role anon;
    update public.fotos set descartada_at = null where id = c_a;
    get diagnostics v_n = row_count;
    reset role;
    select descartada_at into v_hora from public.fotos where id = c_a;
    v_ok  := v_n = 0 and v_hora is not null;
    v_obt := format('%s filas; sigue %s', v_n, case when v_hora is null then 'RESTAURADA' else 'descartada' end);
  exception when others then
    v_ok := false; v_obt := 'error: ' || sqlerrm;
  end;
  insert into prueba_resultado values (5, 'c. anon NO restaura una foto descartada',
    '0 filas; sigue descartada', v_obt, v_ok);

  -- c2. Cambiar la hora de una foto ya descartada.
  begin
    set local role anon;
    update public.fotos set descartada_at = c_falsa where id = c_a;
    get diagnostics v_n = row_count;
    reset role;
    v_ok  := v_n = 0;
    v_obt := format('%s filas', v_n);
  exception when others then
    v_ok := false; v_obt := 'error: ' || sqlerrm;
  end;
  insert into prueba_resultado values (6, 'c. anon NO cambia la hora de una foto ya descartada',
    '0 filas', v_obt, v_ok);

  -- c3. Dejar en null una foto pendiente: la regla exige descartada_at no vacío.
  begin
    set local role anon;
    update public.fotos set descartada_at = null where id = c_b;
    reset role;
    v_ok := false; v_obt := 'ACEPTADO';
  exception
    when insufficient_privilege then v_ok := true;  v_obt := 'rechazado (regla RLS)';
    when others                 then v_ok := false; v_obt := 'otro error: ' || sqlerrm;
  end;
  insert into prueba_resultado values (7, 'c. anon NO puede poner descartada_at vacío',
    'rechazado (regla RLS)', v_obt, v_ok);

  -- d1. Cambiar otra columna (estado_proceso) de una foto pendiente.
  begin
    set local role anon;
    update public.fotos set estado_proceso = 'procesada' where id = c_b;
    reset role;
    v_ok := false; v_obt := 'ACEPTADO';
  exception
    when insufficient_privilege then v_ok := true;  v_obt := 'rechazado (sin permiso)';
    when others                 then v_ok := false; v_obt := 'otro error: ' || sqlerrm;
  end;
  insert into prueba_resultado values (8, 'd. anon NO modifica estado_proceso',
    'rechazado (sin permiso)', v_obt, v_ok);

  -- d2. Cambiar otra columna junto con descartada_at (ruta).
  begin
    set local role anon;
    update public.fotos set descartada_at = now(), ruta = ruta || '-x' where id = c_b;
    reset role;
    v_ok := false; v_obt := 'ACEPTADO';
  exception
    when insufficient_privilege then v_ok := true;  v_obt := 'rechazado (sin permiso)';
    when others                 then v_ok := false; v_obt := 'otro error: ' || sqlerrm;
  end;
  insert into prueba_resultado values (9, 'd. anon NO modifica ruta (ni junto con descartada_at)',
    'rechazado (sin permiso)', v_obt, v_ok);

  -- e. Borrar una foto.
  begin
    set local role anon;
    delete from public.fotos where id = c_b;
    reset role;
    v_ok := false; v_obt := 'ACEPTADO';
  exception
    when insufficient_privilege then v_ok := true;  v_obt := 'rechazado (sin permiso)';
    when others                 then v_ok := false; v_obt := 'otro error: ' || sqlerrm;
  end;
  insert into prueba_resultado values (10, 'e. anon NO borra una foto',
    'rechazado (sin permiso)', v_obt, v_ok);

  -- La foto B quedó exactamente igual después de d y e.
  select estado_proceso = 'pendiente' and descartada_at is null
         and ruta = 'visitas/00000000-0000-4000-8000-000000000701/prueba-007-b.jpg'
    into v_ok from public.fotos where id = c_b;
  insert into prueba_resultado values (11, 'd/e. la foto B quedó igual (existe, pendiente, misma ruta)',
    'igual', case when v_ok then 'igual' when v_ok is null then 'NO EXISTE' else 'CAMBIÓ' end,
    coalesce(v_ok, false));

  -- g. Crear una foto que ya venga descartada.
  begin
    set local role anon;
    insert into public.fotos (visita_id, ruta, descartada_at)
    values ('00000000-0000-4000-8000-000000000701',
            'visitas/00000000-0000-4000-8000-000000000701/prueba-007-g.jpg', now())
    returning id into v_id;
    reset role;
    v_ok := false; v_obt := 'ACEPTADO';
  exception
    when insufficient_privilege then v_ok := true;  v_obt := 'rechazado (sin permiso)';
    when others                 then v_ok := false; v_obt := 'otro error: ' || sqlerrm;
  end;
  insert into prueba_resultado values (14, 'g. anon NO crea una foto ya descartada',
    'rechazado (sin permiso)', v_obt, v_ok);
end $$;


-- -----------------------------------------------------------------------------
-- 3. Vistas (como el SQL Editor; anon no puede leerlas)
-- -----------------------------------------------------------------------------
insert into prueba_resultado
select 12, 'f. lecturas_analisis ignora la foto descartada (A)',
       'antes 1, después 0; la testigo B sigue (1)',
       format('antes %s, después %s; B %s', a.la_a,
              (select count(*) from public.lecturas_analisis where foto_id = '00000000-0000-4000-8000-000000000702'),
              (select count(*) from public.lecturas_analisis where foto_id = '00000000-0000-4000-8000-000000000703')),
       a.la_a = 1
       and (select count(*) from public.lecturas_analisis where foto_id = '00000000-0000-4000-8000-000000000702') = 0
       and (select count(*) from public.lecturas_analisis where foto_id = '00000000-0000-4000-8000-000000000703') = 1
from prueba_vistas_antes a;

insert into prueba_resultado
select 13, 'f. comparacion_precios ignora la foto descartada (A)',
       'antes 1, después 0; la testigo B sigue (1)',
       format('antes %s, después %s; B %s', a.cp_a,
              (select count(*) from public.comparacion_precios where foto_id = '00000000-0000-4000-8000-000000000702'),
              (select count(*) from public.comparacion_precios where foto_id = '00000000-0000-4000-8000-000000000703')),
       a.cp_a = 1
       and (select count(*) from public.comparacion_precios where foto_id = '00000000-0000-4000-8000-000000000702') = 0
       and (select count(*) from public.comparacion_precios where foto_id = '00000000-0000-4000-8000-000000000703') = 1
from prueba_vistas_antes a;

-- h. Restaurar desde el SQL Editor (lo que haría alguien del equipo).
update public.fotos set descartada_at = null
where id = '00000000-0000-4000-8000-000000000702';

insert into prueba_resultado
select 15, 'h. el equipo SÍ restaura desde el SQL Editor y A vuelve a las vistas',
       'a la vista; lecturas_analisis 1; comparacion_precios 1',
       format('%s; lecturas_analisis %s; comparacion_precios %s',
              case when f.descartada_at is null then 'a la vista' else 'SIGUE DESCARTADA' end,
              (select count(*) from public.lecturas_analisis where foto_id = f.id),
              (select count(*) from public.comparacion_precios where foto_id = f.id)),
       f.descartada_at is null
       and (select count(*) from public.lecturas_analisis where foto_id = f.id) = 1
       and (select count(*) from public.comparacion_precios where foto_id = f.id) = 1
from public.fotos f
where f.id = '00000000-0000-4000-8000-000000000702';


-- -----------------------------------------------------------------------------
-- 4. Resultado visible (todas las filas deben tener ok = true).
-- -----------------------------------------------------------------------------
insert into prueba_resultado
select 0, 'RESUMEN',
       '15 casos con ok = true',
       case when count(*) filter (where ok is not true) = 0
            then 'TODO PASÓ (' || count(*) || ' casos). No se guardó nada.'
            else count(*) filter (where ok is not true) || ' caso(s) FALLARON: '
                 || string_agg(n::text, ', ' order by n) filter (where ok is not true)
       end,
       count(*) = 15 and count(*) filter (where ok is not true) = 0
from prueba_resultado;

select n, caso, esperado, obtenido, ok from prueba_resultado order by n;

-- Deshace TODO: competidor, visita, fotos, artículos, lecturas y equivalencia de prueba.
rollback;
