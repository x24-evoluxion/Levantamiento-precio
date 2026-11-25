"use client";

// Ventana de confirmación ("¿Borrar este producto?", "¿Borrar esta visita?"), igual
// que la de quitar una foto (ConfirmarQuitar): usa <dialog>, queda encima de todo y
// Escape cuenta como "Cancelar". Botones de al menos 48 px de alto (más de 44 px).
//
// Con cacheComponents, Next.js esconde (no desmonta) la pantalla al ir a otra: quien
// usa este diálogo debe cerrarlo al esconderse (useLayoutEffect con limpieza), como
// FotosVisita (doc de Next: preserving-ui-state.md).

import { useEffect, useId, useRef } from "react";

type Props = {
  abierto: boolean;
  titulo: string;
  texto?: React.ReactNode;
  /** Texto del botón rojo (por ejemplo, "Borrar"). */
  textoConfirmar: string;
  alConfirmar: () => void;
  alCancelar: () => void;
};

export default function DialogoConfirmar({ abierto, titulo, texto, textoConfirmar, alConfirmar, alCancelar }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={dialogo}
      onClose={alCancelar}
      aria-labelledby={idTitulo}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border-2 border-borde bg-fondo p-5 text-texto backdrop:bg-black/60"
    >
      {abierto && (
        <div className="flex flex-col gap-4">
          <h2 id={idTitulo} className="text-2xl font-bold">
            {titulo}
          </h2>
          {texto && <div className="text-lg text-texto-suave">{texto}</div>}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={alCancelar}
              className="boton-gris min-h-12 rounded-xl px-4 py-3 text-lg font-semibold"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={alConfirmar}
              className="boton-primario min-h-12 rounded-xl px-4 py-3 text-lg font-bold"
            >
              {textoConfirmar}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
