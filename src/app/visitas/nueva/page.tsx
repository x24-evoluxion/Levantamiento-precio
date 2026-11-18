import Link from "next/link";
import FormularioNuevaVisita from "./FormularioNuevaVisita";

// Pantalla para crear una visita: elegir competidor, guardar la ubicación y guardar.
export default function NuevaVisita() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <Link href="/" className="text-lg font-semibold text-blue-700 underline">
        ← Volver a la lista
      </Link>
      <h1 className="text-3xl font-bold">Nueva visita</h1>
      <FormularioNuevaVisita />
    </main>
  );
}
