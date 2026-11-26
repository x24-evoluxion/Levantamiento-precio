"use client";

// Campo de texto con sugerencias ("combobox" accesible, patrón ARIA 1.2).
//
// - Al escribir (desde 2 letras), muestra TODAS las coincidencias en una caja con
//   scroll propio, con el total arriba ("128 coincidencias"). Lo escrito se parte en
//   palabras y TODAS deben aparecer, en cualquier orden; primero las que EMPIEZAN con
//   lo escrito y luego las que lo CONTIENEN, sin distinguir mayúsculas ni acentos
//   (src/lib/capturas.ts → filtrarSugerencias).
// - Con cientos de coincidencias no se pintan todas de golpe: se pintan de 50 en 50 y
//   el siguiente bloque se agrega ANTES de llegar al final del scroll (cantidadAPintar).
//   El total que se muestra es siempre el real.
// - La caja mide como máximo 6 renglones o el 45 % de lo visible (lo que sea menor) y
//   tiene overscroll-behavior: contain (al llegar al final, no mueve la página).
// - Tocar una sugerencia llena el campo con ese valor (alElegir).
// - Si no hay coincidencia, o la persona sigue escribiendo, se respeta EXACTAMENTE
//   lo que escribió (alEscribir). Nunca obliga a elegir de la lista.
// - Teclado: flechas para moverse (la marcada siempre queda a la vista dentro del
//   scroll), Enter para elegir, Escape para cerrar. Enter sin sugerencia marcada llama
//   a alEnter (por ejemplo, pasar al siguiente campo).
// - Lectores de pantalla: role="combobox" + role="listbox", aria-expanded,
//   aria-activedescendant, aria-setsize / aria-posinset (el total real aunque no estén
//   todas pintadas) y un aviso de cuántas coincidencias hay.
// - Celular: tocar o deslizar la lista NO le quita el foco al campo (pointerdown y
//   mousedown sin acción en toda la caja), así no se cierra antes de tiempo. Letra de
//   18 px (más de 16 px: iOS no hace zoom), renglones de al menos 48 px (área táctil de
//   más de 44 px) y, al abrir el teclado, el campo sube cerca de la parte de arriba para
//   que la lista quede visible sobre el teclado (visualViewport mide lo que queda
//   visible sobre el teclado).

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  RENGLONES_VISIBLES,
  SUGERENCIAS_POR_BLOQUE,
  cantidadAPintar,
  filtrarSugerencias,
  textoCoincidencias,
} from "@/lib/capturas";

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
  campoRef?: React.RefObject<HTMLInputElement | null>;
  claseCampo: string;
  /** Enter sin una sugerencia marcada (por ejemplo, pasar al siguiente campo). */
  alEnter?: () => void;
  obligatorio?: boolean;
  /** id de un texto que también describe el campo (por ejemplo, un aviso). */
  describeExtra?: string;
};

/** Alto mínimo de un renglón (min-h-12 = 48 px). */
const ALTO_RENGLON = 48;
/** Alto del encabezado "128 coincidencias" más bordes y margen. */
const ALTO_ENCABEZADO = 44;
/** Cuando el scroll está a menos de esto del final, se pinta el siguiente bloque. */
const MARGEN_CARGA = ALTO_RENGLON * 8;

function altoVisible(): number {
  return window.visualViewport ? window.visualViewport.height : window.innerHeight;
}

/** Alto máximo de la lista: 6 renglones o el 45 % de lo visible, lo que sea menor. */
function altoMaximoLista(): number {
  return Math.max(ALTO_RENGLON * 2, Math.min(RENGLONES_VISIBLES * ALTO_RENGLON, Math.floor(altoVisible() * 0.45)));
}

/** Si la lista no cabe entre el campo y el teclado, sube el campo cerca de la parte de arriba. */
function hacerEspacio(campo: HTMLElement) {
  const vista = window.visualViewport;
  const arribaVisible = vista ? vista.offsetTop : 0;
  const caja = campo.getBoundingClientRect();
  const espacioAbajo = altoVisible() - (caja.bottom - arribaVisible);
  if (espacioAbajo < altoMaximoLista() + ALTO_ENCABEZADO) {
    campo.scrollIntoView({ block: "start", behavior: "smooth" });
  }
}

