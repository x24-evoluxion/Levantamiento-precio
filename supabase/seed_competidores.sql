-- =============================================================================
-- seed_competidores.sql — Lista de competidores
-- =============================================================================
-- Cómo usarlo: ejecútalo en Supabase → SQL Editor DESPUÉS de 001_esquema.sql.
-- Lo puedes ejecutar las veces que quieras: no duplica filas.
--
-- CÓMO EDITAR LA LISTA (una línea por competidor):
--   ('Nombre', orden, activo)
--     Nombre → como se verá en la app
--     orden  → posición en la lista (1 = primero)
--     activo → true = aparece en la app · false = NO aparece
--
-- ⚠️ PARA QUITAR un competidor que ya se usó en visitas: NO borres su línea.
--    Cámbiale activo a false. Así las visitas viejas siguen teniendo su nombre.
--
-- ⚠️ PARA RENOMBRAR un competidor: NO cambies el nombre solo aquí, porque eso
--    crea una fila NUEVA y deja la vieja. Ejecuta primero un update, por ejemplo:
--      update public.competidores set nombre = 'Nombre nuevo' where nombre = 'Nombre viejo';
--    y después cambia el nombre también en esta lista.
-- =============================================================================

insert into public.competidores (nombre, orden, activo) values
  ('Fasti',                 1, true),
  ('Oxxo',                  2, true),
  ('Neto',                  3, true),
  ('3B',                    4, true),
  ('Farmacias Guadalajara', 5, true),
  ('Chedraui',              6, true),
  ('POR CONFIRMAR',         7, false)   -- provisional: corregir el nombre y poner true
on conflict (nombre) do update
  set orden  = excluded.orden,
      activo = excluded.activo;

-- Para revisar cómo quedó la lista:
select id, nombre, orden, activo from public.competidores order by orden;
