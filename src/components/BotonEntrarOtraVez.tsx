"use client";

// Botón "Iniciar sesión otra vez": se muestra junto al aviso "Tu sesión caducó"
// (src/lib/errores.ts). Lleva a la pantalla "Entrar" sin perder lo que había en
// pantalla (ver src/components/PuertaSesion.tsx).

import { useSesion } from "@/lib/sesion";

export default function BotonEntrarOtraVez() {
  const { entrarOtraVez } = useSesion();
  return (
    <button
      type="button"
      onClick={() => void entrarOtraVez()}
      className="boton-primario mt-3 w-full rounded-xl px-4 py-3 text-lg font-semibold"
    >
      Iniciar sesión otra vez
    </button>
  );
}
