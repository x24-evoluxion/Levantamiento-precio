"use client";

// Datos de una visita, la zona para subir fotos y la galería de fotos.
// La base de datos solo deja ver visitas propias (el admin, todas): si alguien abre
// el link de una visita de otra persona, la consulta no regresa nada y se muestra
// "no existe". El admin ve además quién la creó.
// Arriba van "Cambiar tienda" y "Borrar visita" (AccionesVisita, 012): el dueño, si
// ningún agente leyó sus fotos; el admin, siempre. Una visita borrada solo la ve el
// admin, marcada "Borrada" y con "Restaurar visita".
// Debajo de las fotos va la sección opcional de captura manual (CapturaManual).
// 013: el admin tiene además "Cambiar responsable" y "Corregir ubicación" (AdminVisita) y
// ve el último cambio (quién y cuándo). Si la ubicación fue corregida, TODOS ven
// "Ubicación corregida por administrador" con la fecha y la ubicación original del
// celular; el admin ve también quién la corrigió.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatearFecha } from "@/lib/fechas";
import { useSesion } from "@/lib/sesion";
import { leerCorreos, textoCreador, type Correos } from "@/lib/correos";
import type { Visita } from "@/lib/tipos";
import { enlaceMapa, formatearPrecision } from "@/lib/ubicacion";
import FotosVisita from "./FotosVisita";
import AccionesVisita from "./AccionesVisita";
import AdminVisita from "./AdminVisita";
import CapturaManual from "./CapturaManual";
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
  // "?? null": con una base sin 013 las columnas no llegan (undefined).
  const corregidaAt = v.ubicacion_corregida_at ?? null;
  const origLat = v.ubicacion_original_latitud ?? null;
  const origLon = v.ubicacion_original_longitud ?? null;
  const origPrecision = v.ubicacion_original_precision_metros ?? null;
  const cambioAt = v.actualizado_at ?? null;
  /** Quién (para el admin): usuario, o "desde el panel de Supabase" si no hubo sesión. */
  const quien = (id: string | null | undefined) =>
    id ? textoCreador(id, estado.correos, usuario) : "desde el panel de Supabase";
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">{v.competidores?.nombre ?? "Competidor desconocido"}</h1>

      <AccionesVisita
        // key: al cambiar la tienda o borrar/restaurar, empieza de nuevo con lo actual.
        key={`${v.competidor_id}-${v.descartada_at ?? ""}`}
        visitaId={v.id}
        competidorActualId={v.competidor_id}
        descartadaAt={v.descartada_at}
        esMia={v.usuario_id === usuario.id}
        esAdmin={esAdmin}
        alCambiar={() => setIntento((n) => n + 1)}
      />

      {esAdmin && (
        <AdminVisita
          // key: después de un cambio, empieza de nuevo con lo actual.
          key={`${v.usuario_id ?? ""}-${v.latitud ?? ""}-${v.longitud ?? ""}`}
          visitaId={v.id}
          duenoId={v.usuario_id}
          correos={estado.correos}
          alCambiar={() => setIntento((n) => n + 1)}
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
        {esAdmin && cambioAt && (
          <div>
            <dt className="text-base text-texto-suave">Último cambio</dt>
            <dd className="text-lg break-words">
              {formatearFecha(cambioAt)} · {quien(v.actualizado_por)}
            </dd>
          </div>
        )}
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
          {corregidaAt && (
            <dd className="mt-2 rounded-lg border-2 border-aviso-borde bg-aviso-fondo px-3 py-2 text-base text-aviso-texto">
              <span className="block font-bold">📍 Ubicación corregida por administrador</span>
              <span className="block break-words">
                {formatearFecha(corregidaAt)}
                {esAdmin && ` · ${quien(v.ubicacion_corregida_por)}`}
              </span>
              {origLat != null && origLon != null ? (
                <span className="block">
                  Original del celular
                  {origPrecision != null && ` (${formatearPrecision(origPrecision)})`}:{" "}
                  <a
                    href={enlaceMapa(origLat, origLon)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="enlace"
                  >
                    ver en el mapa
                  </a>
                </span>
              ) : (
                <span className="block">El celular no había guardado ubicación.</span>
              )}
            </dd>
          )}
        </div>
      </dl>

      <FotosVisita visitaId={v.id} visitaBorrada={v.descartada_at !== null} />

      {/* Opcional: datos del levantamiento escritos a mano (010–012). Solo quien creó la
          visita escribe; el admin ve los de cualquier visita y los edita o borra. */}
      <CapturaManual
        visitaId={v.id}
        esMia={v.usuario_id === usuario.id}
        visitaBorrada={v.descartada_at !== null}
      />
    </section>
  );
}
