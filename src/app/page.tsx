import EstadoConexion from "./EstadoConexion";

// Página de inicio PROVISIONAL (Fase 1). En la Fase 3 aquí irá la lista de visitas.
export default function Inicio() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl font-bold">Levantamiento de precios</h1>
      <EstadoConexion />
    </main>
  );
}
