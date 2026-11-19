"use client";

// Datos de una visita, la zona para subir fotos y la galería de fotos.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatearFecha } from "@/lib/fechas";
import type { Visita } from "@/lib/tipos";
import { enlaceMapa, formatearPrecision } from "@/lib/ubicacion";
import FotosVisita from "./FotosVisita";
import TituloError from "@/components/TituloError";

type VisitaConCompetidor = Visita & { competidores: { nombre: string } | null };

type Estado =
  | { tipo: "cargando" }
  | { tipo: "ok"; visita: VisitaConCompetidor }
  | { tipo: "no-existe" }
  | { tipo: "error"; detalle: string };

// Un id que no tiene forma de UUID haría fallar la consulta en Postgres;
// mejor decir "no existe" sin preguntar.
const FORMA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function DetalleVisita({ id }: { id: string }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      if (!FORMA_UUID.test(id)) {
        setEstado({ tipo: "no-existe" });
        return;
      }

      const { data, error } = await supabase
        .from("visitas")
        .select("*, competidores(nombre)")
        .eq("id", id)
        .maybeSingle();

      if (cancelado) return;
      if (error) {
        setEstado({ tipo: "error", detalle: error.message || "Error desconocido" });
      } else if (!data) {
        setEstado({ tipo: "no-existe" });
      } else {
        setEstado({ tipo: "ok", visita: data });
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [id, intento]);

  if (estado.tipo === "cargando") {
    return <p className="caja-info">Cargando visita…</p>;
  }

  if (estado.tipo === "no-existe") {
    return (
      <div className="caja-aviso">
        <p className="font-semibold">⚠️ Esta visita no existe</p>
        <p className="mt-1 text-base">Regresa a la lista y elige otra.</p>
      </div>
    );
  }

  if (estado.tipo === "error") {
    return (
      <div className="caja-error">
        <TituloError>No se pudo cargar la visita</TituloError>
        <p className="mt-1 text-base break-words">{estado.detalle}</p>
        <button
          type="button"
          onClick={() => {
            setEstado({ tipo: "cargando" });
            setIntento((n) => n + 1);
          }}
          className="boton-gris mt-3 w-full rounded-xl px-4 py-3 text-lg font-semibold"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const v = estado.visita;
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">{v.competidores?.nombre ?? "Competidor desconocido"}</h1>

      <dl className="flex flex-col gap-3 rounded-xl border-2 border-borde bg-tarjeta p-4 text-texto">
        <div>
          <dt className="text-base text-texto-suave">Visita guardada</dt>
          <dd className="text-lg font-semibold">{formatearFecha(v.created_at)}</dd>
        </div>
        <div>
          <dt className="text-base text-texto-suave">Competidor elegido</dt>
          <dd className="text-lg font-semibold">{formatearFecha(v.competidor_elegido_at)}</dd>
        </div>
        <div>
          <dt className="text-base text-texto-suave">Ubicación</dt>
          {v.latitud != null && v.longitud != null ? (
            <dd className="text-lg">
              <span className="font-semibold">
                {v.precision_metros != null ? formatearPrecision(v.precision_metros) : "Precisión desconocida"}
              </span>
              {v.ubicacion_at && (
                <span className="block text-base text-texto-suave">
                  Guardada {formatearFecha(v.ubicacion_at)}
                </span>
              )}
              <a
                href={enlaceMapa(v.latitud, v.longitud)}
                target="_blank"
                rel="noopener noreferrer"
                className="enlace mt-1 inline-block"
              >
                Ver en el mapa
              </a>
            </dd>
          ) : (
            <dd className="text-lg font-semibold text-texto-suave">Sin ubicación</dd>
          )}
        </div>
      </dl>

      <FotosVisita visitaId={v.id} />
    </section>
  );
}
