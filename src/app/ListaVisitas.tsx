"use client";

// Lista de visitas (la más reciente primero). Se lee desde el navegador cada vez
// que se abre la página, para que siempre salgan las visitas nuevas.
// Cada persona ve SOLO sus visitas (lo decide la base de datos, 008). El admin ve
// todas y, en cada una, quién la creó.
// "fotos(count)" le pide a Supabase el número de fotos de cada visita en la misma consulta.
// El filtro "fotos.descartada_at is null" hace que ese número NO cuente las fotos quitadas
// (solo filtra las fotos que se cuentan; las visitas salen todas).

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatearFecha } from "@/lib/fechas";
import { useSesion } from "@/lib/sesion";
import { leerCorreos, textoCreador, type Correos } from "@/lib/correos";
import TituloError from "@/components/TituloError";

/** Título de la sección: "Mis visitas" o, para el admin, "Todas las visitas". */
export function TituloVisitas() {
  const { usuario } = useSesion();
  return (
    <h2 className="text-xl font-semibold">{usuario.esAdmin ? "Todas las visitas" : "Mis visitas"}</h2>
  );
}

type FilaVisita = {
  id: string;
  created_at: string;
  usuario_id: string | null;
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
  | { tipo: "ok"; visitas: FilaVisita[]; correos: Correos }
  | { tipo: "error"; detalle: string };

export default function ListaVisitas() {
  const { usuario } = useSesion();
  const esAdmin = usuario.esAdmin;
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      const { data, error } = await supabase
        .from("visitas")
        .select("id, created_at, usuario_id, competidores(nombre), fotos(count)")
        .is("fotos.descartada_at", null)
        .order("created_at", { ascending: false });
      // Solo el admin pide los correos (a cualquier otra cuenta la base se los niega).
      const correos = !error && esAdmin ? await leerCorreos() : null;

      if (cancelado) return;
      if (error) {
        setEstado({ tipo: "error", detalle: error.message || "Error desconocido" });
      } else {
        setEstado({ tipo: "ok", visitas: data, correos });
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [intento, esAdmin]);

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
        {esAdmin
          ? "Todavía no hay visitas."
          : "Todavía no tienes visitas. Toca \u201cNueva visita\u201d para registrar la primera."}
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
            {esAdmin && (
              <p className="mt-1 text-base break-words text-texto-suave">
                👤 {textoCreador(v.usuario_id, estado.correos, usuario)}
              </p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
