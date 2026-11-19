import Link from "next/link";
import { Suspense } from "react";
import DetalleVisita from "./DetalleVisita";

// Pantalla de una visita. El id solo se conoce cuando alguien abre la página, así
// que, con cacheComponents, se lee dentro de <Suspense> (ver la doc de Next:
// dynamic-routes.md → "With Cache Components").
export default function PaginaVisita({ params }: PageProps<"/visitas/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <Link href="/" className="enlace text-lg">
        ← Volver a la lista
      </Link>
      <Suspense
        fallback={
          <p className="caja-info">Cargando visita…</p>
        }
      >
        {params.then(({ id }) => (
          <DetalleVisita id={id} />
        ))}
      </Suspense>
    </main>
  );
}
