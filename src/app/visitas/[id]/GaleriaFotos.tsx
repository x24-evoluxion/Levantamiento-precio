"use client";

// Galería de miniaturas de una visita. Al tocar una, se abre grande en pantalla
// completa, con botones para cerrar y pasar a la anterior o la siguiente.
// Arriba a la derecha de cada miniatura hay un botón ✕ "Quitar foto" (lo que pasa
// después lo decide FotosVisita: confirmación y guardado).
//
// La foto grande usa <dialog>, una ventana que ya trae el navegador: se pone
// encima de todo y se cierra también con la tecla Escape.
//
// Se usa <img> normal (no el <Image> de Next.js): las fotos ya llegan reducidas
// (2200 px de lado mayor; las de antes, 2000 px) y así no hay que configurar ni pagar la
// optimización de imágenes de Vercel.
//
// Los links de las fotos son URLs firmadas (duran 24 h y se renuevan solas; ver
// src/lib/urlsFirmadas.ts). Mientras llega el link se ve "…"; si la foto no está
// disponible, "Sin imagen".
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { formatearFecha } from "@/lib/fechas";
import type { Foto } from "@/lib/tipos";
import type { UrlsFirmadas } from "@/lib/urlsFirmadas";

type Props = {
  fotos: Foto[];
  /** Se llama al tocar el botón ✕ "Quitar foto" de una miniatura. */
  alQuitar: (foto: Foto) => void;
  /** Fotos cuyo descarte se está guardando: su botón queda desactivado. */
  guardando: ReadonlySet<string>;
  /** Links firmados de las fotos (los pide FotosVisita). */
  urls: UrlsFirmadas;
};

/** Lo que se ve en lugar de la foto mientras llega su link, o si no está disponible. */
export function SinImagen({ url }: { url: string | null | undefined }) {
  return (
    <span className="flex h-full w-full items-center justify-center p-1 text-center text-base text-texto-suave">
      {url === null ? "Sin imagen" : "…"}
    </span>
  );
}

export default function GaleriaFotos({ fotos, alQuitar, guardando, urls }: Props) {
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
      <p className="caja-info">Esta visita todavía no tiene fotos.</p>
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
          <li key={f.id} className="relative">
            <button
              type="button"
              onClick={() => setAbiertaId(f.id)}
              className="block aspect-square w-full overflow-hidden rounded-lg border-2 border-borde bg-tarjeta active:opacity-70"
              aria-label={`Ver foto ${i + 1} de ${fotos.length} en grande`}
            >
              {urls.urlDe(f.ruta) ? (
                <img
                  src={urls.urlDe(f.ruta)!}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={() => urls.alFallarImagen(f.ruta)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <SinImagen url={urls.urlDe(f.ruta)} />
              )}
            </button>
            {/* Botón "Quitar foto": esquina superior derecha, 44 × 44 px (size-11).
                Círculo negro semitransparente con borde blanco: se ve sobre
                cualquier foto, clara u oscura. */}
            <button
              type="button"
              onClick={() => alQuitar(f)}
              disabled={guardando.has(f.id)}
              aria-busy={guardando.has(f.id)}
              aria-label="Quitar foto"
              title="Quitar foto"
              className="absolute top-1 right-1 flex size-11 items-center justify-center rounded-full border-2 border-white/80 bg-black/60 text-white shadow-md outline-offset-2 active:bg-black/80 disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-marca"
            >
              {guardando.has(f.id) ? (
                <span aria-hidden="true" className="text-base font-bold">…</span>
              ) : (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="size-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              )}
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogo}
        onClose={() => setAbiertaId(null)}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-fondo p-0 text-texto backdrop:bg-fondo"
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
                className="boton-gris rounded-xl px-5 py-3 text-lg font-bold"
              >
                ✕ Cerrar
              </button>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center">
              {urls.urlDe(foto.ruta) ? (
                <img
                  key={foto.id}
                  src={urls.urlDe(foto.ruta)!}
                  alt={`Foto ${abierta + 1} de ${fotos.length}`}
                  onError={() => urls.alFallarImagen(foto.ruta)}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <SinImagen url={urls.urlDe(foto.ruta)} />
              )}
            </div>

            <p className="px-3 pt-2 text-center text-base text-texto-suave">
              {foto.capturada_at && <span className="block">Tomada {formatearFecha(foto.capturada_at)}</span>}
              <span className="block">Subida {formatearFecha(foto.created_at)}</span>
            </p>

            {varias && (
              <div className="grid grid-cols-2 gap-3 p-3">
                <button
                  type="button"
                  onClick={() => irA(abierta - 1)}
                  className="boton-gris rounded-xl px-4 py-4 text-lg font-semibold"
                >
                  ← Anterior
                </button>
                <button
                  type="button"
                  onClick={() => irA(abierta + 1)}
                  className="boton-gris rounded-xl px-4 py-4 text-lg font-semibold"
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
