"use client";

// "Cambiar tienda", "Borrar visita" y (solo admin) "Restaurar visita"
// (supabase/012_editar_borrar.sql). Reemplaza a "Corregir tienda (admin)".
//
// QUIÉN PUEDE QUÉ (lo decide la base de datos; la pantalla solo lo explica):
//   - El dueño cambia la tienda o borra SU visita solo si ningún agente ha leído
//     sus fotos (todas siguen "pendiente"). La tienda nueva debe estar activa.
//   - El admin cambia la tienda, borra y restaura cualquier visita.
//   - BORRAR = descartar (descartada_at): no se borra nada. La visita deja de verse
//     para el personal de campo (con sus fotos y productos); solo el admin la
//     restaura.
//
// Todo se guarda con UN update directo (permiso solo de competidor_id y
// descartada_at). Si la base no deja (por ejemplo, justo leyeron una foto), el update
// afecta 0 filas: se revisa por qué, se explica sin tecnicismos y se vuelve a leer la
// visita.
//
// Admin y fotos leídas: puede cambiar la tienda, pero antes se le pide confirmar
// (TEXTO_CONFIRMAR_LEIDAS), porque cambia a qué competidor pertenecen esos precios.

import { useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatearFecha } from "@/lib/fechas";
import type { Competidor } from "@/lib/tipos";
import { clasificarFalla, fallaConCodigo, mensajeDeFalla, type Falla } from "@/lib/errores";
import TituloError, { IconoAlerta } from "@/components/TituloError";
import BotonEntrarOtraVez from "@/components/BotonEntrarOtraVez";
import DialogoConfirmar from "@/components/DialogoConfirmar";

type Opcion = Pick<Competidor, "id" | "nombre">;

type Props = {
  visitaId: string;
  competidorActualId: number;
  descartadaAt: string | null;
  esMia: boolean;
  esAdmin: boolean;
  /** Se llama después de cambiar la tienda o restaurar, para volver a leer la visita. */
  alCambiar: () => void;
};

/** Ya no se puede: el texto para la persona de campo. */
export const TEXTO_FOTOS_LEIDAS =
  "Esta visita ya no se puede cambiar ni borrar porque ya se leyeron los precios de sus fotos. Si hace falta corregirla, avisa al administrador.";

/** Admin: confirmación antes de cambiar la tienda de una visita con fotos ya leídas. */
export const TEXTO_CONFIRMAR_LEIDAS =
  "Esta visita ya tiene fotos leídas. Cambiar la tienda cambia a qué competidor pertenecen esos precios.";
const TEXTO_CONFIRMAR_SIN_SABER =
  "No se pudo revisar si esta visita ya tiene fotos leídas. Si las tiene, cambiar la tienda cambia a qué competidor pertenecen esos precios.";

type Mensaje = { tipo: "aviso"; texto: string } | { tipo: "falla"; inicio: string; falla: Falla };

/** ¿La visita tiene fotos que ya no están "pendiente"? (también las quitadas) */
async function tieneFotosLeidas(visitaId: string): Promise<boolean | null> {
  const { count, error } = await supabase
    .from("fotos")
    .select("id", { count: "exact", head: true })
    .eq("visita_id", visitaId)
    .neq("estado_proceso", "pendiente");
  if (error) return null;
  return (count ?? 0) > 0;
}