/** Evita que tocar o arrastrar la lista le quite el foco al campo (y la cierre). */
function sinQuitarFoco(e: React.PointerEvent | React.MouseEvent) {
  e.preventDefault();
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
  campoRef,
  claseCampo,
  alEnter,
  obligatorio,
  describeExtra,
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
  const total = sugerencias.length;
  const abierta = enfocado && listaPermitida && total > 0;
  const lista = useRef<HTMLUListElement | null>(null);

  // Cuántas se pintan: va ligado a ESTA lista de coincidencias; si cambia lo escrito,
  // se vuelve a empezar con un bloque (sin un efecto que reinicie el estado).
  const [pintado, setPintado] = useState<{ de: readonly string[]; n: number }>({ de: sugerencias, n: 0 });
  const pintadas =
    pintado.de === sugerencias ? Math.min(total, Math.max(pintado.n, SUGERENCIAS_POR_BLOQUE)) : Math.min(total, SUGERENCIAS_POR_BLOQUE);
  function pintar(n: number) {
    setPintado({ de: sugerencias, n });
  }

  /** Alto máximo de la caja (se recalcula al abrir o cerrar el teclado). */
  const [altoLista, setAltoLista] = useState(RENGLONES_VISIBLES * ALTO_RENGLON);

  // Mientras el campo tiene el foco, si el teclado cambia el área visible (se abre o
  // cambia de tamaño), se recalcula el alto de la lista y se revisa que quepa.
  useEffect(() => {
    if (!enfocado) return;
    const vista = window.visualViewport;
    const revisar = () => {
      setAltoLista(altoMaximoLista());
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

  // Lista nueva (cambió lo escrito): el scroll vuelve arriba.
  useLayoutEffect(() => {
    if (lista.current) lista.current.scrollTop = 0;
  }, [sugerencias]);

  // La sugerencia marcada con el teclado siempre queda a la vista DENTRO de la caja
  // (se mueve solo el scroll de la lista, no el de la página).
  useLayoutEffect(() => {
    const ul = lista.current;
    if (!ul || activa < 0) return;
    const li = ul.children[activa] as HTMLElement | undefined;
    if (!li) return;
    if (li.offsetTop < ul.scrollTop) ul.scrollTop = li.offsetTop;
    else if (li.offsetTop + li.offsetHeight > ul.scrollTop + ul.clientHeight) {
      ul.scrollTop = li.offsetTop + li.offsetHeight - ul.clientHeight;
    }
  }, [activa, pintadas]);

  function alDesplazar() {
    const ul = lista.current;
    if (!ul) return;
    const n = cantidadAPintar(pintadas, total, {
      distanciaAlFinal: ul.scrollHeight - ul.scrollTop - ul.clientHeight,
      margen: MARGEN_CARGA,
    });
    if (n !== pintadas) pintar(n);
  }

  function elegir(opcion: string) {
    alElegir(opcion);
    setListaPermitida(false);
    setActiva(-1);
  }

  /** Marca la sugerencia i (con el teclado); si está cerca del final pintado, pinta otro bloque. */
  function marcar(i: number) {
    setListaPermitida(true);
    setActiva(i);
    const n = cantidadAPintar(pintadas, total, { activa: i });
    if (n !== pintadas) pintar(n);
  }

  function alTecla(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      if (total === 0) return;
      e.preventDefault();
      // Si la lista estaba cerrada (después de Escape), primero solo se abre.
      if (!abierta) marcar(-1);
      else marcar(Math.min(activa + 1, total - 1));
    } else if (e.key === "ArrowUp") {
      if (total === 0) return;
      e.preventDefault();
      // Arriba de la primera: se regresa al texto escrito (ninguna marcada).
      marcar(Math.max(activa - 1, -1));
    } else if (e.key === "Enter") {
      if (abierta && activa >= 0 && activa < total) {
        e.preventDefault();
        elegir(sugerencias[activa]);
      } else if (alEnter) {
        e.preventDefault();
        setListaPermitida(false);
        setActiva(-1);
        alEnter();
      }
    } else if (e.key === "Escape") {
      if (abierta) {
        e.preventDefault();
        setListaPermitida(false);
        setActiva(-1);
      }
    }
  }

  const describe =
    [ayuda ? idAyuda : "", error ? idError : "", describeExtra ?? ""].filter(Boolean).join(" ") || undefined;

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
            if (campoRef) campoRef.current = el;
          }}
          id={idCampo}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={abierta}
          aria-controls={idLista}
          aria-activedescendant={abierta && activa >= 0 ? `${idLista}-${activa}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-required={obligatorio || undefined}
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
            setAltoLista(altoMaximoLista());
            hacerEspacio(e.currentTarget);
          }}
          onBlur={() => {
            setEnfocado(false);
            setActiva(-1);
          }}
          onKeyDown={alTecla}
          className={`${claseCampo} scroll-mt-12 ${error ? "border-error-borde" : ""}`}
        />
        {/* Toda la caja (encabezado y lista) no le quita el foco al campo al tocarla o
            arrastrarla: así no se cierra antes de tiempo en el celular. */}
        <div
          hidden={!abierta}
          onPointerDown={sinQuitarFoco}
          onMouseDown={sinQuitarFoco}
          className="absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-xl border-2 border-borde bg-fondo shadow-lg"
        >
          <p className="border-b-2 border-tarjeta-presionada bg-tarjeta px-4 py-2 text-base font-semibold text-texto-suave">
            {textoCoincidencias(total)}
          </p>
          <ul
            ref={lista}
            id={idLista}
            role="listbox"
            aria-label={`Sugerencias de ${etiqueta.toLowerCase()}`}
            onScroll={alDesplazar}
            style={{ maxHeight: altoLista }}
            className="overflow-y-auto overscroll-contain"
          >
            {abierta &&
              sugerencias.slice(0, pintadas).map((opcion, i) => (
                <li
                  key={opcion}
                  id={`${idLista}-${i}`}
                  role="option"
                  aria-selected={i === activa}
                  aria-setsize={total}
                  aria-posinset={i + 1}
                  onClick={() => elegir(opcion)}
                  className={`flex min-h-12 cursor-pointer items-center break-words border-b border-tarjeta-presionada px-4 py-2 text-lg last:border-b-0 ${
                    i === activa ? "bg-tarjeta-presionada" : "active:bg-tarjeta-presionada"
                  }`}
                >
                  {opcion}
                </li>
              ))}
          </ul>
        </div>
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
          ? `${textoCoincidencias(total)}. Usa las flechas para elegir.`
          : ""}
      </p>
    </div>
  );
}
