-- =============================================================================
-- 002_fotos_hora_captura.sql — Hora en que se TOMÓ cada foto (Etapa 2, Fase E2-1)
-- =============================================================================
-- Cómo usarlo: copia TODO este archivo en Supabase → SQL Editor → Run.
-- Se puede ejecutar más de una vez sin romper nada.
--
-- ⚠️ ORDEN: ejecútalo ANTES de publicar (push) la versión nueva de la app.
--   - La app vieja no manda estas columnas → sigue funcionando igual.
--   - La app nueva SÍ las manda → si este archivo no se ejecutó, la subida de
--     fotos fallaría con "column ... does not exist".
--
-- Qué agrega a la tabla fotos:
--   capturada_at      → hora en que se tomó la foto, leída del archivo (EXIF)
--                       antes de comprimirla. Vacía si no se pudo leer.
--   capturada_origen  → de dónde salió esa hora:
--                         'exif'               → EXIF con zona horaria
--                         'exif_zona_celular'  → EXIF sin zona horaria; se usó la del celular
--                         'sin_dato'           → no se pudo leer (fotos viejas, capturas
--                                                de pantalla, fotos de WhatsApp…)
-- No borra ni cambia ningún dato existente. Las fotos viejas quedan con
-- capturada_at vacía y capturada_origen = 'sin_dato'.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- BLOQUE 1. Columnas nuevas.
-- -----------------------------------------------------------------------------
alter table public.fotos
  add column if not exists capturada_at     timestamptz,
  add column if not exists capturada_origen text not null default 'sin_dato';

-- Solo se aceptan los 3 valores de arriba, y si dice 'sin_dato' la hora debe ir vacía
-- (y al revés: si trae hora, el origen no puede ser 'sin_dato').
alter table public.fotos drop constraint if exists fotos_capturada_origen_valido;
alter table public.fotos add constraint fotos_capturada_origen_valido
  check (
    capturada_origen in ('exif', 'exif_zona_celular', 'sin_dato')
    and ((capturada_origen = 'sin_dato') = (capturada_at is null))
  );


-- -----------------------------------------------------------------------------
-- BLOQUE 2. Permiso para que la app ("anon") llene estas 2 columnas al CREAR una
-- foto. Se suma a las 4 que ya tenía (visita_id, ruta, nombre_original,
-- tamano_bytes). Sigue sin poder CAMBIAR ni BORRAR fotos.
-- -----------------------------------------------------------------------------
grant insert (capturada_at, capturada_origen) on public.fotos to anon;


-- -----------------------------------------------------------------------------
-- BLOQUE 3. Comprobación (solo lee; no cambia nada).
-- Debe mostrar las 2 columnas nuevas, y que "anon" puede insertarlas.
-- -----------------------------------------------------------------------------
select column_name, data_type, column_default,
       has_column_privilege('anon', 'public.fotos', column_name, 'INSERT') as anon_puede_insertar
from information_schema.columns
where table_schema = 'public' and table_name = 'fotos'
  and column_name in ('capturada_at', 'capturada_origen');
