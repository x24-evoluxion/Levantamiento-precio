-- =============================================================================
-- pruebas/006_prueba_comparacion.sql — Prueba de equivalencias y comparacion_precios
-- =============================================================================
-- NO es una migración: es una PRUEBA que NO deja nada en la base.
-- Ejecútala DESPUÉS de 006_equivalencias_comparacion.sql.
--
-- Cómo usarla: copia TODO este archivo en Supabase → SQL Editor → Run.
--   - Todo va dentro de una transacción (begin … rollback): las filas de prueba
--     se insertan, se consulta la vista y al final se DESHACE todo.
--   - Si alguna comprobación falla, el script se detiene con un error que dice
--     cuál ("PRUEBA FALLÓ: …"). Un error dentro de una transacción tampoco
--     guarda nada. (Si quieres estar 100 % seguro, ejecuta después solo
--     "rollback;": no hace daño.)
--   - Si todo pasa, verás la tabla de resultados con ok = true en todas las
--     filas. Si el editor solo muestra "Success. No rows returned", es porque
--     muestra el resultado del ÚLTIMO comando (el rollback): también significa
--     que todo pasó, porque una falla habría detenido el script con un error.
--
-- Datos: TODOS inventados (claves PRUEBA-E24-.., artículos "PRUEBA E2-4 caso N",
-- un competidor "PRUEBA E2-4"). Solo se consultan esas filas: nunca se muestran
-- datos reales.
--
-- Casos (los de "no aparece" deben quedar FUERA de la vista):
--   1. Normal, mismo artículo: nuestro $11 vs competencia $10 → índice +10.
--   2. Nuestro precio en 0                                → no aparece.
--   3. Nuestro artículo SIN contenido (mismo artículo)    → aparece, índice
--      calculado, precio por unidad vacío y motivo 'sin_contenido_propio'.
--   4. Equivalencia NO aprobada (propuesta)               → no aparece.
--   5. Otra presentación (1 l $20 vs nuestro 600 ml $13.20) → índice por
--      100 ml: 2.20 vs 2.00 → +10.
--   6. Otra presentación con nuestro artículo sin contenido → no aparece.
--   7. Sin equivalente (aprobada)                          → no aparece.
--   8. Lectura 'por_revisar' (del mismo artículo del caso 1) → no aparece.
--   9. Nuestro artículo de baja (no activo)                → no aparece.
--  10. Precio de la competencia en 0 (no divide entre cero) → no aparece.
--  11. Otra presentación con unidades distintas (g vs ml)  → no aparece.
--  12-18. Reglas de la tabla: tipo y estado inventados, clave según tipo, dos
--      aprobadas, no dejar borrar artículos con equivalencia, comentario del signo.
-- =============================================================================

begin;

-- Fecha del corte de prueba = el corte más reciente que ya exista (así nuestros
-- artículos de prueba quedan "activos"). La foto se toma el día siguiente.
create temp table prueba_fecha on commit drop as
select coalesce((select max(fecha_corte) from public.catalogo_propio_cortes), date '2026-01-01') as f;

create temp table prueba_resultado (
  n int, caso text, esperado text, obtenido text, ok boolean
) on commit drop;


-- -----------------------------------------------------------------------------
-- 1. Datos inventados
-- -----------------------------------------------------------------------------

-- Competidor, visita y foto de prueba.
insert into public.competidores (nombre, activo, orden)
values ('PRUEBA E2-4 (se deshace)', false, 999);

insert into public.visitas (id, competidor_id, latitud, longitud)
select '00000000-0000-4000-8000-0000000e2401', c.id, 19.0, -99.0
from public.competidores c where c.nombre = 'PRUEBA E2-4 (se deshace)';

insert into public.fotos (id, visita_id, ruta, capturada_at, capturada_origen)
select '00000000-0000-4000-8000-0000000e2402',
       '00000000-0000-4000-8000-0000000e2401',
       'visitas/00000000-0000-4000-8000-0000000e2401/prueba-e24.jpg',
       ((p.f + 1)::timestamp + interval '12 hours') at time zone 'America/Mexico_City',
       'exif'
from prueba_fecha p;

-- Nuestros artículos de prueba (claves inventadas).
insert into public.catalogo_propio
  (clave, descripcion, cantidad, unidad, contenido_origen, es_servicio, obsoleto, de_baja, fecha_corte_ultimo)
