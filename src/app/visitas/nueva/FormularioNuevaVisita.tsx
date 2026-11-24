"use client";

// Formulario de nueva visita.
// Todo vive en la pantalla hasta tocar "Guardar visita": entonces se crea la
// visita de una sola vez, porque nadie puede cambiarla después desde la app (PLAN 4.3;
// solo el admin corrige la tienda, con una función aparte). La visita queda a nombre de
// quien entró: el servidor pone usuario_id solo (008); la app no lo manda.
// Se necesitan dos cosas: el competidor y la ubicación (obligatoria).

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Competidor, NuevaVisita } from "@/lib/tipos";
import type { Ubicacion } from "@/lib/ubicacion";
import BotonUbicacion from "./BotonUbicacion";
import TituloError from "@/components/TituloError";
import BotonEntrarOtraVez from "@/components/BotonEntrarOtraVez";
import { clasificarFalla, mensajeDeFalla, type Falla } from "@/lib/errores";

type OpcionCompetidor = Pick<Competidor, "id" | "nombre">;

type EstadoLista =
  | { tipo: "cargando" }
  | { tipo: "ok"; competidores: OpcionCompetidor[] }
  | { tipo: "error"; detalle: string };

export default function FormularioNuevaVisita() {
  const router = useRouter();
  const [lista, setLista] = useState<EstadoLista>({ tipo: "cargando" });
  const [intento, setIntento] = useState(0);

  // Competidor elegido.
  const [elegido, setElegido] = useState<{ id: number } | null>(null);

  // Ubicación del celular (latitud, longitud, precisión y momento).
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);

  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<Falla | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      const { data, error } = await supabase
        .from("competidores")
        .select("id, nombre")
        .eq("activo", true)
        .order("orden");

      if (cancelado) return;
      if (error) {
        setLista({ tipo: "error", detalle: error.message || "Error desconocido" });
      } else {
        setLista({ tipo: "ok", competidores: data });
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [intento]);

  function elegir(id: number) {
    setElegido({ id });
    setErrorGuardar(null);
  }

  async function guardar() {
    if (!elegido || !ubicacion || guardando) return;
    setGuardando(true);
    setErrorGuardar(null);

    const nueva: NuevaVisita = {
      competidor_id: elegido.id,
      latitud: ubicacion.latitud,
      longitud: ubicacion.longitud,
      precision_metros: ubicacion.precision_metros,
      ubicacion_at: ubicacion.ubicacion_at,
    };

    const { data, error, status } = await supabase
      .from("visitas")
      .insert(nueva)
      .select("id")
      .single();

    if (error) {
      // Red, sesión caducada o error de Supabase: cada uno con su mensaje (src/lib/errores.ts).
      setErrorGuardar(clasificarFalla(error, status));
      setGuardando(false);
      return;
    }

    // Se deja "guardando" en true: el botón sigue desactivado mientras cambia de pantalla.
    router.push(`/visitas/${data.id}`);
  }

  if (lista.tipo === "cargando") {
    return (
      <p className="caja-info">Cargando competidores…</p>
    );
  }

  if (lista.tipo === "error") {
    return (
      <div className="caja-error">
        <TituloError>No se pudieron cargar los competidores</TituloError>
        <p className="mt-1 text-base break-words">{lista.detalle}</p>
        <button
          type="button"
          onClick={() => {
            setLista({ tipo: "cargando" });
            setIntento((n) => n + 1);
          }}
          className="boton-gris mt-3 w-full rounded-xl px-4 py-3 text-lg font-semibold"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3" disabled={guardando}>
        <legend className="mb-3 text-xl font-semibold">1. ¿Qué tienda visitas?</legend>
        {lista.competidores.length === 0 && (
          <p className="caja-aviso">
            No hay competidores activos. Revisa supabase/seed_competidores.sql.
          </p>
        )}
        {lista.competidores.map((c) => {
          const activo = elegido?.id === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => elegir(c.id)}
              aria-pressed={activo}
              className={`rounded-xl border-2 px-4 py-4 text-left text-xl font-semibold ${
                activo
                  ? "border-marca bg-marca text-sobre-marca"
                  : "border-borde bg-tarjeta text-texto active:bg-tarjeta-presionada"
              }`}
            >
              {activo ? "✓ " : ""}
              {c.nombre}
            </button>
          );
        })}
      </fieldset>

      <BotonUbicacion
        ubicacion={ubicacion}
        onUbicacion={(u) => {
          setUbicacion(u);
          setErrorGuardar(null);
        }}
        desactivado={guardando}
      />

      {errorGuardar && (
        <div role="alert" className="caja-error">
          <TituloError>No se pudo guardar la visita</TituloError>
          <p className="mt-1 text-base break-words">{mensajeDeFalla(errorGuardar)}</p>
          {errorGuardar.tipo === "sesion" && <BotonEntrarOtraVez />}
        </div>
      )}

      <button
        type="button"
        onClick={guardar}
        disabled={!elegido || !ubicacion || guardando}
        className="boton-primario rounded-2xl px-6 py-5 text-2xl font-bold"
      >
        {guardando ? "Guardando…" : "Guardar visita"}
      </button>
      {(!elegido || !ubicacion) && (
        <p className="-mt-3 text-center text-base text-texto-suave">
          {!elegido && !ubicacion
            ? "Primero elige una tienda y guarda tu ubicación."
            : !elegido
              ? "Primero elige una tienda."
              : "Primero guarda tu ubicación."}
        </p>
      )}
    </div>
  );
}
