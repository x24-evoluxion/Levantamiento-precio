"use client";

// SOLO ADMIN: corregir la tienda de una visita (si el personal eligió la equivocada).
// No cambia la tabla directamente: llama a la función de la base
// admin_cambiar_competidor (supabase/008_autenticacion.sql), que primero revisa que
// quien la llama sea admin y que la tienda nueva esté activa.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Competidor } from "@/lib/tipos";
import TituloError from "@/components/TituloError";
import { clasificarFalla, mensajeDeFalla } from "@/lib/errores";

type Opcion = Pick<Competidor, "id" | "nombre">;

type Props = {
  visitaId: string;
  competidorActualId: number;
  /** Se llama después de guardar, para volver a leer la visita. */
  alGuardar: () => void;
};

function mensajeError(error: { message?: string; code?: string }, estado?: number): string {
  if (error.code === "42501") return "Solo el administrador puede corregir la tienda.";
  if (error.code === "22023") return "Esa tienda ya no está activa. Elige otra.";
  if (error.code === "P0002") return "La visita ya no existe.";
  // Red, sesión caducada o cualquier otro error de Supabase (con su código).
  return mensajeDeFalla(clasificarFalla(error, estado));
}

export default function CorregirTienda({ visitaId, competidorActualId, alGuardar }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [opciones, setOpciones] = useState<Opcion[] | null>(null);
  const [elegido, setElegido] = useState<number>(competidorActualId);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto || opciones) return;
    let cancelado = false;
    supabase
      .from("competidores")
      .select("id, nombre")
      .eq("activo", true)
      .order("orden")
      .then(({ data, error }) => {
        if (cancelado) return;
        if (error) setError(mensajeError(error));
        else setOpciones(data);
      });
    return () => {
      cancelado = true;
    };
  }, [abierto, opciones]);

  function abrir() {
    setElegido(competidorActualId);
    setError(null);
    setAbierto(true);
  }

  async function guardar() {
    if (guardando || elegido === competidorActualId) return;
    setGuardando(true);
    setError(null);
    const { error, status } = await supabase.rpc("admin_cambiar_competidor", {
      p_visita_id: visitaId,
      p_competidor_id: elegido,
    });
    setGuardando(false);
    if (error) {
      setError(mensajeError(error, status));
      return;
    }
    setAbierto(false);
    alGuardar();
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={abrir}
        className="boton-contorno rounded-xl px-4 py-3 text-lg font-semibold"
      >
        Corregir tienda (admin)
      </button>
    );
  }

  return (
    <fieldset
      disabled={guardando}
      className="flex flex-col gap-3 rounded-xl border-2 border-marca bg-tarjeta p-4"
    >
      <legend className="px-1 text-xl font-semibold">Corregir tienda</legend>

      {!opciones && !error && <p className="caja-info">Cargando tiendas…</p>}

      {opciones?.map((c) => {
        const activo = elegido === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => setElegido(c.id)}
            aria-pressed={activo}
            className={`rounded-xl border-2 px-4 py-3 text-left text-lg font-semibold ${
              activo
                ? "border-marca bg-marca text-sobre-marca"
                : "border-borde bg-fondo text-texto active:bg-tarjeta-presionada"
            }`}
          >
            {activo ? "✓ " : ""}
            {c.nombre}
            {c.id === competidorActualId ? " (actual)" : ""}
          </button>
        );
      })}

      {error && (
        <div role="alert" className="caja-error">
          <TituloError>{error}</TituloError>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="boton-gris rounded-xl px-4 py-3 text-lg font-semibold"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={guardando || !opciones || elegido === competidorActualId}
          className="boton-primario rounded-xl px-4 py-3 text-lg font-bold"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </fieldset>
  );
}