select v.clave, v.descripcion, v.cantidad, v.unidad, v.origen, false, false, v.de_baja, p.f
from prueba_fecha p,
     (values
       ('PRUEBA-E24-01', 'PRUEBA REFRESCO 600 ML',   600::numeric, 'ml', 'archivo',  false),
       ('PRUEBA-E24-02', 'PRUEBA PRECIO CERO',        500::numeric, 'ml', 'archivo',  false),
       ('PRUEBA-E24-03', 'PRUEBA SIN CONTENIDO',      null,         null, 'sin_dato', false),
       ('PRUEBA-E24-04', 'PRUEBA NO APROBADA',        600::numeric, 'ml', 'archivo',  false),
       ('PRUEBA-E24-05', 'PRUEBA OTRA PRESENTACION',  600::numeric, 'ml', 'archivo',  false),
       ('PRUEBA-E24-06', 'PRUEBA OTRA PRES SIN CONT', null,         null, 'sin_dato', false),
       ('PRUEBA-E24-09', 'PRUEBA DE BAJA',            600::numeric, 'ml', 'archivo',  true),
       ('PRUEBA-E24-10', 'PRUEBA COMP EN CERO',       600::numeric, 'ml', 'archivo',  false),
       ('PRUEBA-E24-11', 'PRUEBA UNIDADES DISTINTAS', 500::numeric, 'ml', 'archivo',  false),
       ('PRUEBA-E24-12', 'PRUEBA SIN CORTES',         600::numeric, 'ml', 'archivo',  false)
     ) as v(clave, descripcion, cantidad, unidad, origen, de_baja);

-- Nuestro precio regular en el corte de prueba (PRUEBA-E24-12 no tiene corte a
-- propósito: sirve para probar el "no dejar borrar").
insert into public.catalogo_propio_cortes (fecha_corte, clave, precio_regular)
select p.f, v.clave, v.precio
from prueba_fecha p,
     (values
       ('PRUEBA-E24-01', 11.00), ('PRUEBA-E24-02',  0.00), ('PRUEBA-E24-03', 19.80),
       ('PRUEBA-E24-04', 12.00), ('PRUEBA-E24-05', 13.20), ('PRUEBA-E24-06', 15.00),
       ('PRUEBA-E24-09', 10.00), ('PRUEBA-E24-10', 10.00), ('PRUEBA-E24-11', 10.00)
     ) as v(clave, precio);

-- Artículos de la competencia de prueba.
insert into public.articulos_competencia (marca, articulo, cantidad, unidad, piezas)
values
  ('PRUEBA', 'PRUEBA E2-4 caso 1',  600, 'ml', 1),
  ('PRUEBA', 'PRUEBA E2-4 caso 2',  500, 'ml', 1),
  ('PRUEBA', 'PRUEBA E2-4 caso 3',  500, 'g',  1),
  ('PRUEBA', 'PRUEBA E2-4 caso 4',  600, 'ml', 1),
  ('PRUEBA', 'PRUEBA E2-4 caso 5',    1, 'l',  1),
  ('PRUEBA', 'PRUEBA E2-4 caso 6',    1, 'l',  1),
  ('PRUEBA', 'PRUEBA E2-4 caso 7',  250, 'g',  1),
  ('PRUEBA', 'PRUEBA E2-4 caso 9',  600, 'ml', 1),
  ('PRUEBA', 'PRUEBA E2-4 caso 10', 600, 'ml', 1),
  ('PRUEBA', 'PRUEBA E2-4 caso 11', 500, 'g',  1),
  ('PRUEBA', 'PRUEBA E2-4 caso 12', 600, 'ml', 1);

-- Lecturas de la foto de prueba (lo que "dice la etiqueta").
insert into public.lecturas_precio
  (foto_id, orden_en_foto, articulo_competencia_id, articulo, marca, cantidad, unidad, piezas,
   precio_regular, confianza_articulo, confianza_presentacion, confianza_precio,
   estado, valores_agente, modelo)
select '00000000-0000-4000-8000-0000000e2402', v.orden, a.id, a.articulo, a.marca,
       a.cantidad, a.unidad, a.piezas, v.precio, 'alta', 'alta', 'alta',
       v.estado, '{}'::jsonb, 'prueba-sin-modelo'
