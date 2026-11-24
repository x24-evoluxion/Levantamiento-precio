"use client";

// Datos de una visita, la zona para subir fotos y la galería de fotos.
// La base de datos solo deja ver visitas propias (el admin, todas): si alguien abre
// el link de una visita de otra persona, la consulta no regresa nada y se muestra
// "no existe". El admin ve además quién la creó y puede corregir la tienda.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatearFecha } from "@/lib/fechas";
import { useSesion } from "@/lib/sesion";
import { leerCorreos, textoCreador, type Correos } from "@/lib/correos";
import type { Visita } from "@/lib/tipos";
import { enlaceMapa, formatearPrecision } from "@/lib/ubicacion";
import FotosVisita from "./FotosVisita";
import CorregirTienda from "./CorregirTienda";
import TituloError from "@/components/TituloError";

type VisitaConCompetidor = Visita & { competidores: { nombre: string } | null };

type Estado =
  | { tipo: "cargando" }
  | { tipo: "ok"; visita: VisitaConCompetidor; correos: Correos }
  | { tipo: "no-existe" }
  | { tipo: "error"; detalle: string };

// Un id que no tiene forma de UUID haría fallar la consulta en Postgres;
// mejor decir "no existe" sin preguntar.
const FORMA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function DetalleVisita({ id }: { id: string }) {
  const { usuario } = useSesion();
  const esAdmin = usuario.esAdmin;
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
      const correos = data && esAdmin ? await leerCorreos() : null;

      if (cancelado) return;
      if (error) {
        setEstado({ tipo: "error", detalle: error.message || "Error desconocido" });
      } else if (!data) {
        setEstado({ tipo: "no-existe" });
      } else {
        setEstado({ tipo: "ok", visita: data, correos });
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [id, intento, esAdmin]);

  if (estado.tipo === "cargando") {
    return <p className="caja-info">Cargando visita…</p>;
  }

  if (estado.tipo === "no-existe") {
    return (
      <div className="caja-aviso">
        <p className="font-semibold">⚠️ Esta visita no existe o no es tuya</p>
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

      {esAdmin && (
        <CorregirTienda
          // key: al cambiar la tienda, el formulario empieza de nuevo con la actual.
          key={v.competidor_id}
          visitaId={v.id}
          competidorActualId={v.competidor_id}
          alGuardar={() => setIntento((n) => n + 1)}
        />
      )}

      <dl className="flex flex-col gap-3 rounded-xl border-2 border-borde bg-tarjeta p-4 text-texto">
        {esAdmin && (
          <div>
            <dt className="text-base text-texto-suave">Creada por</dt>
            <dd className="text-lg font-semibold break-words">
              {textoCreador(v.usuario_id, estado.correos, usuario)}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-base text-texto-suave">Visita guardada</dt>
          <dd className="text-lg font-semibold">{formatearFecha(v.created_at)}</dd>
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
