import Link from "next/link";
import { Suspense } from "react";
import ListaVisitas, { TituloVisitas } from "./ListaVisitas";
import ReiniciarAlSalir from "@/components/ReiniciarAlSalir";

// Página de inicio: botón "Nueva visita" y lista de visitas.
export default function Inicio() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl font-bold">Levantamiento de precios</h1>

      <Link
        href="/visitas/nueva"
        className="boton-primario block rounded-2xl px-6 py-5 text-center text-2xl font-bold"
      >
        + Nueva visita
      </Link>

      <section className="flex flex-col gap-3">
        <TituloVisitas />
        {/* Al volver a esta pantalla, la lista se lee de nuevo (no se muestra la de antes). */}
        <ReiniciarAlSalir>
          {/* La lista lee el filtro de fechas de la URL (useSearchParams): con
              cacheComponents eso necesita un <Suspense> arriba (doc de Next:
              use-search-params.md). */}
          <Suspense fallback={<p className="caja-info">Cargando visitas…</p>}>
            <ListaVisitas />
          </Suspense>
        </ReiniciarAlSalir>
      </section>
    </main>
  );
}
