"use client";

// Campo de texto con sugerencias ("combobox" accesible, patrón ARIA 1.2).
//
// - Al escribir, muestra hasta 5 coincidencias debajo del campo: primero las que
//   EMPIEZAN con lo escrito y luego las que lo CONTIENEN, sin distinguir mayúsculas
//   ni acentos (src/lib/capturas.ts → filtrarSugerencias).
// - Tocar una sugerencia llena el campo con ese valor (alElegir).
// - Si no hay coincidencia, o la persona sigue escribiendo, se respeta EXACTAMENTE
//   lo que escribió (alEscribir). Nunca obliga a elegir de la lista.
// - Teclado: flechas para moverse, Enter para elegir, Escape para cerrar.
// - Lectores de pantalla: role="combobox" + role="listbox", aria-activedescendant y
//   un aviso de cuántas sugerencias hay.
// - Celular: letra de 18 px (más de 16 px: iOS no hace zoom), opciones de al menos
//   48 px de alto y, al abrir el teclado, el campo sube para que la lista no quede
//   tapada (se usa visualViewport, que mide lo que queda visible sobre el teclado).

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MAX_SUGERENCIAS, filtrarSugerencias } from "@/lib/capturas";

type Props = {
  etiqueta: string;
  /** Texto pequeño junto a la etiqueta, por ejemplo "(recomendado)". */
  nota?: string;
  valor: string;
  opciones: readonly string[];
  /** La persona escribió (se guarda tal cual). */
  alEscribir: (valor: string) => void;
  /** La persona tocó una sugerencia. */
  alElegir: (valor: string) => void;
  error?: string;
  ayuda?: string;
  maxLength: number;
  /** Para llevar el foco a este campo desde fuera (por ejemplo, al primer error). */
  refCampo?: (el: HTMLInputElement | null) => void;
  claseCampo: string;
};

/** Alto aproximado de la lista con 5 opciones (para saber si cabe sobre el teclado). */
const ALTO_LISTA = MAX_SUGERENCIAS * 48 + 16;

/** Si la lista no cabe entre el campo y el teclado, sube el campo. */
function hacerEspacio(campo: HTMLElement) {
  const vista = window.visualViewport;
  const altoVisible = vista ? vista.height : window.innerHeight;
  const arribaVisible = vista ? vista.offsetTop : 0;
  const caja = campo.getBoundingClientRect();
  const espacioAbajo = altoVisible - (caja.bottom - arribaVisible);
  if (espacioAbajo < ALTO_LISTA) {
    campo.scrollIntoView({ block: "start", behavior: "smooth" });
  }
}

export default function CampoSugerencias({
  etiqueta,
  nota,
  valor,
  opciones,
  alEscribir,
  alElegir,
  error,
  ayuda,
  maxLength,
  refCampo,
  claseCampo,
}: Props) {
  const id = useId();
  const idCampo = `${id}-campo`;
  const idLista = `${id}-lista`;
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const campo = useRef<HTMLInputElement | null>(null);
  const [enfocado, setEnfocado] = useState(false);
  /** false después de elegir o de Escape; vuelve a true al escribir. */
  const [listaPermitida, setListaPermitida] = useState(true);
  const [activa, setActiva] = useState(-1);

  const sugerencias = useMemo(() => filtrarSugerencias(opciones, valor), [opciones, valor]);
  const abierta = enfocado && listaPermitida && sugerencias.length > 0;

  // Mientras el campo tiene el foco, si el teclado cambia el área visible (se abre o
  // cambia de tamaño), se vuelve a revisar que la lista quepa.
  useEffect(() => {
    if (!enfocado) return;
    const vista = window.visualViewport;
    const revisar = () => {
      if (campo.current) hacerEspacio(campo.current);
    };
    // El teclado tarda un poco en abrir.
    const espera = window.setTimeout(revisar, 350);
    vista?.addEventListener("resize", revisar);
    return () => {
      window.clearTimeout(espera);
      vista?.removeEventListener("resize", revisar);
    };
  }, [enfocado]);

  function elegir(opcion: string) {
    alElegir(opcion);
    setListaPermitida(false);
    setActiva(-1);
  }

  function alTecla(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      if (sugerencias.length === 0) return;
      e.preventDefault();
      setListaPermitida(true);
      setActiva((i) => (i + 1) % sugerencias.length);
    } else if (e.key === "ArrowUp") {
      if (sugerencias.length === 0) return;
      e.preventDefault();
      setListaPermitida(true);
      setActiva((i) => (i <= 0 ? sugerencias.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (abierta && activa >= 0 && activa < sugerencias.length) {
        e.preventDefault();
        elegir(sugerencias[activa]);
      }
    } else if (e.key === "Escape") {
      if (abierta) {
        e.preventDefault();
        setListaPermitida(false);
        setActiva(-1);
      }
    }
  }

  const describe = [ayuda ? idAyuda : "", error ? idError : ""].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={idCampo} className="text-lg font-semibold">
        {etiqueta}
        {nota && <span className="ml-1 text-base font-normal text-texto-suave">{nota}</span>}
      </label>
      <div className="relative">
        <input
          ref={(el) => {
            campo.current = el;
            refCampo?.(el);
          }}
          id={idCampo}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={abierta}
          aria-controls={idLista}
          aria-activedescendant={abierta && activa >= 0 ? `${idLista}-${activa}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describe}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          maxLength={maxLength}
          value={valor}
          onChange={(e) => {
            alEscribir(e.target.value);
            setListaPermitida(true);
            setActiva(-1);
          }}
          onFocus={(e) => {
            setEnfocado(true);
            hacerEspacio(e.currentTarget);
          }}
          onBlur={() => {
            setEnfocado(false);
            setActiva(-1);
          }}
          onKeyDown={alTecla}
          className={`${claseCampo} scroll-mt-12 ${error ? "border-error-borde" : ""}`}
        />
        <ul
          id={idLista}
          role="listbox"
          aria-label={`Sugerencias de ${etiqueta.toLowerCase()}`}
          hidden={!abierta}
          className="absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-xl border-2 border-borde bg-fondo shadow-lg"
        >
          {abierta &&
            sugerencias.map((opcion, i) => (
              <li
                key={opcion}
                id={`${idLista}-${i}`}
                role="option"
                aria-selected={i === activa}
                // pointerdown sin acción: así el campo no pierde el foco antes del clic.
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => elegir(opcion)}
                className={`flex min-h-12 cursor-pointer items-center border-b border-tarjeta-presionada px-4 py-2 text-lg last:border-b-0 ${
                  i === activa ? "bg-tarjeta-presionada" : "active:bg-tarjeta-presionada"
                }`}
              >
                {opcion}
              </li>
            ))}
        </ul>
      </div>
      {ayuda && (
        <p id={idAyuda} className="text-base text-texto-suave">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} className="text-base font-semibold text-error-texto">
          {error}
        </p>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {abierta
          ? `${sugerencias.length} ${sugerencias.length === 1 ? "sugerencia" : "sugerencias"}. Usa las flechas para elegir.`
          : ""}
      </p>
    </div>
  );
}
