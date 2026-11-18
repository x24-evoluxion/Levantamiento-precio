"use client";

// Galería de miniaturas de una visita. Al tocar una, se abre grande en pantalla
// completa, con botones para cerrar y pasar a la anterior o la siguiente.
//
// La foto grande usa <dialog>, una ventana que ya trae el navegador: se pone
// encima de todo y se cierra también con la tecla Escape.
//
// Se usa <img> normal (no el <Image> de Next.js): las fotos ya llegan reducidas
// (~2000 px, casi siempre < 1 MB) y así no hay que configurar ni pagar la
// optimización de imágenes de Vercel.
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { formatearFecha } from "@/lib/fechas";
import { urlFoto } from "@/lib/fotos";
import type { Foto } from "@/lib/tipos";

export default function GaleriaFotos({ fotos }: { fotos: Foto[] }) {
  // Id de la foto abierta en grande; null = ninguna. Se guarda el id (y no la
  // posición) para que, si llega una foto nueva mientras está abierta, no cambie.
  const [abiertaId, setAbiertaId] = useState<string | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);

  const posicion = abiertaId === null ? -1 : fotos.findIndex((f) => f.id === abiertaId);
  const abierta = posicion === -1 ? null : posicion;

  function irA(i: number) {
    const total = fotos.length;
    setAbiertaId(fotos[(i + total) % total].id);
  }

  // Abre o cierra la ventana cuando cambia "abierta".
  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (abierta !== null && !d.open) d.showModal();
    if (abierta === null && d.open) d.close();
  }, [abierta]);

  // Teclas ← y → en computadora.
  useEffect(() => {
    if (abierta === null) return;
    const total = fotos.length;
    function alTeclear(e: KeyboardEvent) {
      const i = e.key === "ArrowLeft" ? abierta! - 1 : e.key === "ArrowRight" ? abierta! + 1 : null;
      if (i !== null) setAbiertaId(fotos[(i + total) % total].id);
    }
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierta, fotos]);

  if (fotos.length === 0) {
    return (
      <p className="rounded-xl bg-zinc-100 p-4 text-lg text-zinc-700">Esta visita todavía no tiene fotos.</p>
    );
  }

  const foto = abierta !== null ? fotos[abierta] : null;
  const varias = fotos.length > 1;

  return (
    <>
      <h3 className="text-xl font-bold">
        {fotos.length} {fotos.length === 1 ? "foto guardada" : "fotos guardadas"}
      </h3>

      <ul className="grid grid-cols-3 gap-2">
        {fotos.map((f, i) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => setAbiertaId(f.id)}
              className="block aspect-square w-full overflow-hidden rounded-lg border-2 border-zinc-200 bg-zinc-100 active:opacity-70"
              aria-label={`Ver foto ${i + 1} de ${fotos.length} en grande`}
            >
              <img
                src={urlFoto(f.ruta)}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogo}
        onClose={() => setAbiertaId(null)}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0 text-white backdrop:bg-black"
        aria-label="Foto en grande"
      >
        {foto && abierta !== null && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-3 p-3">
              <p className="text-lg font-semibold">
                Foto {abierta + 1} de {fotos.length}
              </p>
              <button
                type="button"
                onClick={() => setAbiertaId(null)}
                className="rounded-xl bg-white px-5 py-3 text-lg font-bold text-black active:bg-zinc-300"
              >
                ✕ Cerrar
              </button>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center">
              <img
                key={foto.id}
                src={urlFoto(foto.ruta)}
                alt={`Foto ${abierta + 1} de ${fotos.length}`}
                className="max-h-full max-w-full object-contain"
              />
            </div>

            <p className="px-3 pt-2 text-center text-base text-zinc-300">Subida {formatearFecha(foto.created_at)}</p>

            {varias && (
              <div className="grid grid-cols-2 gap-3 p-3">
                <button
                  type="button"
                  onClick={() => irA(abierta - 1)}
                  className="rounded-xl bg-zinc-800 px-4 py-4 text-lg font-semibold active:bg-zinc-700"
                >
                  ← Anterior
                </button>
                <button
                  type="button"
                  onClick={() => irA(abierta + 1)}
                  className="rounded-xl bg-zinc-800 px-4 py-4 text-lg font-semibold active:bg-zinc-700"
                >
                  Siguiente →
                </button>
              </div>
            )}
            {!varias && <div className="p-3" />}
          </div>
        )}
      </dialog>
    </>
  );
}
