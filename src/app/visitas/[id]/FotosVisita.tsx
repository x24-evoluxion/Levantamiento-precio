"use client";

// Sección "Fotos" de una visita: la zona para subir fotos (SubirFotos) y la
// galería con las fotos que ya están guardadas (GaleriaFotos).
//
// Este componente guarda la lista de fotos. Cuando SubirFotos termina una foto,
// la agrega aquí y aparece en la galería sin recargar la página.
//
// QUITAR UNA FOTO (descarte, 007). No se borra nada: la foto se marca con
// descartada_at y deja de mostrarse (se puede restaurar desde Supabase).
//   1. "Quitar" → si la foto ya no está pendiente, solo se explica por qué no se puede.
//   2. Si está pendiente → ventana "¿Quitar esta foto?" (ConfirmarQuitar).
//   3. "Sí, quitar" → la foto se esconde y abajo sale "Foto quitada. Deshacer".
//   4. A los 5 segundos se guarda el descarte en Supabase. Si antes toca
//      "Deshacer", no se guarda nada y la foto vuelve.
//   5. Si al guardar resulta que ya no se podía (por ejemplo, justo la mandaron
//      a leer precios), la foto vuelve y se explica por qué.
// Si sale de la pantalla antes de los 5 segundos, el descarte se guarda en ese
// momento (ya lo había confirmado).

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { EstadoProcesoFoto, Foto } from "@/lib/tipos";
import SubirFotos from "./SubirFotos";
import GaleriaFotos from "./GaleriaFotos";
import ConfirmarQuitar from "./ConfirmarQuitar";
import TituloError, { IconoAlerta } from "@/components/TituloError";

/** Tiempo para tocar "Deshacer" antes de que el descarte se guarde. */
const ESPERA_DESHACER_MS = 5000;

type Estado =
  | { tipo: "cargando" }
  | { tipo: "ok"; fotos: Foto[] }
  | { tipo: "error"; detalle: string };

/** Mensaje que se muestra arriba de la galería (se cierra con "Entendido"). */
type Aviso = { tipo: "aviso" | "error"; texto: string };

/** Resultado de intentar guardar un descarte. */
type Resultado = { tipo: "quitada" } | Aviso;

