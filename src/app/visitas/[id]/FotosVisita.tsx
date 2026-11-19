"use client";

// Sección "Fotos" de una visita: la zona para subir fotos (SubirFotos) y la
// galería con las fotos que ya están guardadas (GaleriaFotos).
//
// Este componente guarda la lista de fotos. Cuando SubirFotos termina una foto,
// la agrega aquí y aparece en la galería sin recargar la página.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Foto } from "@/lib/tipos";
import SubirFotos from "./SubirFotos";
import GaleriaFotos from "./GaleriaFotos";
import TituloError from "@/components/TituloError";

type Estado =
  | { tipo: "cargando" }
  | { tipo: "ok"; fotos: Foto[] }
  | { tipo: "error"; detalle: string };

/** La más reciente primero, sin repetir (por si una foto llega dos veces). */
function ordenar(fotos: Foto[]): Foto[] {
  const unicas = new Map(fotos.map((f) => [f.id, f]));
  return [...unicas.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export default function FotosVisita({ visitaId }: { visitaId: string }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      const { data, error } = await supabase
        .from("fotos")
        .select("*")
        .eq("visita_id", visitaId)
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

      {estado.tipo === "ok" && <GaleriaFotos fotos={estado.fotos} />}
    </section>
  );
}
