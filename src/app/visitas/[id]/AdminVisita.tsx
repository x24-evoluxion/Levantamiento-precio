"use client";

// Opciones SOLO del administrador en una visita (supabase/013_admin_visitas.sql):
//   - "Cambiar responsable": pasa la visita a otra cuenta (admin_reasignar_visita). La
//     visita, con sus fotos y productos, deja de verla quien la tenía y la ve la persona
//     nueva. Productos y fotos siguen a nombre de quien los capturó.
//   - "Corregir ubicación": coordenadas escritas, un enlace de Google Maps pegado o "Usar
//     mi ubicación actual" (admin_corregir_ubicacion). La base guarda la ubicación
//     original del celular y quién corrigió; la visita queda marcada como corregida.
//
// Las dos piden confirmación. Las funciones revisan en la base que quien llama sea admin
// (si no: 42501). La app nunca escribe el dueño, la ubicación ni la auditoría con un
// update directo (no tiene permiso).

import { useLayoutEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSesion } from "@/lib/sesion";
import { leerCorreos, type Correos } from "@/lib/correos";
import { nombreVisible } from "@/lib/usuarios";
import { enlaceMapa, formatearPrecision, leerCoordenadas, pedirUbicacion } from "@/lib/ubicacion";
import { clasificarFalla, mensajeDeFalla, type Falla } from "@/lib/errores";
import TituloError, { IconoAlerta } from "@/components/TituloError";
import BotonEntrarOtraVez from "@/components/BotonEntrarOtraVez";
import DialogoConfirmar from "@/components/DialogoConfirmar";

type Props = {
  visitaId: string;
  duenoId: string | null;
  correos: Correos;
  /** Se llama después de un cambio (o si la visita ya no existe), para volver a leerla. */
  alCambiar: () => void;
};

type Mensaje = { tipo: "aviso"; texto: string } | { tipo: "falla"; inicio: string; falla: Falla };
type Panel = "ninguno" | "responsable" | "ubicacion";

/** Error de una función de admin → mensaje claro (42501, 22023, P0002) o el de siempre. */
function mensajeDeError(
  inicio: string,
  error: { code?: string; message?: string },
  status: number | undefined,
  datoInvalido: string,
): Mensaje {
  if (error.code === "42501") return { tipo: "aviso", texto: "Solo el administrador puede hacer esto." };
  if (error.code === "22023") return { tipo: "aviso", texto: datoInvalido };
  if (error.code === "P0002") {
    return { tipo: "aviso", texto: "Esta visita ya no existe. Se volvió a cargar la pantalla." };
  }
  return { tipo: "falla", inicio, falla: clasificarFalla(error, status) };
}

