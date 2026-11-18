"use client";

// Lista de visitas (la más reciente primero). Se lee desde el navegador cada vez
// que se abre la página, para que siempre salgan las visitas nuevas.

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatearFecha } from "@/lib/fechas";

type FilaVisita = {
  id: string;
  created_at: string;
  competidores: { nombre: string } | null;
};

type Estado =
  | { tipo: "cargando" }
  | { tipo: "ok"; visitas: FilaVisita[] }
  | { tipo: "error"; detalle: string };

export default function ListaVisitas() {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      const { data, error } = await supabase
        .from("visitas")
        .select("id, created_at, competidores(nombre)")
        .order("created_at", { ascending: false });

      if (cancelado) return;
      if (error) {
        setEstado({ tipo: "error", detalle: error.message || "Error desconocido" });
      } else {
        setEstado({ tipo: "ok", visitas: data });
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [intento]);

  function reintentar() {
    setEstado({ tipo: "cargando" });
    setIntento((n) => n + 1);
  }

  if (estado.tipo === "cargando") {
    return <p className="rounded-xl bg-zinc-100 p-4 text-lg text-zinc-700">Cargando visitas…</p>;
  }

  if (estado.tipo === "error") {
    return (
      <div className="rounded-xl bg-red-100 p-4 text-lg text-red-900">
        <p className="font-semibold">❌ No se pudieron cargar las visitas</p>
        <p className="mt-1 text-base break-words">{estado.detalle}</p>
        <button
          type="button"
          onClick={reintentar}
          className="mt-3 w-full rounded-xl bg-red-700 px-4 py-3 text-lg font-semibold text-white active:bg-red-800"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (estado.visitas.length === 0) {
    return (
      <p className="rounded-xl bg-zinc-100 p-4 text-lg text-zinc-700">
        Todavía no hay visitas. Toca &quot;Nueva visita&quot; para registrar la primera.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {estado.visitas.map((v) => (
        <li key={v.id}>
          <Link
            href={`/visitas/${v.id}`}
            className="block rounded-xl border-2 border-zinc-200 bg-white p-4 text-zinc-900 active:bg-zinc-100"
          >
            <p className="text-xl font-semibold">
              {v.competidores?.nombre ?? "Competidor desconocido"}
            </p>
            <p className="mt-1 text-base text-zinc-600">{formatearFecha(v.created_at)}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