from (values
       (1,  'PRUEBA E2-4 caso 1',  10.00, 'aprobada'),
       (2,  'PRUEBA E2-4 caso 2',  10.00, 'aprobada'),
       (3,  'PRUEBA E2-4 caso 3',  20.00, 'propuesta'),
       (4,  'PRUEBA E2-4 caso 4',  10.00, 'aprobada'),
       (5,  'PRUEBA E2-4 caso 5',  20.00, 'corregida'),
       (6,  'PRUEBA E2-4 caso 6',  20.00, 'aprobada'),
       (7,  'PRUEBA E2-4 caso 7',  10.00, 'aprobada'),
       (8,  'PRUEBA E2-4 caso 1',   9.00, 'por_revisar'),   -- caso 8
       (9,  'PRUEBA E2-4 caso 9',  10.00, 'aprobada'),
       (10, 'PRUEBA E2-4 caso 10',  0.00, 'aprobada'),
       (11, 'PRUEBA E2-4 caso 11', 10.00, 'aprobada')
     ) as v(orden, articulo, precio, estado)
join public.articulos_competencia a on a.articulo = v.articulo;

-- Equivalencias de prueba.
insert into public.equivalencias (articulo_competencia_id, clave_propia, tipo, estado)
select a.id, v.clave, v.tipo, v.estado
from (values
       ('PRUEBA E2-4 caso 1',  'PRUEBA-E24-01', 'mismo_articulo',    'aprobada'),
       ('PRUEBA E2-4 caso 2',  'PRUEBA-E24-02', 'mismo_articulo',    'aprobada'),
       ('PRUEBA E2-4 caso 3',  'PRUEBA-E24-03', 'mismo_articulo',    'aprobada'),
       ('PRUEBA E2-4 caso 4',  'PRUEBA-E24-04', 'mismo_articulo',    'propuesta'),
       ('PRUEBA E2-4 caso 5',  'PRUEBA-E24-05', 'otra_presentacion', 'aprobada'),
       ('PRUEBA E2-4 caso 6',  'PRUEBA-E24-06', 'otra_presentacion', 'aprobada'),
       ('PRUEBA E2-4 caso 7',  null,            'sin_equivalente',   'aprobada'),
       ('PRUEBA E2-4 caso 9',  'PRUEBA-E24-09', 'mismo_articulo',    'aprobada'),
       ('PRUEBA E2-4 caso 10', 'PRUEBA-E24-10', 'mismo_articulo',    'aprobada'),
       ('PRUEBA E2-4 caso 11', 'PRUEBA-E24-11', 'otra_presentacion', 'aprobada'),
       ('PRUEBA E2-4 caso 12', 'PRUEBA-E24-12', 'mismo_articulo',    'propuesta')
     ) as v(articulo, clave, tipo, estado)
join public.articulos_competencia a on a.articulo = v.articulo;


-- -----------------------------------------------------------------------------
-- 2. Consultar la vista (solo filas de prueba)
-- -----------------------------------------------------------------------------
create temp table prueba_vista on commit drop as
select cp.*, a.articulo as articulo_prueba
from public.comparacion_precios cp
join public.articulos_competencia a on a.id = cp.articulo_competencia_id
where a.articulo like 'PRUEBA E2-4 caso %';

insert into prueba_resultado
select 1, 'Normal (mismo artículo): nuestro $11 vs competencia $10',
       'una fila; índice 10.00; en_linea false; 100 ml: 1.6667 vs 1.8333; sin motivo',
       coalesce((select string_agg(format('índice %s; en_linea %s; %s: %s vs %s; motivo %s',
                   indice_vs_competencia_pct, en_linea, unidad_comparacion,
                   precio_comp_por_unidad, precio_propio_por_unidad,
                   coalesce(motivo_sin_precio_unidad, '—')), ' / ')
                 from prueba_vista where articulo_prueba = 'PRUEBA E2-4 caso 1'), 'no apareció'),
       (select count(*) = 1
               and bool_and(indice_vs_competencia_pct = 10.00 and not en_linea
                            and base_indice = 'precio_total' and entra_a_promedios
                            and unidad_comparacion = '100 ml'
                            and precio_comp_por_unidad = 1.6667
                            and precio_propio_por_unidad = 1.8333
                            and motivo_sin_precio_unidad is null)
        from prueba_vista where articulo_prueba = 'PRUEBA E2-4 caso 1');

insert into prueba_resultado
select 3, 'Sin contenido nuestro (mismo artículo): $19.80 vs $20',
       'aparece; índice -1.00; en_linea true; por unidad vacío; motivo sin_contenido_propio',
       coalesce((select format('índice %s; en_linea %s; por unidad %s / %s; motivo %s',
                   indice_vs_competencia_pct, en_linea,
                   coalesce(precio_comp_por_unidad::text, 'vacío'),
                   coalesce(precio_propio_por_unidad::text, 'vacío'),
                   coalesce(motivo_sin_precio_unidad, '—'))
                 from prueba_vista where articulo_prueba = 'PRUEBA E2-4 caso 3'), 'no apareció'),
       coalesce((select indice_vs_competencia_pct = -1.00 and en_linea
                        and precio_comp_por_unidad is null and precio_propio_por_unidad is null
                        and unidad_comparacion is null
                        and motivo_sin_precio_unidad = 'sin_contenido_propio'
                 from prueba_vista where articulo_prueba = 'PRUEBA E2-4 caso 3'), false);

