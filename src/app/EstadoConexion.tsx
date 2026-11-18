"use client";

// Componente PROVISIONAL (Fase 1): comprueba desde el navegador que la app
// puede hablar con Supabase. Se reemplaza en la Fase 3 por la lista de visitas.

import { useEffect, useState } from "react";

type Estado =
  | { tipo: "cargando" }
  | { tipo: "ok"; detalle: string }
  | { tipo: "error"; detalle: string };

export default function EstadoConexion() {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });

  useEffect(() => {
    async function comprobar() {
      try {
        // Se importa aquí para poder mostrar el error si faltan las variables.
        const { supabase } = await import("@/lib/supabase");

        // Consulta de prueba. La tabla aún no existe (se crea en la Fase 2),
        // así que un error "la tabla no existe" también prueba que Supabase
        // respondió y que la llave es válida.
        const { error } = await supabase
          .from("competidores")
          .select("id", { head: true, count: "exact" });

        if (!error) {
          setEstado({ tipo: "ok", detalle: "Conectado. La tabla competidores ya existe." });
        } else if (error.code === "PGRST205" || error.code === "42P01") {
          setEstado({
            tipo: "ok",
            detalle: "Conectado. Las tablas todavía no existen (se crean en la Fase 2).",
          });
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
        <p className="mt-1 text-base">{estado.detalle}</p>
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
