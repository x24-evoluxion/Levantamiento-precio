"use client";

// Ventana "¿Quitar esta foto?" que aparece al tocar el botón ✕ de una foto.
// Usa <dialog>, igual que la foto en grande: queda encima de todo y se cierra
// también con la tecla Escape (eso cuenta como "Cancelar").
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef } from "react";
import type { Foto } from "@/lib/tipos";
import type { UrlsFirmadas } from "@/lib/urlsFirmadas";

type Props = {
  /** La foto que se quiere quitar; null = ventana cerrada. */
  foto: Foto | null;
  alConfirmar: (foto: Foto) => void;
  alCancelar: () => void;
  /** Links firmados de las fotos (los pide FotosVisita). */
  urls: UrlsFirmadas;
};

export default function ConfirmarQuitar({ foto, alConfirmar, alCancelar, urls }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (foto && !d.open) d.showModal();
    if (!foto && d.open) d.close();
  }, [foto]);

  return (
    <dialog
      ref={dialogo}
      onClose={alCancelar}
      aria-labelledby="titulo-confirmar-quitar"
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border-2 border-borde bg-fondo p-5 text-texto backdrop:bg-black/60"
    >
      {foto && (
        <div className="flex flex-col gap-4">
          <h2 id="titulo-confirmar-quitar" className="text-2xl font-bold">
            ¿Quitar esta foto?
          </h2>
          {urls.urlDe(foto.ruta) ? (
            <img
              src={urls.urlDe(foto.ruta)!}
              alt="La foto que vas a quitar"
              onError={() => urls.alFallarImagen(foto.ruta)}
              className="max-h-56 w-full rounded-lg border-2 border-borde bg-tarjeta object-contain"
            />
          ) : (
            <p className="caja-info">La foto no se puede mostrar en este momento.</p>
          )}
          <p className="text-lg text-texto-suave">
            Ya no se verá en esta visita.
            {foto.estado_proceso !== "pendiente" &&
              " Ya se leyeron sus precios: al quitarla, dejan de contar en los análisis (se puede restaurar)."}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={alCancelar}
              className="boton-gris rounded-xl px-4 py-3 text-lg font-semibold"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => alConfirmar(foto)}
              className="boton-primario rounded-xl px-4 py-3 text-lg font-bold"
            >
              Quitar
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
