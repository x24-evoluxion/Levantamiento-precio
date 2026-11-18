"use client";

// Componente PROVISIONAL (Fases 1 y 2): comprueba desde el navegador que la app
// puede hablar con Supabase y lee los competidores activos.
// Se reemplaza en la Fase 3 por la lista de visitas.

import { useEffect, useState } from "react";
import type { Competidor } from "@/lib/tipos";

type Estado =
  | { tipo: "cargando" }
  | { tipo: "ok"; competidores: Pick<Competidor, "id" | "nombre">[] }
  | { tipo: "sin-tablas" }
  | { tipo: "error"; detalle: string };

export default function EstadoConexion() {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });

  useEffect(() => {
    async function comprobar() {
      try {
        // Se importa aquí para poder mostrar el error si faltan las variables.
        const { supabase } = await import("@/lib/supabase");

        const { data, error } = await supabase
          .from("competidores")
          .select("id, nombre")
          .eq("activo", true)
          .order("orden");

        if (!error) {
          setEstado({ tipo: "ok", competidores: data });
        } else if (error.code === "PGRST205" || error.code === "42P01") {
          // "La tabla no existe": falta ejecutar supabase/001_esquema.sql.
          setEstado({ tipo: "sin-tablas" });
        } else {
          setEstado({ tipo: "error", detalle: error.message || "Error desconocido" });
        }
      } catch (e) {
        setEstado({
          tipo: "error",
          detalle: e instanceof Error ? e.message : "Error desconocido",
        });
      }
    }
    comprobar();
  }, []);

  if (estado.tipo === "cargando") {
    return (
      <p className="rounded-xl bg-zinc-100 p-4 text-lg text-zinc-700">
        Comprobando conexión con Supabase…
      </p>
    );
  }

  if (estado.tipo === "ok") {
    return (
      <div className="rounded-xl bg-green-100 p-4 text-lg text-green-900">
        <p className="font-semibold">✅ Conexión con Supabase: funciona</p>
        <p className="mt-1 text-base">
          Competidores activos: {estado.competidores.length}
        </p>
        <ul className="mt-2 list-disc pl-6 text-base">
          {estado.competidores.map((c) => (
            <li key={c.id}>{c.nombre}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (estado.tipo === "sin-tablas") {
    return (
      <div className="rounded-xl bg-yellow-100 p-4 text-lg text-yellow-900">
        <p className="font-semibold">⚠️ Conectado, pero faltan las tablas</p>
        <p className="mt-1 text-base">
          Ejecuta supabase/001_esquema.sql y supabase/seed_competidores.sql en el
          SQL Editor de Supabase.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-red-100 p-4 text-lg text-red-900">
      <p className="font-semibold">❌ No se pudo conectar con Supabase</p>
      <p className="mt-1 text-base break-words">{estado.detalle}</p>
    </div>
  );
}
