import { Suspense } from "react";
import DetalleVisita from "./DetalleVisita";
import EnlaceVolver, { EnlaceVolverConFiltro } from "./EnlaceVolver";

// Pantalla de una visita. El id solo se conoce cuando alguien abre la página, así
// que, con cacheComponents, se lee dentro de <Suspense> (ver la doc de Next:
// dynamic-routes.md → "With Cache Components").
export default function PaginaVisita({ params }: PageProps<"/visitas/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      {/* Regresa a la lista con el filtro de fechas con el que se abrió (si lo había). */}
      <Suspense fallback={<EnlaceVolver />}>
        <EnlaceVolverConFiltro />
      </Suspense>
      <Suspense
        fallback={
          <p className="caja-info">Cargando visita…</p>
        }
      >
        {params.then(({ id }) => (
          // key={id}: cada visita tiene su propia pantalla; nunca se mezclan los datos,
          // las fotos ni la lista de subidas de otra visita.
          <DetalleVisita key={id} id={id} />
        ))}
      </Suspense>
    </main>
  );
}
