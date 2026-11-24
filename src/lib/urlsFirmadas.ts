"use client";

// Links de las fotos con "URL firmada" (2026-11-24).
//
// Qué es: un link temporal a un archivo de Storage, con una firma que Supabase
// revisa. Solo se puede pedir si las reglas dejan a esa persona leer el archivo
// (sus visitas; el admin, todas). Funciona igual con el bucket público (antes de la
// migración B) y privado (después).
//
// Duran 24 horas (decisión del usuario). ⚠️ Mientras no caduque, un link copiado
// abre la foto para cualquiera que lo tenga, aunque no tenga sesión.
//
// Cómo se renuevan: se guardan en memoria con su hora de caducidad. Cuando a un link
// le falta menos de 1 hora para caducar, se pide uno nuevo. Se revisa:
//   - al pedir fotos nuevas,
//   - con un temporizador programado para antes de la primera caducidad,
//   - al volver a la pestaña (el celular pausa los temporizadores cuando se bloquea),
//   - si una imagen no carga (por si el link ya no sirve): se pide otra vez, una vez.
// La memoria se borra al cerrar sesión (la página se recarga).

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { BUCKET_FOTOS } from "./tipos";

/** Cuánto dura cada link (segundos). */
export const DURACION_URL_FIRMADA_S = 24 * 60 * 60;
/** Se pide un link nuevo cuando al actual le queda menos que esto. */
const MARGEN_RENOVAR_MS = 60 * 60 * 1000;
/** Si un archivo no existe, no se vuelve a preguntar hasta dentro de 5 min. */
const ESPERA_NO_DISPONIBLE_MS = 5 * 60 * 1000;
/** Si falló la petición (por ejemplo, sin internet), se reintenta a los 30 s. */
const ESPERA_REINTENTO_MS = 30 * 1000;
/** Rutas por petición (para no mandar una lista enorme de golpe). */
const RUTAS_POR_PETICION = 100;

/** url = null → el archivo no está disponible (no existe o no hay permiso). */
type Entrada = { url: string | null; renovarEn: number };

const memoria = new Map<string, Entrada>();

function necesitaLink(ruta: string, ahora: number): boolean {
  const e = memoria.get(ruta);
  return !e || e.renovarEn <= ahora;
}

async function pedirLinks(rutas: string[]): Promise<void> {
  for (let i = 0; i < rutas.length; i += RUTAS_POR_PETICION) {
    const grupo = rutas.slice(i, i + RUTAS_POR_PETICION);
    const pedidoEn = Date.now();
    const { data, error } = await supabase.storage
      .from(BUCKET_FOTOS)
      .createSignedUrls(grupo, DURACION_URL_FIRMADA_S);
    if (error) throw error;
    const recibidas = new Set<string>();
    for (const d of data) {
      if (!d.path) continue;
      recibidas.add(d.path);
      memoria.set(
        d.path,
        d.signedUrl && !d.error
          ? { url: d.signedUrl, renovarEn: pedidoEn + DURACION_URL_FIRMADA_S * 1000 - MARGEN_RENOVAR_MS }
          : { url: null, renovarEn: pedidoEn + ESPERA_NO_DISPONIBLE_MS },
      );
    }
    for (const ruta of grupo) {
      if (!recibidas.has(ruta)) memoria.set(ruta, { url: null, renovarEn: pedidoEn + ESPERA_NO_DISPONIBLE_MS });
    }
  }
}

export type UrlsFirmadas = {
  /** Link de la foto; undefined = todavía no llega; null = no disponible. */
  urlDe: (ruta: string) => string | null | undefined;
  /** true si la última petición de links falló (por ejemplo, sin internet). */
  fallo: boolean;
  /** Llamar desde <img onError>: pide un link nuevo para esa foto (una sola vez). */
  alFallarImagen: (ruta: string) => void;
};

export function useUrlsFirmadas(rutas: readonly string[]): UrlsFirmadas {
  // Una "clave" de texto para que el efecto solo se repita si cambian las rutas.
  const clave = [...new Set(rutas)].sort().join("\n");
  const [, setVersion] = useState(0);
  const [fallo, setFallo] = useState(false);
  const [intento, setIntento] = useState(0);
  /** Links que ya fallaron en una <img>: no se reintentan otra vez (evita ciclos). */
  const linksFallidos = useRef(new Set<string>());

  useEffect(() => {
    const lista = clave ? clave.split("\n") : [];
    let cancelado = false;
    let temporizador: ReturnType<typeof setTimeout> | undefined;

    async function revisar() {
      clearTimeout(temporizador);
      if (cancelado || lista.length === 0) return;
      let espera: number;
      const faltan = lista.filter((r) => necesitaLink(r, Date.now()));
      try {
        if (faltan.length > 0) await pedirLinks(faltan);
        if (cancelado) return;
        setFallo(false);
        const proxima = Math.min(...lista.map((r) => memoria.get(r)?.renovarEn ?? Date.now()));
        espera = Math.max(proxima - Date.now(), 1000);
      } catch {
        if (cancelado) return;
        setFallo(true);
        espera = ESPERA_REINTENTO_MS;
      }
      if (faltan.length > 0) setVersion((v) => v + 1);
      temporizador = setTimeout(revisar, espera);
    }

    function alVolver() {
      if (document.visibilityState === "visible") revisar();
    }

    revisar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      cancelado = true;
      clearTimeout(temporizador);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [clave, intento]);

  const urlDe = useCallback((ruta: string) => memoria.get(ruta)?.url, []);

  const alFallarImagen = useCallback((ruta: string) => {
    const url = memoria.get(ruta)?.url;
    if (!url || linksFallidos.current.has(url)) return;
    linksFallidos.current.add(url);
    memoria.delete(ruta);
    setIntento((n) => n + 1);
  }, []);

  return { urlDe, fallo, alFallarImagen };
}
