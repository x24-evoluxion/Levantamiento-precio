import Link from "next/link";
import ListaVisitas from "./ListaVisitas";

// Página de inicio: botón "Nueva visita" y lista de visitas.
export default function Inicio() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl font-bold">Levantamiento de precios</h1>

      <Link
        href="/visitas/nueva"
        className="block rounded-2xl bg-blue-700 px-6 py-5 text-center text-2xl font-bold text-white active:bg-blue-800"
      >
        + Nueva visita
      </Link>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Visitas</h2>
        <ListaVisitas />
      </section>
    </main>
  );
}
