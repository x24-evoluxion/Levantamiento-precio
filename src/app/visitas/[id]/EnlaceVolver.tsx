"use client";

// "← Volver a la lista". Si en la captura manual hay productos escritos sin guardar,
// pregunta antes de salir (src/lib/capturas.ts → hayCapturasSinGuardar). Lo escrito
// no se pierde aunque salga: queda como borrador en el celular.

import Link from "next/link";
import { hayCapturasSinGuardar } from "@/lib/capturas";

export default function EnlaceVolver() {
  return (
    <Link
      href="/"
      className="enlace text-lg"
      onNavigate={(e) => {
        if (
          hayCapturasSinGuardar() &&
          !window.confirm(
            "Tienes productos escritos sin guardar. Se quedan como borrador en este celular, pero no se han guardado. ¿Salir de todos modos?",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      ← Volver a la lista
    </Link>
  );
}