insert into prueba_resultado
select 5, 'Otra presentación: 1 l $20 vs nuestro 600 ml $13.20',
       'índice 10.00 por unidad; 100 ml: 2.0000 vs 2.2000; no entra a promedios',
       coalesce((select format('índice %s (%s); %s: %s vs %s; entra_a_promedios %s',
                   indice_vs_competencia_pct, base_indice, unidad_comparacion,
                   precio_comp_por_unidad, precio_propio_por_unidad, entra_a_promedios)
                 from prueba_vista where articulo_prueba = 'PRUEBA E2-4 caso 5'), 'no apareció'),
       coalesce((select indice_vs_competencia_pct = 10.00 and base_indice = 'precio_por_unidad'
                        and unidad_comparacion = '100 ml'
                        and precio_comp_por_unidad = 2.0000 and precio_propio_por_unidad = 2.2000
                        and not entra_a_promedios
                 from prueba_vista where articulo_prueba = 'PRUEBA E2-4 caso 5'), false);

insert into prueba_resultado
select v.n, v.caso, 'no aparece',
       case when exists (select 1 from prueba_vista where articulo_prueba = v.articulo)
            then 'APARECIÓ' else 'no aparece' end,
       not exists (select 1 from prueba_vista where articulo_prueba = v.articulo)
from (values
       (2,  'Nuestro precio en 0',                                'PRUEBA E2-4 caso 2'),
       (4,  'Equivalencia no aprobada (propuesta)',               'PRUEBA E2-4 caso 4'),
       (6,  'Otra presentación con nuestro artículo sin contenido', 'PRUEBA E2-4 caso 6'),
       (7,  'Sin equivalente (aprobada)',                         'PRUEBA E2-4 caso 7'),
       (9,  'Nuestro artículo de baja (no activo)',               'PRUEBA E2-4 caso 9'),
       (10, 'Precio de la competencia en 0 (sin dividir entre 0)', 'PRUEBA E2-4 caso 10'),
       (11, 'Otra presentación con unidades distintas (g vs ml)', 'PRUEBA E2-4 caso 11')
     ) as v(n, caso, articulo);

insert into prueba_resultado
select 8, 'Lectura por_revisar del artículo del caso 1',
       'no aparece (el caso 1 tiene solo 1 fila)',
       (select count(*)::text || ' fila(s) del caso 1' from prueba_vista
        where articulo_prueba = 'PRUEBA E2-4 caso 1'),
       (select count(*) = 1 and bool_and(estado_lectura <> 'por_revisar')
        from prueba_vista where articulo_prueba = 'PRUEBA E2-4 caso 1');


-- -----------------------------------------------------------------------------
-- 3. Reglas de la tabla (cada intento que debe fallar se prueba aparte)
-- -----------------------------------------------------------------------------
do $$
declare
  v_art   bigint;
  v_art12 bigint;
  v_ok    boolean;
  v_rest  text;
