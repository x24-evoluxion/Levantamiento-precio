// Formato de fechas para mostrar en la app.
// En la base de datos las fechas están en UTC; aquí se convierten a hora de México.

const formato = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  dateStyle: "medium",
  timeStyle: "short",
});

// "2026-11-18T17:05:00+00:00" → "18 nov 2026, 11:05 a.m."
export function formatearFecha(iso: string | null): string {
  if (!iso) return "—";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "—";
  return formato.format(fecha);
}