/** La más reciente primero, sin repetir (por si una foto llega dos veces). */
function ordenar(fotos: Foto[]): Foto[] {
  const unicas = new Map(fotos.map((f) => [f.id, f]));
  return [...unicas.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Por qué no se puede quitar una foto que ya no está pendiente. */
function textoNoSePuedeQuitar(estado: EstadoProcesoFoto): string {
  const motivo =
    estado === "en_lote"
      ? "ya se está leyendo para sacar sus precios"
      : estado === "procesada"
        ? "ya se leyeron sus precios"
        : "ya se intentó leer para sacar sus precios";
  return `Esta foto ya no se puede quitar porque ${motivo}. Si de verdad hay que quitarla, avisa al responsable del sistema.`;
}

/**
 * Guarda el descarte en Supabase. La hora que se manda no importa: el servidor
 * pone la suya. Si la regla de la base no deja (la foto ya no está pendiente),
 * Supabase no da error, solo no cambia ninguna fila; por eso se revisa cuántas
 * cambiaron y, si fue ninguna, se pregunta en qué estado está la foto.
 */
async function guardarDescarte(foto: Foto): Promise<Resultado> {
  try {
    const { data, error } = await supabase
      .from("fotos")
      .update({ descartada_at: new Date().toISOString() })
      .eq("id", foto.id)
      .select("id");
    if (error) throw error;
    if (data.length > 0) return { tipo: "quitada" };

    const { data: actual, error: errorLectura } = await supabase
      .from("fotos")
      .select("estado_proceso, descartada_at")
      .eq("id", foto.id)
      .maybeSingle();
    if (errorLectura) throw errorLectura;
    // Ya no existe o alguien más ya la quitó: el resultado es el mismo.
    if (!actual || actual.descartada_at) return { tipo: "quitada" };
    if (actual.estado_proceso !== "pendiente") {
      return { tipo: "aviso", texto: textoNoSePuedeQuitar(actual.estado_proceso) };
    }
    throw new Error("La foto no cambió");
  } catch {
    return {
      tipo: "error",
      texto: "No se pudo quitar la foto. Revisa tu conexión a internet e inténtalo otra vez.",
    };
  }
}

export default function FotosVisita({ visitaId }: { visitaId: string }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [intento, setIntento] = useState(0);
  /** Foto en la ventana "¿Quitar esta foto?"; null = ventana cerrada. */
  const [porConfirmar, setPorConfirmar] = useState<Foto | null>(null);
  /** Fotos quitadas que todavía se pueden deshacer (esperando los 5 segundos). */
  const [porQuitar, setPorQuitar] = useState<Foto[]>([]);
  /** Fotos cuyo descarte ya se guardó: no se vuelven a mostrar. */
  const [quitadas, setQuitadas] = useState<ReadonlySet<string>>(() => new Set());
  const [aviso, setAviso] = useState<Aviso | null>(null);
  /** Temporizador de 5 segundos de cada foto en "porQuitar". */
  const temporizadores = useRef(new Map<string, { foto: Foto; id: ReturnType<typeof setTimeout> }>());

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      const { data, error } = await supabase
        .from("fotos")
        .select("*")
        .eq("visita_id", visitaId)
        .is("descartada_at", null) // las fotos quitadas no se muestran
        .order("created_at", { ascending: false });

      if (cancelado) return;
      if (error) {
        setEstado({ tipo: "error", detalle: error.message || "Error desconocido" });
      } else {
        // Si mientras cargaba ya se subió alguna foto, no se pierde.
        setEstado((antes) => ({
          tipo: "ok",
          fotos: ordenar([...data, ...(antes.tipo === "ok" ? antes.fotos : [])]),
        }));
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [visitaId, intento]);

  const recargar = useCallback(() => setIntento((n) => n + 1), []);

  // SubirFotos avisa aquí cada vez que una foto queda guardada.
  // Si no trae la fila (por ejemplo, la registró un intento anterior), se vuelve a leer la lista.
  const alSubir = useCallback(
    (foto: Foto | null) => {
      if (!foto) {
        recargar();
        return;
      }
      setEstado((antes) =>
        antes.tipo === "ok" ? { tipo: "ok", fotos: ordenar([foto, ...antes.fotos]) } : antes,
      );
    },
    [recargar],
  );

  /** Pasaron los 5 segundos (o salió de la pantalla): se guarda el descarte. */
  const terminarEspera = useCallback(async (foto: Foto) => {
    temporizadores.current.delete(foto.id);
    const resultado = await guardarDescarte(foto);
    if (resultado.tipo === "quitada") {
      setQuitadas((antes) => new Set(antes).add(foto.id));
    } else {
      setAviso(resultado);
    }
    // Se quita del aviso "Deshacer". Si no se pudo guardar, la foto vuelve a la galería.
    setPorQuitar((lista) => lista.filter((f) => f.id !== foto.id));
  }, []);

  // Al salir de la pantalla, los descartes que estaban esperando se guardan ya.
  useEffect(() => {
    const mapa = temporizadores.current;
    return () => {
      for (const { foto, id } of mapa.values()) {
        clearTimeout(id);
        terminarEspera(foto);
      }
      mapa.clear();
    };
  }, [terminarEspera]);

  // Si cierra o recarga la página mientras puede deshacer, el navegador pregunta antes
  // (si se va de todas formas, la foto NO se quita).
  const esperando = porQuitar.length > 0;
  useEffect(() => {
    if (!esperando) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [esperando]);

  function alTocarQuitar(foto: Foto) {
    if (foto.estado_proceso !== "pendiente") {
      setAviso({ tipo: "aviso", texto: textoNoSePuedeQuitar(foto.estado_proceso) });
      return;
    }
    setAviso(null);
    setPorConfirmar(foto);
  }

  function alConfirmarQuitar(foto: Foto) {
    setPorConfirmar(null);
    if (temporizadores.current.has(foto.id)) return;
    setPorQuitar((lista) => [...lista, foto]);
    const id = setTimeout(() => terminarEspera(foto), ESPERA_DESHACER_MS);
    temporizadores.current.set(foto.id, { foto, id });
  }

  function deshacer(foto: Foto) {
    const t = temporizadores.current.get(foto.id);
    if (!t) return; // ya se estaba guardando
    clearTimeout(t.id);
    temporizadores.current.delete(foto.id);
    setPorQuitar((lista) => lista.filter((f) => f.id !== foto.id));
  }

  const escondidas = new Set([...quitadas, ...porQuitar.map((f) => f.id)]);
  const visibles = estado.tipo === "ok" ? estado.fotos.filter((f) => !escondidas.has(f.id)) : [];

  return (
    <section className={`flex flex-col gap-3 ${esperando ? "pb-28" : ""}`}>
      <h2 className="text-2xl font-bold">Fotos</h2>

      <SubirFotos visitaId={visitaId} alSubir={alSubir} />

      {estado.tipo === "cargando" && (
        <p className="caja-info">Cargando fotos…</p>
      )}

      {estado.tipo === "error" && (
        <div className="caja-error">
          <TituloError>No se pudieron cargar las fotos</TituloError>
          <p className="mt-1 text-base break-words">{estado.detalle}</p>
          <button
            type="button"
            onClick={() => {
              setEstado({ tipo: "cargando" });
              recargar();
            }}
            className="boton-gris mt-3 w-full rounded-xl px-4 py-3 text-lg font-semibold"
          >
            Reintentar
          </button>
        </div>
      )}

      {aviso && (
        <div role="alert" className={aviso.tipo === "error" ? "caja-error" : "caja-aviso"}>
          {aviso.tipo === "error" ? (
            <TituloError>{aviso.texto}</TituloError>
          ) : (
            <p className="flex items-start gap-2 font-semibold">
              <IconoAlerta className="mt-0.5" />
              <span>{aviso.texto}</span>
            </p>
          )}
          <button
            type="button"
            onClick={() => setAviso(null)}
            className="boton-gris mt-3 w-full rounded-xl px-4 py-3 text-lg font-semibold"
          >
            Entendido
          </button>
        </div>
      )}

      {estado.tipo === "ok" && <GaleriaFotos fotos={visibles} alQuitar={alTocarQuitar} />}

      <ConfirmarQuitar
        foto={porConfirmar}
        alConfirmar={alConfirmarQuitar}
        alCancelar={() => setPorConfirmar(null)}
      />

      {/* Aviso "Foto quitada. Deshacer", fijo abajo de la pantalla (uno por foto). */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-10 mx-auto flex w-full max-w-md flex-col gap-2 px-4 pb-4"
      >
        {porQuitar.map((f) => (
          <div
            key={f.id}
            className="pointer-events-auto flex items-center justify-between gap-3 rounded-xl bg-texto px-4 py-3 text-fondo shadow-lg"
          >
            <span className="text-lg font-semibold">Foto quitada.</span>
            <button
              type="button"
              onClick={() => deshacer(f)}
              className="min-h-11 rounded-lg bg-fondo px-4 py-2 text-lg font-bold text-texto active:bg-gris"
            >
              Deshacer
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
