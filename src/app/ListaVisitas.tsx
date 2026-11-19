"use client";

// Lista de visitas (la más reciente primero). Se lee desde el navegador cada vez
// que se abre la página, para que siempre salgan las visitas nuevas.
// "fotos(count)" le pide a Supabase el número de fotos de cada visita en la misma consulta.

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatearFecha } from "@/lib/fechas";
import TituloError from "@/components/TituloError";

type FilaVisita = {
  id: string;
  created_at: string;
  competidores: { nombre: string } | null;
  fotos: { count: number }[];
};

function textoFotos(visita: FilaVisita): string {
  const n = visita.fotos[0]?.count ?? 0;
  if (n === 0) return "Sin fotos";
  return n === 1 ? "📷 1 foto" : `📷 ${n} fotos`;
}

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
        .select("id, created_at, competidores(nombre), fotos(count)")
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
    return <p className="caja-info">Cargando visitas…</p>;
  }

  if (estado.tipo === "error") {
    return (
      <div className="caja-error">
        <TituloError>No se pudieron cargar las visitas</TituloError>
        <p className="mt-1 text-base break-words">{estado.detalle}</p>
        <button
          type="button"
          onClick={reintentar}
          className="boton-gris mt-3 w-full rounded-xl px-4 py-3 text-lg font-semibold"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (estado.visitas.length === 0) {
    return (
      <p className="caja-info">
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
            className="block rounded-xl border-2 border-borde bg-tarjeta p-4 text-texto active:bg-tarjeta-presionada"
          >
            <p className="text-xl font-semibold">
              {v.competidores?.nombre ?? "Competidor desconocido"}
            </p>
            <p className="mt-1 text-base text-texto-suave">{formatearFecha(v.created_at)}</p>
            <p className="mt-1 text-base font-semibold text-texto">{textoFotos(v)}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
