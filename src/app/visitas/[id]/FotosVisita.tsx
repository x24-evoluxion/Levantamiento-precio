"use client";

// Sección "Fotos" de una visita: la zona para subir fotos (SubirFotos) y la
// galería con las fotos que ya están guardadas (GaleriaFotos).
//
// Este componente guarda la lista de fotos. Cuando SubirFotos termina una foto,
// la agrega aquí y aparece en la galería sin recargar la página.
//
// QUITAR UNA FOTO (descarte, 007). No se borra nada: la foto se marca con
// descartada_at y deja de mostrarse (se puede restaurar desde Supabase).
//   1. Botón ✕ "Quitar foto" → si la foto ya no está pendiente, solo se explica
//      por qué no se puede.
//   2. Si está pendiente → ventana "¿Quitar esta foto?" (ConfirmarQuitar).
//      "Cancelar" (o Escape) → no pasa nada.
//   3. "Quitar" → se guarda el descarte en Supabase en ese momento. Mientras se
//      guarda, la foto sigue a la vista con su botón desactivado (no se puede
//      tocar dos veces).
//   4. Si se guardó → la foto desaparece y baja el número de fotos.
//      Si falló, o ya no se podía (por ejemplo, justo la mandaron a leer
//      precios) → la foto sigue a la vista y se explica por qué.

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { EstadoProcesoFoto, Foto } from "@/lib/tipos";
import SubirFotos from "./SubirFotos";
import GaleriaFotos from "./GaleriaFotos";
import ConfirmarQuitar from "./ConfirmarQuitar";
import TituloError, { IconoAlerta } from "@/components/TituloError";

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
  /** Fotos cuyo descarte se está guardando (su botón queda desactivado). */
  const [guardando, setGuardando] = useState<ReadonlySet<string>>(() => new Set());
  /** Fotos cuyo descarte ya se guardó: no se vuelven a mostrar (aunque se recargue la lista). */
  const [quitadas, setQuitadas] = useState<ReadonlySet<string>>(() => new Set());
  const [aviso, setAviso] = useState<Aviso | null>(null);
  /** Texto para lectores de pantalla ("Foto quitada."). */
  const [anuncio, setAnuncio] = useState("");

  // Con cacheComponents, Next.js esconde esta pantalla (no la desmonta) al ir a
  // otra. Si se fue con la ventana "¿Quitar esta foto?" abierta, al volver
  // aparece cerrada (ver la doc de Next: preserving-ui-state.md).
  useLayoutEffect(() => () => setPorConfirmar(null), []);

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

  function alTocarQuitar(foto: Foto) {
    if (foto.estado_proceso !== "pendiente") {
      setAviso({ tipo: "aviso", texto: textoNoSePuedeQuitar(foto.estado_proceso) });
      return;
    }
    setAviso(null);
    setPorConfirmar(foto);
  }

  async function alConfirmarQuitar(foto: Foto) {
    setPorConfirmar(null);
    if (guardando.has(foto.id)) return;
    setAnuncio("");
    setGuardando((antes) => new Set(antes).add(foto.id));
    const resultado = await guardarDescarte(foto);
    if (resultado.tipo === "quitada") {
      setQuitadas((antes) => new Set(antes).add(foto.id));
      setAnuncio("Foto quitada.");
    } else {
      setAviso(resultado);
    }
    setGuardando((antes) => {
      const despues = new Set(antes);
      despues.delete(foto.id);
      return despues;
    });
  }

  const visibles = estado.tipo === "ok" ? estado.fotos.filter((f) => !quitadas.has(f.id)) : [];

  return (
    <section className="flex flex-col gap-3">
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

      {estado.tipo === "ok" && (
        <GaleriaFotos fotos={visibles} alQuitar={alTocarQuitar} guardando={guardando} />
      )}

      <ConfirmarQuitar
        foto={porConfirmar}
        alConfirmar={alConfirmarQuitar}
        alCancelar={() => setPorConfirmar(null)}
      />

      <p role="status" aria-live="polite" className="sr-only">
        {anuncio}
      </p>
    </section>
  );
}