begin
  select id into v_art   from public.articulos_competencia where articulo = 'PRUEBA E2-4 caso 4';
  select id into v_art12 from public.articulos_competencia where articulo = 'PRUEBA E2-4 caso 12';

  -- 12. tipo inventado
  v_ok := false;
  begin
    insert into public.equivalencias (articulo_competencia_id, clave_propia, tipo)
    values (v_art, 'PRUEBA-E24-04', 'parecido');
  exception when check_violation then v_ok := true;
  end;
  insert into prueba_resultado values (12, 'Tipo inventado ("parecido")', 'rechazado',
    case when v_ok then 'rechazado' else 'ACEPTADO' end, v_ok);

  -- 13. estado inventado
  v_ok := false;
  begin
    insert into public.equivalencias (articulo_competencia_id, clave_propia, tipo, estado)
    values (v_art, 'PRUEBA-E24-04', 'mismo_articulo', 'quizas');
  exception when check_violation then v_ok := true;
  end;
  insert into prueba_resultado values (13, 'Estado inventado ("quizas")', 'rechazado',
    case when v_ok then 'rechazado' else 'ACEPTADO' end, v_ok);

  -- 14. mismo_articulo sin clave nuestra
  v_ok := false;
  begin
    insert into public.equivalencias (articulo_competencia_id, clave_propia, tipo)
    values (v_art, null, 'mismo_articulo');
  exception when check_violation then v_ok := true;
  end;
  insert into prueba_resultado values (14, 'mismo_articulo sin clave nuestra', 'rechazado',
    case when v_ok then 'rechazado' else 'ACEPTADO' end, v_ok);

  -- 15. sin_equivalente CON clave nuestra
  v_ok := false;
  begin
    insert into public.equivalencias (articulo_competencia_id, clave_propia, tipo)
    values (v_art, 'PRUEBA-E24-04', 'sin_equivalente');
  exception when check_violation then v_ok := true;
  end;
  insert into prueba_resultado values (15, 'sin_equivalente con clave nuestra', 'rechazado',
    case when v_ok then 'rechazado' else 'ACEPTADO' end, v_ok);

  -- 16. segunda equivalencia aprobada del mismo artículo (el del caso 1)
  v_ok := false;
  begin
    insert into public.equivalencias (articulo_competencia_id, clave_propia, tipo, estado)
    select id, 'PRUEBA-E24-04', 'mismo_articulo', 'aprobada'
    from public.articulos_competencia where articulo = 'PRUEBA E2-4 caso 1';
  exception when unique_violation then v_ok := true;
  end;
  insert into prueba_resultado values (16, 'Dos aprobadas para el mismo artículo', 'rechazado',
    case when v_ok then 'rechazado' else 'ACEPTADO' end, v_ok);

  -- 17a. borrar un artículo NUESTRO con equivalencia (PRUEBA-E24-12 no tiene
  -- cortes, así que lo único que puede bloquear es la equivalencia)
  v_ok := false; v_rest := null;
  begin
    delete from public.catalogo_propio where clave = 'PRUEBA-E24-12';
  exception when foreign_key_violation then
    get stacked diagnostics v_rest = constraint_name;
    v_ok := (v_rest = 'equivalencias_clave_propia_fk');
  end;
  insert into prueba_resultado values (17, 'Borrar artículo nuestro con equivalencia', 'bloqueado',
    case when v_ok then 'bloqueado' else 'NO bloqueado (' || coalesce(v_rest, 'se borró') || ')' end, v_ok);

  -- 17b. borrar un artículo de la COMPETENCIA con equivalencia (sin lecturas)
  v_ok := false; v_rest := null;
  begin
    delete from public.articulos_competencia where id = v_art12;
  exception when foreign_key_violation then
    get stacked diagnostics v_rest = constraint_name;
    v_ok := (v_rest = 'equivalencias_articulo_competencia_fk');
  end;
  insert into prueba_resultado values (18, 'Borrar artículo de la competencia con equivalencia', 'bloqueado',
    case when v_ok then 'bloqueado' else 'NO bloqueado (' || coalesce(v_rest, 'se borró') || ')' end, v_ok);
end $$;

-- 19. Comentario del signo dentro de la base.
insert into prueba_resultado
select 19, 'Comentario de indice_vs_competencia_pct', 'empieza con "Porcentaje. Positivo = nosotros más caros"',
       left(coalesce(d.c, 'sin comentario'), 70),
       coalesce(d.c like 'Porcentaje. Positivo = nosotros más caros%', false)
from (select col_description('public.comparacion_precios'::regclass,
               (select attnum from pg_attribute
                where attrelid = 'public.comparacion_precios'::regclass
                  and attname = 'indice_vs_competencia_pct')) as c) d;

-- 20. Total de filas de prueba en la vista: solo los casos 1, 3 y 5.
insert into prueba_resultado
select 20, 'Filas de prueba en la vista', '3 (casos 1, 3 y 5)',
       count(*)::text, count(*) = 3
from prueba_vista;


-- -----------------------------------------------------------------------------
-- 4. Resultado. Si algo falló, se detiene con error (y no se guarda nada).
-- -----------------------------------------------------------------------------
do $$
declare v_fallas text;
begin
  select string_agg(n || '. ' || caso, ' | ' order by n) into v_fallas
  from prueba_resultado where ok is not true;
  if v_fallas is not null then
    raise exception 'PRUEBA FALLÓ (no se guarda nada): %', v_fallas;
  end if;
end $$;

select n, caso, esperado, obtenido, ok from prueba_resultado order by n;

-- Deshace TODO: competidor, visita, foto, artículos, lecturas y equivalencias de prueba.
rollback;
