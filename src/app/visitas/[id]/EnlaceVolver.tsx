"use client";

// "← Volver a la lista". Si en la captura manual hay productos escritos sin guardar,
// pregunta antes de salir (src/lib/capturas.ts → hayCapturasSinGuardar). Lo escrito
// no se pierde aunque salga: queda como borrador en el celular.
//
// Si la visita se abrió desde la lista FILTRADA por fechas, su URL trae
// ?desde=…&hasta=… y el enlace regresa a la lista con ese mismo filtro
// (EnlaceVolverConFiltro). Solo se copian fechas válidas, nada más de la URL.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { hayCapturasSinGuardar } from "@/lib/capturas";
import { claveDia, consultaFiltro, validarFiltro } from "@/lib/listaVisitas";

export default function EnlaceVolver({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
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

/** Lee el filtro de la URL (useSearchParams: va dentro de <Suspense>, ver page.tsx). */
export function EnlaceVolverConFiltro() {
  const parametros = useSearchParams();
  const leido = validarFiltro(parametros.get("desde"), parametros.get("hasta"), claveDia(new Date()));
  return <EnlaceVolver href={`/${leido.tipo === "ok" ? consultaFiltro(leido.filtro) : ""}`} />;
}