export default function AdminVisita({ visitaId, duenoId, correos: correosIniciales, alCambiar }: Props) {
  const { usuario } = useSesion();
  const [panel, setPanel] = useState<Panel>("ninguno");
  const [correos, setCorreos] = useState<Correos>(correosIniciales);
  const [cargandoCorreos, setCargandoCorreos] = useState(false);
  const [elegido, setElegido] = useState<string | null>(duenoId);
  const [textoUbicacion, setTextoUbicacion] = useState("");
  /** Precisión del GPS si se usó "Usar mi ubicación actual"; null si se escribió. */
  const [precision, setPrecision] = useState<number | null>(null);
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [pregunta, setPregunta] = useState<"responsable" | "ubicacion" | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);

  // Con cacheComponents la pantalla se esconde (no se desmonta): al volver, la pregunta
  // aparece cerrada.
  useLayoutEffect(() => () => setPregunta(null), []);

  const cuentas = useMemo(
    () =>
      correos
        ? [...correos.entries()]
            .map(([id, correo]) => ({ id, nombre: nombreVisible(correo) }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
        : [],
    [correos],
  );
  const nombreDe = (id: string | null) =>
    id === null ? "nadie (visita de antes del login)" : (cuentas.find((c) => c.id === id)?.nombre ?? "una cuenta desconocida");

  const coordenadas = leerCoordenadas(textoUbicacion);

  async function volverALeerCorreos() {
    setCargandoCorreos(true);
    const c = await leerCorreos();
    setCorreos(c);
    setCargandoCorreos(false);
  }

  function abrir(p: Panel) {
    setMensaje(null);
    setPanel((antes) => (antes === p ? "ninguno" : p));
    if (p === "responsable") setElegido(duenoId);
    if (p === "ubicacion") {
      setTextoUbicacion("");
      setPrecision(null);
    }
  }

  async function usarMiUbicacion() {
    setBuscandoGps(true);
    setMensaje(null);
    const r = await pedirUbicacion();
    setBuscandoGps(false);
    if (r.ok) {
      setTextoUbicacion(`${r.ubicacion.latitud.toFixed(6)}, ${r.ubicacion.longitud.toFixed(6)}`);
      setPrecision(r.ubicacion.precision_metros);
    } else {
      setMensaje({
        tipo: "aviso",
        texto:
          r.motivo === "sin-permiso"
            ? "El celular no dio permiso de ubicación. Escribe o pega las coordenadas."
            : "No se pudo obtener tu ubicación. Escribe o pega las coordenadas.",
      });
    }
  }

  async function reasignar() {
    setPregunta(null);
    if (guardando || !elegido || elegido === duenoId) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const { error, status } = await supabase.rpc("admin_reasignar_visita", {
        p_visita_id: visitaId,
        p_usuario_id: elegido,
      });
      if (error) {
        setMensaje(
          mensajeDeError("No se cambió el responsable.", error, status, "Esa cuenta ya no existe. Elige otra."),
        );
        if (error.code === "P0002") alCambiar();
      } else {
        setPanel("ninguno");
        alCambiar();
      }
    } catch (e) {
      setMensaje({ tipo: "falla", inicio: "No se cambió el responsable.", falla: clasificarFalla(e) });
    } finally {
      setGuardando(false);
    }
  }

  async function corregirUbicacion() {
    setPregunta(null);
    if (guardando || !coordenadas) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const { error, status } = await supabase.rpc("admin_corregir_ubicacion", {
        p_visita_id: visitaId,
        p_latitud: coordenadas.latitud,
        p_longitud: coordenadas.longitud,
        p_precision_metros: precision,
      });
      if (error) {
        setMensaje(
          mensajeDeError("No se corrigió la ubicación.", error, status, "Esas coordenadas no son válidas. Revísalas."),
        );
        if (error.code === "P0002") alCambiar();
      } else {
        setPanel("ninguno");
        alCambiar();
      }
    } catch (e) {
      setMensaje({ tipo: "falla", inicio: "No se corrigió la ubicación.", falla: clasificarFalla(e) });
    } finally {
      setGuardando(false);
    }
  }

  if (!usuario.esAdmin) return null;

  const claseCampo =
    "w-full min-h-12 rounded-xl border-2 border-borde bg-fondo px-3 py-2 text-lg text-texto outline-offset-2 focus-visible:outline-3 focus-visible:outline-marca placeholder:text-texto-desactivado";

  return (
    <section aria-labelledby="titulo-admin-visita" className="flex flex-col gap-3">
      <h2 id="titulo-admin-visita" className="text-lg font-semibold text-texto-suave">
        Opciones de administrador
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => abrir("responsable")}
          aria-expanded={panel === "responsable"}
          disabled={guardando}
          className="boton-contorno min-h-12 rounded-xl px-3 py-3 text-lg font-semibold"
        >
          Cambiar responsable
        </button>
        <button
          type="button"
          onClick={() => abrir("ubicacion")}
          aria-expanded={panel === "ubicacion"}
          disabled={guardando}
          className="boton-contorno min-h-12 rounded-xl px-3 py-3 text-lg font-semibold"
        >
          Corregir ubicación
        </button>
      </div>

      {panel === "responsable" && (
        <fieldset disabled={guardando} className="flex flex-col gap-3 rounded-xl border-2 border-marca bg-tarjeta p-4">
          <legend className="px-1 text-xl font-semibold">Cambiar responsable</legend>
          <p className="text-base text-texto-suave">
            La visita, con sus fotos y productos, la verá solo la persona que elijas.
          </p>
          {!correos && (
            <div className="caja-aviso">
              <p className="font-semibold">No se pudo leer la lista de cuentas.</p>
              <button
                type="button"
                onClick={() => void volverALeerCorreos()}
                disabled={cargandoCorreos}
                className="boton-gris mt-3 min-h-12 w-full rounded-xl px-4 py-2 text-lg font-semibold"
              >
                {cargandoCorreos ? "Cargando…" : "Volver a cargar"}
              </button>
            </div>
          )}
          {cuentas.map((c) => {
            const activo = elegido === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setElegido(c.id)}
                aria-pressed={activo}
                className={`min-h-12 rounded-xl border-2 px-4 py-3 text-left text-lg font-semibold break-words ${
                  activo
                    ? "border-marca bg-marca text-sobre-marca"
                    : "border-borde bg-fondo text-texto active:bg-tarjeta-presionada"
                }`}
              >
                {activo ? "✓ " : ""}
                {c.nombre}
                {c.id === duenoId ? " (actual)" : ""}
                {c.id === usuario.id ? " (tú)" : ""}
              </button>
            );
          })}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPanel("ninguno")}
              className="boton-gris min-h-12 rounded-xl px-4 py-3 text-lg font-semibold"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => setPregunta("responsable")}
              disabled={!elegido || elegido === duenoId}
              className="boton-primario min-h-12 rounded-xl px-4 py-3 text-lg font-bold"
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </fieldset>
      )}

      {panel === "ubicacion" && (
        <fieldset disabled={guardando} className="flex flex-col gap-3 rounded-xl border-2 border-marca bg-tarjeta p-4">
          <legend className="px-1 text-xl font-semibold">Corregir ubicación</legend>
          <label htmlFor="corregir-ubicacion" className="text-lg font-semibold">
            Coordenadas o enlace de Google Maps
          </label>
          <input
            id="corregir-ubicacion"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={textoUbicacion}
            onChange={(e) => {
              setTextoUbicacion(e.target.value);
              setPrecision(null);
            }}
            placeholder="19.4326, -99.1332"
            aria-describedby="ayuda-corregir-ubicacion"
            className={claseCampo}
          />
          <p id="ayuda-corregir-ubicacion" className="text-base text-texto-suave">
            Escribe &quot;latitud, longitud&quot; o pega el enlace de un punto en Google Maps.
          </p>
          <button
            type="button"
            onClick={() => void usarMiUbicacion()}
            disabled={buscandoGps}
            className="boton-gris min-h-12 rounded-xl px-4 py-2 text-lg font-semibold"
          >
            {buscandoGps ? "Buscando tu ubicación…" : "Usar mi ubicación actual"}
          </button>
          {textoUbicacion.trim() !== "" &&
            (coordenadas ? (
              <p className="text-base">
                Nueva: <span className="font-semibold">{coordenadas.latitud}, {coordenadas.longitud}</span>
                {precision !== null && ` (${formatearPrecision(precision)})`} ·{" "}
                <a
                  href={enlaceMapa(coordenadas.latitud, coordenadas.longitud)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="enlace"
                >
                  Revisar en el mapa
                </a>
              </p>
            ) : (
              <p className="text-base font-semibold text-error-texto">
                No se entienden esas coordenadas. Ejemplo: 19.4326, -99.1332
              </p>
            ))}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPanel("ninguno")}
              className="boton-gris min-h-12 rounded-xl px-4 py-3 text-lg font-semibold"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => setPregunta("ubicacion")}
              disabled={!coordenadas}
              className="boton-primario min-h-12 rounded-xl px-4 py-3 text-lg font-bold"
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </fieldset>
      )}

      {mensaje && (
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
      )}

      <DialogoConfirmar
        abierto={pregunta === "responsable"}
        titulo="¿Cambiar el responsable?"
        texto={
          <>
            <p>
              La visita pasará de <span className="font-semibold">{nombreDe(duenoId)}</span> a{" "}
              <span className="font-semibold">{nombreDe(elegido)}</span>.
            </p>
            <p className="mt-1">
              Quien la tenía ya no la verá. Los productos y fotos siguen a nombre de quien los capturó.
            </p>
          </>
        }
        textoConfirmar="Cambiar responsable"
        alConfirmar={() => void reasignar()}
        alCancelar={() => setPregunta(null)}
      />

      <DialogoConfirmar
        abierto={pregunta === "ubicacion"}
        titulo="¿Corregir la ubicación?"
        texto="La visita quedará marcada como corregida por ti. La ubicación original del celular se conserva."
        textoConfirmar="Corregir ubicación"
        alConfirmar={() => void corregirUbicacion()}
        alCancelar={() => setPregunta(null)}
      />
    </section>
  );
}
