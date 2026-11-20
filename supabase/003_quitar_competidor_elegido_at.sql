-- =============================================================================
-- 003_quitar_competidor_elegido_at.sql — Quita visitas.competidor_elegido_at
-- (Etapa 2, Fase E2-1)
-- =============================================================================
-- ⛔ NO LO EJECUTES hasta que se cumpla TODO esto:
--   1. La versión nueva de la app (que ya no manda esta columna) está publicada
--      en Vercel.
--   2. Con el link de Vercel guardaste una visita nueva y salió bien.
-- Si se ejecuta antes, la app vieja dejaría de poder guardar visitas.
--
-- Qué datos se pierden (para siempre):
--   La hora (reloj del celular) en que se tocó el competidor, en TODAS las
--   visitas guardadas hasta hoy. Nada más: la visita, su competidor, su
--   ubicación, ubicacion_at, created_at y sus fotos se quedan igual.
--
-- Si quieres guardar una copia antes, ejecuta SOLO esta consulta y descarga el
-- resultado con el botón "Export → CSV" del SQL Editor:
--
--   select id, competidor_elegido_at
--   from public.visitas
--   where competidor_elegido_at is not null
--   order by created_at;
--
-- Se puede ejecutar más de una vez: si la columna ya no existe, no hace nada.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- BLOQUE 1. Freno de seguridad.
-- La app nueva guarda las visitas SIN esta columna. Si la visita más reciente
-- todavía la trae, es señal de que la app publicada sigue siendo la vieja (o de
-- que aún no se probó la nueva): se detiene sin borrar nada.
-- -----------------------------------------------------------------------------
do $$
declare
  ultima timestamptz;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'visitas'
      and column_name = 'competidor_elegido_at'
  ) then
    execute 'select competidor_elegido_at from public.visitas order by created_at desc limit 1'
      into ultima;
    if ultima is not null then
      raise exception 'Alto: la visita más reciente todavía trae competidor_elegido_at. Publica la app nueva, guarda una visita de prueba con el link de Vercel y vuelve a ejecutar este archivo. No se borró nada.';
    end if;
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- BLOQUE 2. Borrar la columna.
-- El permiso de "anon" para llenarla se borra solo junto con la columna. Ningún
-- índice, regla (RLS) ni vista la usa, así que nada más se ve afectado.
-- -----------------------------------------------------------------------------
alter table public.visitas drop column if exists competidor_elegido_at;


-- -----------------------------------------------------------------------------
-- BLOQUE 3. Comprobación (solo lee). Debe devolver 0 filas.
-- -----------------------------------------------------------------------------
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'visitas'
  and column_name = 'competidor_elegido_at';