export default function AccionesVisita({
  visitaId,
  competidorActualId,
  descartadaAt,
  esMia,
  esAdmin,
  alCambiar,
}: Props) {
  const router = useRouter();
  /** Solo para el dueño (al admin no le aplica). null = no se sabe todavía. */
  const [bloqueada, setBloqueada] = useState<boolean | null>(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [opciones, setOpciones] = useState<Opcion[] | null>(null);
  const [elegido, setElegido] = useState(competidorActualId);
  const [preguntandoBorrar, setPreguntandoBorrar] = useState(false);
  /** Admin: texto de la pregunta "¿Cambiar la tienda?" (null = cerrada). */
  const [preguntaTienda, setPreguntaTienda] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);

  // Con cacheComponents la pantalla se esconde (no se desmonta): al volver, la
  // pregunta "¿Borrar esta visita?" aparece cerrada.
  useLayoutEffect(
    () => () => {
      setPreguntandoBorrar(false);
      setPreguntaTienda(null);
    },
    [],
  );

  const puedeActuar = esAdmin || esMia;

  // El dueño necesita saber si ya se leyeron fotos (el admin no).
  useEffect(() => {
    if (esAdmin || !esMia || descartadaAt) return;
    let cancelado = false;
    // Si no se pudo saber (por ejemplo, sin señal), se deja intentar: la base decide.
    tieneFotosLeidas(visitaId).then((r) => {
      if (!cancelado) setBloqueada(r ?? false);
    });
    return () => {
      cancelado = true;
    };
  }, [visitaId, esAdmin, esMia, descartadaAt]);

  // Tiendas activas, solo al abrir "Cambiar tienda".
  useEffect(() => {
    if (!eligiendo || opciones) return;
    let cancelado = false;
    supabase
      .from("competidores")
      .select("id, nombre")
      .eq("activo", true)
      .order("orden")
      .then(({ data, error, status }) => {
        if (cancelado) return;
        if (error) setMensaje({ tipo: "falla", inicio: "No se pudieron cargar las tiendas.", falla: clasificarFalla(error, status) });
        else setOpciones(data);
      });
    return () => {
      cancelado = true;
    };
  }, [eligiendo, opciones]);

  /** Error de un update: tienda inactiva (trigger), red, sesión o Supabase. */
  function falla(inicio: string, error: { code?: string; message?: string }, status?: number): Mensaje {
    if (error.code === "22023") {
      return { tipo: "aviso", texto: "Esa tienda ya no está activa. Elige otra." };
    }
    return { tipo: "falla", inicio, falla: clasificarFalla(error, status) };
  }

  /** 0 filas: ¿por qué? (fotos leídas, ya borrada o una regla que no deja). */
  async function explicarSinCambio(inicio: string): Promise<Mensaje> {
    if (!esAdmin) {
      const leidas = await tieneFotosLeidas(visitaId);
      if (leidas) {
        setBloqueada(true);
        return { tipo: "aviso", texto: TEXTO_FOTOS_LEIDAS };
      }
    }
    return { tipo: "falla", inicio, falla: fallaConCodigo("SIN-CAMBIO") };
  }

  /** "Guardar" la tienda nueva. Admin: si la visita tiene fotos leídas, primero pregunta. */
  async function pedirGuardarTienda() {
    if (guardando || elegido === competidorActualId) return;
    if (!esAdmin) {
      void guardarTienda();
      return;
    }
    setGuardando(true);
    setMensaje(null);
    const leidas = await tieneFotosLeidas(visitaId);
    setGuardando(false);
    if (leidas === false) void guardarTienda();
    else setPreguntaTienda(leidas ? TEXTO_CONFIRMAR_LEIDAS : TEXTO_CONFIRMAR_SIN_SABER);
  }

  async function guardarTienda() {
    setPreguntaTienda(null);
    if (guardando || elegido === competidorActualId) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const { data, error, status } = await supabase
        .from("visitas")
        .update({ competidor_id: elegido })
        .eq("id", visitaId)
        .select("id");
      if (error) setMensaje(falla("No se cambió la tienda.", error, status));
      else if (data.length === 0) {
        setMensaje(await explicarSinCambio("No se cambió la tienda."));
        alCambiar();
      } else {
        setEligiendo(false);
        alCambiar();
      }
    } catch (e) {
      setMensaje({ tipo: "falla", inicio: "No se cambió la tienda.", falla: clasificarFalla(e) });
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    setPreguntandoBorrar(false);
    if (guardando) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const { data, error, status } = await supabase
        .from("visitas")
        .update({ descartada_at: new Date().toISOString() })
        .eq("id", visitaId)
        .select("id");
      if (error) setMensaje(falla("No se borró la visita.", error, status));
      else if (data.length === 0) {
        setMensaje(await explicarSinCambio("No se borró la visita."));
        alCambiar();
      }
      // El admin se queda viendo la visita (marcada "Borrada"); el personal de campo
      // ya no la puede ver: regresa a su lista.
      else if (esAdmin) alCambiar();
      else router.push("/");
    } catch (e) {
      setMensaje({ tipo: "falla", inicio: "No se borró la visita.", falla: clasificarFalla(e) });
    } finally {
      setGuardando(false);
    }
  }

  async function restaurar() {
    if (guardando) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const { data, error, status } = await supabase
        .from("visitas")
        .update({ descartada_at: null })
        .eq("id", visitaId)
        .select("id");
      if (error) setMensaje(falla("No se restauró la visita.", error, status));
      else if (data.length === 0) {
        setMensaje({ tipo: "falla", inicio: "No se restauró la visita.", falla: fallaConCodigo("SIN-CAMBIO") });
        alCambiar();
      } else alCambiar();
    } catch (e) {
      setMensaje({ tipo: "falla", inicio: "No se restauró la visita.", falla: clasificarFalla(e) });
    } finally {
      setGuardando(false);
    }
  }

  if (!puedeActuar) return null;

  const cajaMensaje = mensaje && (
    <div role="alert" className={mensaje.tipo === "aviso" ? "caja-aviso" : "caja-error"}>
      {mensaje.tipo === "aviso" ? (
        <p className="flex items-start gap-2 font-semibold">
          <IconoAlerta className="mt-0.5" />
          <span>{mensaje.texto}</span>
        </p>
      ) : (
        <>
          <TituloError>
            {mensaje.falla.tipo === "supabase"
              ? mensajeDeFalla(mensaje.falla)
              : `${mensaje.inicio} ${mensajeDeFalla(mensaje.falla)}`}
          </TituloError>
          {mensaje.falla.tipo === "sesion" && <BotonEntrarOtraVez />}
        </>
      )}
    </div>
  );

  // --- Visita borrada (solo la ve el admin) ---
  if (descartadaAt) {
    return (
      <div className="flex flex-col gap-3">
        <div className="caja-aviso">
          <p className="flex items-start gap-2 font-semibold">
            <IconoAlerta className="mt-0.5" />
            <span>Borrada {formatearFecha(descartadaAt)}. El personal de campo ya no la ve.</span>
          </p>
          {esAdmin && (
            <button
              type="button"
              onClick={() => void restaurar()}
              disabled={guardando}
              className="boton-gris mt-3 min-h-12 w-full rounded-xl px-4 py-3 text-lg font-semibold"
            >
              {guardando ? "Restaurando…" : "Restaurar visita"}
            </button>
          )}
        </div>
        {cajaMensaje}
      </div>
    );
  }

  // --- Dueño con fotos ya leídas: ya no se puede ---
  if (!esAdmin && bloqueada) {
    return (
      <div className="flex flex-col gap-3">
        <p className="caja-info">{TEXTO_FOTOS_LEIDAS}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!eligiendo && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              setElegido(competidorActualId);
              setMensaje(null);
              setEligiendo(true);
            }}
            disabled={guardando || (!esAdmin && bloqueada === null)}
            className="boton-contorno min-h-12 rounded-xl px-3 py-3 text-lg font-semibold"
          >
            Cambiar tienda
          </button>
          <button
            type="button"
            onClick={() => {
              setMensaje(null);
              setPreguntandoBorrar(true);
            }}
            disabled={guardando || (!esAdmin && bloqueada === null)}
            className="boton-gris min-h-12 rounded-xl px-3 py-3 text-lg font-semibold"
          >
            {guardando ? "Borrando…" : "Borrar visita"}
          </button>
        </div>
      )}

      {eligiendo && (
        <fieldset
          disabled={guardando}
          className="flex flex-col gap-3 rounded-xl border-2 border-marca bg-tarjeta p-4"
        >
          <legend className="px-1 text-xl font-semibold">Cambiar tienda</legend>
          {!opciones && !mensaje && <p className="caja-info">Cargando tiendas…</p>}
          {opciones?.map((c) => {
            const activo = elegido === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setElegido(c.id)}
                aria-pressed={activo}
                className={`min-h-12 rounded-xl border-2 px-4 py-3 text-left text-lg font-semibold ${
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
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setEligiendo(false)}
              className="boton-gris min-h-12 rounded-xl px-4 py-3 text-lg font-semibold"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void pedirGuardarTienda()}
              disabled={guardando || !opciones || elegido === competidorActualId}
              className="boton-primario min-h-12 rounded-xl px-4 py-3 text-lg font-bold"
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </fieldset>
      )}

      {cajaMensaje}

      <DialogoConfirmar
        abierto={preguntaTienda !== null}
        titulo="¿Cambiar la tienda?"
        texto={preguntaTienda}
        textoConfirmar="Cambiar tienda"
        alConfirmar={() => void guardarTienda()}
        alCancelar={() => setPreguntaTienda(null)}
      />

      <DialogoConfirmar
        abierto={preguntandoBorrar}
        titulo="¿Borrar esta visita?"
        texto={
          esAdmin && !esMia
            ? "Dejará de verse para quien la creó, con sus fotos y productos. La puedes restaurar después."
            : "Ya no aparecerá en tu lista, con sus fotos y productos. Solo el administrador la puede recuperar."
        }
        textoConfirmar="Borrar"
        alConfirmar={() => void borrar()}
        alCancelar={() => setPreguntandoBorrar(false)}
      />
    </div>
  );
}
