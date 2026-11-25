"use client";

// Sección OPCIONAL "Datos del levantamiento (manual)" de una visita
// (supabase/010_capturas_manuales.sql). La persona escribe una fila por producto.
// Sirven después para comparar contra lo que lean los agentes; en esta fase NINGÚN
// agente las lee.
//
// - Empieza cerrada (salvo que haya un borrador). Al abrirla se cargan UNA vez las
//   listas de sugerencias (áreas del catálogo y marcas ya capturadas, solo nombres)
//   y las filas ya guardadas de esta visita. Las sugerencias se filtran aquí, en el
//   celular.
// - Filas nuevas: tarjetas con "+ Agregar producto", "Duplicar fila" y "Quitar".
//   "Guardar datos" manda TODAS en UNA sola operación: o se guardan todas o ninguna.
// - Borrador: lo escrito se guarda en el celular (localStorage) por persona y por
//   visita, para no perderlo si se va la señal. Al salir con filas sin guardar, se
//   avisa (pestaña: beforeunload; enlace "Volver a la lista": EnlaceVolver.tsx).
// - Filas guardadas: solo lectura. Su autor las puede "Quitar" (descarte, no se
//   borra). Corregir = quitar y volver a escribir.
// - Quién escribe: solo en visitas PROPIAS (la base lo exige). El admin ve las filas
//   de cualquier visita, pero escribe solo en las suyas.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSesion } from "@/lib/sesion";
import { formatearFecha } from "@/lib/fechas";
import type { CapturaManual as FilaGuardada } from "@/lib/tipos";
import {
  CONDICIONES,
  MAX_ARTICULO,
  MAX_MARCA_AREA,
  MAX_OBSERVACIONES,
  NOMBRE_CONDICION,
  NOMBRE_PROMO,
  NOMBRE_UNIDAD,
  ORDEN_CAMPOS,
  PROMO_TIPOS,
  UNIDADES,
  avisosFila,
  duplicarFila,
  filaParaGuardar,
  filaTieneDatos,
  filaVacia,
  formatearPesos,
  guardarBorrador,
  leerBorrador,
  marcarPendientes,
  textoContenido,
  textoPromocion,
  validarFila,
  type CampoFila,
  type FilaBorrador,
} from "@/lib/capturas";
import { clasificarFalla, fallaConCodigo, mensajeDeFalla, type Falla } from "@/lib/errores";
import CampoSugerencias from "@/components/CampoSugerencias";
import TituloError, { IconoAlerta } from "@/components/TituloError";
import BotonEntrarOtraVez from "@/components/BotonEntrarOtraVez";

// Letra de 18 px en todos los campos (más de 16 px: iOS no hace zoom) y al menos
// 48 px de alto (área táctil de más de 44 px).
const CLASE_CAMPO =
  "w-full min-h-12 rounded-xl border-2 border-borde bg-fondo px-3 py-2 text-lg text-texto outline-offset-2 focus-visible:outline-3 focus-visible:outline-marca";

type Listas = { areas: string[]; marcas: string[] };

type EstadoListas =
  | { tipo: "cargando" }
  | { tipo: "ok"; listas: Listas }
  // Sin sugerencias se puede capturar igual: solo se avisa.
  | { tipo: "error" };

type EstadoGuardadas =
  | { tipo: "cargando" }
  | { tipo: "ok"; filas: FilaGuardada[] }
  | { tipo: "error"; detalle: string };

type Mensaje =
  | { tipo: "exito"; texto: string }
  | { tipo: "aviso"; texto: string }
  | { tipo: "falla"; inicio: string; falla: Falla };

const SIN_LISTAS: Listas = { areas: [], marcas: [] };

export default function CapturaManual({ visitaId, esMia }: { visitaId: string; esMia: boolean }) {
  const { usuario } = useSesion();

  // Borrador de esta persona en esta visita (si lo hay, la sección empieza abierta).
  const [inicio] = useState(() => (esMia ? leerBorrador(usuario.id, visitaId) : []));
  const [abierta, setAbierta] = useState(inicio.length > 0);
  const [filas, setFilas] = useState<FilaBorrador[]>(inicio);
  /** Se muestran los errores después del primer intento de guardar. */
  const [mostrarErrores, setMostrarErrores] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);

  const [listas, setListas] = useState<EstadoListas>({ tipo: "cargando" });
  const [guardadas, setGuardadas] = useState<EstadoGuardadas>({ tipo: "cargando" });
  const [intentoGuardadas, setIntentoGuardadas] = useState(0);
  /** Fila guardada con la pregunta "¿Quitar este producto?" abierta. */
  const [porQuitar, setPorQuitar] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<ReadonlySet<string>>(() => new Set());
  const [anuncio, setAnuncio] = useState("");

  /** Campos en pantalla, para llevar el foco al primer error o a una fila nueva. */
  const campos = useRef(new Map<string, HTMLElement>());
  /** Campo al que llevar el foco; "vez" cambia siempre, así se repite aunque sea el mismo. */
  const [enfocar, setEnfocar] = useState<{ campo: string; vez: number } | null>(null);
  const pedirFoco = (campo: string) => setEnfocar((antes) => ({ campo, vez: (antes?.vez ?? 0) + 1 }));

  // Con cacheComponents, Next.js esconde (no desmonta) esta pantalla al ir a otra.
  // Si se fue con la pregunta "¿Quitar este producto?" abierta, al volver aparece
  // cerrada (doc de Next: preserving-ui-state.md).
  useLayoutEffect(() => () => setPorQuitar(null), []);

  /** "nada" → "pidiendo" → "listo". Las sugerencias se piden una sola vez. */
  const pedidoListas = useRef<"nada" | "pidiendo" | "listo">("nada");

  // Listas de sugerencias: se piden UNA vez, al abrir la sección.
  useEffect(() => {
    if (!abierta || pedidoListas.current !== "nada") return;
    pedidoListas.current = "pidiendo";
    let cancelado = false;
    async function cargar() {
      try {
        const { data, error } = await supabase.rpc("sugerencias_captura");
        if (cancelado) return;
        pedidoListas.current = "listo";
        if (error) {
          setListas({ tipo: "error" });
          return;
        }
        const areas = data.filter((s) => s.tipo === "area").map((s) => s.valor);
        const marcas = data.filter((s) => s.tipo === "marca").map((s) => s.valor);
        setListas({ tipo: "ok", listas: { areas, marcas } });
      } catch {
        if (cancelado) return;
        pedidoListas.current = "listo";
        setListas({ tipo: "error" });
      }
    }
    cargar();
    return () => {
      cancelado = true;
      // Si la pantalla se escondió ANTES de terminar, se vuelve a pedir al regresar.
      if (pedidoListas.current === "pidiendo") pedidoListas.current = "nada";
    };
  }, [abierta]);

  // Filas ya guardadas de esta visita (vigentes).
  useEffect(() => {
    if (!abierta) return;
    let cancelado = false;
    async function cargar() {
      const { data, error } = await supabase
        .from("capturas_manuales")
        .select("*")
        .eq("visita_id", visitaId)
        .is("descartada_at", null)
        .order("created_at", { ascending: true });
      if (cancelado) return;
      if (error) setGuardadas({ tipo: "error", detalle: error.message || "Error desconocido" });
      else setGuardadas({ tipo: "ok", filas: data });
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, [abierta, visitaId, intentoGuardadas]);

  // Borrador: cada cambio se guarda en el celular.
  useEffect(() => {
    if (esMia) guardarBorrador(usuario.id, visitaId, filas);
  }, [esMia, usuario.id, visitaId, filas]);

  // Aviso antes de salir con filas sin guardar.
  const hayPendientes = filas.some(filaTieneDatos);
  useEffect(() => {
    marcarPendientes(visitaId, hayPendientes);
    if (!hayPendientes) return () => marcarPendientes(visitaId, false);
    const alSalir = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Navegadores viejos necesitan returnValue para mostrar el aviso.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", alSalir);
    return () => {
      window.removeEventListener("beforeunload", alSalir);
      marcarPendientes(visitaId, false);
    };
  }, [visitaId, hayPendientes]);

  // Llevar el foco a un campo (primer error o fila nueva) después de dibujarlo.
  useEffect(() => {
    if (!enfocar) return;
    const el = campos.current.get(enfocar.campo);
    if (el) {
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [enfocar]);

  function refCampo(clave: string, campo: CampoFila | "acciones") {
    return (el: HTMLElement | null) => {
      const k = `${clave}:${campo}`;
      if (el) campos.current.set(k, el);
      else campos.current.delete(k);
    };
  }

  function cambiar(clave: string, cambios: Partial<FilaBorrador>) {
    setFilas((antes) => antes.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)));
  }

  function agregar() {
    const nueva = filaVacia();
    setFilas((antes) => [...antes, nueva]);
    setMensaje(null);
    pedirFoco(`${nueva.clave}:articulo`);
  }

  function duplicar(fila: FilaBorrador) {
    const copia = duplicarFila(fila);
    setFilas((antes) => {
      const i = antes.findIndex((f) => f.clave === fila.clave);
      return [...antes.slice(0, i + 1), copia, ...antes.slice(i + 1)];
    });
    pedirFoco(`${copia.clave}:articulo`);
    setAnuncio("Fila duplicada.");
  }

  function quitarFilaNueva(fila: FilaBorrador) {
    if (filaTieneDatos(fila) && !window.confirm("¿Quitar este producto? Lo que escribiste en él se pierde.")) {
      return;
    }
    setFilas((antes) => antes.filter((f) => f.clave !== fila.clave));
    setAnuncio("Producto quitado de la lista.");
  }

  async function guardar() {
    if (guardando) return;
    setMensaje(null);
    const aGuardar = filas.filter(filaTieneDatos);
    if (aGuardar.length === 0) {
      setMensaje({ tipo: "aviso", texto: "No hay productos escritos para guardar." });
      return;
    }

    setMostrarErrores(true);
    const conError = aGuardar
      .map((f) => ({ fila: f, errores: validarFila(f) }))
      .filter((x) => Object.keys(x.errores).length > 0);
    if (conError.length > 0) {
      const primera = conError[0];
      const campo = ORDEN_CAMPOS.find((c) => primera.errores[c]) ?? "articulo";
      setMensaje({
        tipo: "aviso",
        texto:
          conError.length === 1
            ? "Revisa los datos marcados en rojo (1 producto). No se guardó nada."
            : `Revisa los datos marcados en rojo (${conError.length} productos). No se guardó nada.`,
      });
      pedirFoco(`${primera.fila.clave}:${campo}`);
      return;
    }

    setGuardando(true);
    try {
      // UN solo insert con todas las filas: Postgres lo hace todo o nada.
      const { data, error, status } = await supabase
        .from("capturas_manuales")
        .insert(aGuardar.map((f) => filaParaGuardar(visitaId, f)))
        .select();
      if (error) {
        setMensaje({ tipo: "falla", inicio: "No se guardaron los datos.", falla: clasificarFalla(error, status) });
      } else if (!data || data.length !== aGuardar.length) {
        // Respondió sin las filas esperadas: se recarga la lista para ver qué quedó.
        setMensaje({ tipo: "falla", inicio: "No se guardaron los datos.", falla: fallaConCodigo("SIN-FILAS") });
        setIntentoGuardadas((n) => n + 1);
      } else {
        setFilas([]);
        setMostrarErrores(false);
        setGuardadas((antes) =>
          antes.tipo === "ok" ? { tipo: "ok", filas: [...antes.filas, ...data] } : { tipo: "ok", filas: data },
        );
        const n = data.length;
        setMensaje({
          tipo: "exito",
          texto: n === 1 ? "Se guardó 1 producto." : `Se guardaron ${n} productos.`,
        });
        // Las marcas nuevas también sirven de sugerencia desde ya.
        setListas((antes) => {
          if (antes.tipo !== "ok") return antes;
          const marcas = new Set(antes.listas.marcas);
          for (const f of data) if (f.marca) marcas.add(f.marca);
          return { tipo: "ok", listas: { ...antes.listas, marcas: [...marcas] } };
        });
      }
    } catch (e) {
      setMensaje({ tipo: "falla", inicio: "No se guardaron los datos.", falla: clasificarFalla(e) });
    } finally {
      setGuardando(false);
    }
  }

  async function quitarGuardada(fila: FilaGuardada) {
    setPorQuitar(null);
    if (quitando.has(fila.id)) return;
    setMensaje(null);
    setAnuncio("");
    setQuitando((antes) => new Set(antes).add(fila.id));
    try {
      const { data, error, status } = await supabase
        .from("capturas_manuales")
        .update({ descartada_at: new Date().toISOString() })
        .eq("id", fila.id)
        .select("id");
      if (error) {
        setMensaje({ tipo: "falla", inicio: "No se pudo quitar el producto.", falla: clasificarFalla(error, status) });
      } else if (data.length === 0) {
        // Supabase respondió bien pero no cambió nada (ya estaba quitada, o la regla
        // no deja porque no es tuya).
        setMensaje({ tipo: "falla", inicio: "No se pudo quitar el producto.", falla: fallaConCodigo("SIN-CAMBIO") });
        setIntentoGuardadas((n) => n + 1);
      } else {
        setGuardadas((antes) =>
          antes.tipo === "ok" ? { tipo: "ok", filas: antes.filas.filter((f) => f.id !== fila.id) } : antes,
        );
        setAnuncio("Producto quitado.");
      }
    } catch (e) {
      setMensaje({ tipo: "falla", inicio: "No se pudo quitar el producto.", falla: clasificarFalla(e) });
    } finally {
      setQuitando((antes) => {
        const despues = new Set(antes);
        despues.delete(fila.id);
        return despues;
      });
    }
  }

  const sugerencias = listas.tipo === "ok" ? listas.listas : SIN_LISTAS;
  const numGuardadas = guardadas.tipo === "ok" ? guardadas.filas.length : 0;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="titulo-captura">
      <h2 id="titulo-captura" className="text-2xl font-bold">
        <button
          type="button"
          aria-expanded={abierta}
          aria-controls="contenido-captura"
          onClick={() => setAbierta((a) => !a)}
          className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border-2 border-borde bg-tarjeta px-4 py-3 text-left active:bg-tarjeta-presionada"
        >
          <span>
            Datos del levantamiento (manual)
            <span className="block text-base font-normal text-texto-suave">
              Opcional. Una fila por producto.
              {hayPendientes && " Tienes datos sin guardar."}
            </span>
          </span>
          <span aria-hidden className="text-xl">
            {abierta ? "▲" : "▼"}
          </span>
        </button>
      </h2>

      <div id="contenido-captura" hidden={!abierta} className="flex flex-col gap-4">
        {abierta && (
          <>
            {/* --- Filas ya guardadas (solo lectura) --- */}
            {guardadas.tipo === "cargando" && <p className="caja-info">Cargando datos guardados…</p>}
            {guardadas.tipo === "error" && (
              <div className="caja-error">
                <TituloError>No se pudieron cargar los datos guardados</TituloError>
                <p className="mt-1 text-base break-words">{guardadas.detalle}</p>
                <button
                  type="button"
                  onClick={() => {
                    setGuardadas({ tipo: "cargando" });
                    setIntentoGuardadas((n) => n + 1);
                  }}
                  className="boton-gris mt-3 w-full rounded-xl px-4 py-3 text-lg font-semibold"
                >
                  Reintentar
                </button>
              </div>
            )}
            {guardadas.tipo === "ok" && numGuardadas > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="text-xl font-semibold">Guardados ({numGuardadas})</h3>
                <ul className="flex flex-col gap-3">
                  {guardadas.filas.map((f) => (
                    <TarjetaGuardada
                      key={f.id}
                      fila={f}
                      puedeQuitar={f.usuario_id === usuario.id}
                      preguntando={porQuitar === f.id}
                      quitando={quitando.has(f.id)}
                      alPreguntar={() => setPorQuitar(f.id)}
                      alCancelar={() => setPorQuitar(null)}
                      alQuitar={() => void quitarGuardada(f)}
                    />
                  ))}
                </ul>
                <p className="text-base text-texto-suave">
                  Para corregir un producto guardado: quítalo y vuelve a escribirlo.
                </p>
              </div>
            )}
            {guardadas.tipo === "ok" && numGuardadas === 0 && !esMia && (
              <p className="caja-info">Esta visita no tiene datos capturados a mano.</p>
            )}

            {/* --- Filas nuevas --- */}
            {esMia ? (
              <>
                {listas.tipo === "error" && (
                  <p className="caja-aviso">
                    No se pudieron cargar las sugerencias de marca y área. Puedes escribirlas a mano.
                  </p>
                )}

                {filas.length > 0 && (
                  <ol className="flex flex-col gap-4">
                    {filas.map((fila, i) => (
                      <TarjetaNueva
                        key={fila.clave}
                        numero={i + 1}
                        fila={fila}
                        errores={mostrarErrores && filaTieneDatos(fila) ? validarFila(fila) : {}}
                        avisos={avisosFila(fila)}
                        sugerencias={sugerencias}
                        deshabilitada={guardando}
                        refCampo={(campo) => refCampo(fila.clave, campo)}
                        alCambiar={(cambios) => cambiar(fila.clave, cambios)}
                        alDuplicar={() => duplicar(fila)}
                        alQuitar={() => quitarFilaNueva(fila)}
                      />
                    ))}
                  </ol>
                )}

                <button
                  type="button"
                  onClick={agregar}
                  disabled={guardando}
                  className="boton-contorno min-h-12 rounded-xl px-4 py-3 text-lg font-semibold"
                >
                  + Agregar producto
                </button>

                {hayPendientes && (
                  <p className="text-base text-texto-suave">
                    Lo que escribes se guarda en este celular como borrador hasta que toques
                    &quot;Guardar datos&quot;.
                  </p>
                )}
              </>
            ) : (
              <p className="text-base text-texto-suave">
                Solo quien creó la visita puede escribir datos en ella.
              </p>
            )}

            {mensaje && (
              <div
                role={mensaje.tipo === "exito" ? "status" : "alert"}
                className={
                  mensaje.tipo === "exito" ? "caja-exito" : mensaje.tipo === "aviso" ? "caja-aviso" : "caja-error"
                }
              >
                {mensaje.tipo === "falla" ? (
                  <>
                    <TituloError>
                      {mensaje.falla.tipo === "supabase"
                        ? mensajeDeFalla(mensaje.falla)
                        : `${mensaje.inicio} ${mensajeDeFalla(mensaje.falla)}`}
                    </TituloError>
                    {mensaje.inicio.startsWith("No se guardaron") && (
                      <p className="mt-1 text-base">Lo que escribiste sigue aquí; no se perdió.</p>
                    )}
                    {mensaje.falla.tipo === "sesion" && <BotonEntrarOtraVez />}
                  </>
                ) : mensaje.tipo === "aviso" ? (
                  <p className="flex items-start gap-2 font-semibold">
                    <IconoAlerta className="mt-0.5" />
                    <span>{mensaje.texto}</span>
                  </p>
                ) : (
                  <p className="font-semibold">✓ {mensaje.texto}</p>
                )}
              </div>
            )}

            {esMia && filas.length > 0 && (
              <button
                type="button"
                onClick={() => void guardar()}
                disabled={guardando}
                className="boton-primario min-h-12 rounded-2xl px-6 py-4 text-xl font-bold"
              >
                {guardando ? "Guardando…" : "Guardar datos"}
              </button>
            )}
          </>
        )}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {anuncio}
      </p>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Tarjeta de una fila NUEVA (editable).
// -----------------------------------------------------------------------------

function Campo({
  etiqueta,
  nota,
  error,
  aviso,
  ayuda,
  children,
  idCampo,
}: {
  etiqueta: string;
  nota?: string;
  error?: string;
  aviso?: string;
  ayuda?: string;
  children: React.ReactNode;
  idCampo: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={idCampo} className="text-lg font-semibold">
        {etiqueta}
        {nota && <span className="ml-1 text-base font-normal text-texto-suave">{nota}</span>}
      </label>
      {children}
      {ayuda && (
        <p id={`${idCampo}-ayuda`} className="text-base text-texto-suave">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${idCampo}-error`} className="text-base font-semibold text-error-texto">
          {error}
        </p>
      )}
      {!error && aviso && (
        <p id={`${idCampo}-aviso`} className="text-base font-semibold text-aviso-texto">
          ⚠️ {aviso}
        </p>
      )}
    </div>
  );
}

/** Atributos comunes de accesibilidad de un campo (error, ayuda, aviso). */
function describir(idCampo: string, error?: string, ayuda?: string, aviso?: string) {
  const ids = [ayuda ? `${idCampo}-ayuda` : "", error ? `${idCampo}-error` : "", !error && aviso ? `${idCampo}-aviso` : ""]
    .filter(Boolean)
    .join(" ");
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": ids || undefined,
  } as const;
}

function TarjetaNueva({
  numero,
  fila,
  errores,
  avisos,
  sugerencias,
  deshabilitada,
  refCampo,
  alCambiar,
  alDuplicar,
  alQuitar,
}: {
  numero: number;
  fila: FilaBorrador;
  errores: Partial<Record<CampoFila, string>>;
  avisos: Partial<Record<CampoFila, string>>;
  sugerencias: Listas;
  deshabilitada: boolean;
  refCampo: (campo: CampoFila | "acciones") => (el: HTMLElement | null) => void;
  alCambiar: (cambios: Partial<FilaBorrador>) => void;
  alDuplicar: () => void;
  alQuitar: () => void;
}) {
  const id = (campo: string) => `captura-${fila.clave}-${campo}`;
  const claseCon = (campo: CampoFila) => `${CLASE_CAMPO} ${errores[campo] ? "border-error-borde" : ""}`;

  return (
    <li className="rounded-xl border-2 border-borde bg-tarjeta p-4">
      <fieldset disabled={deshabilitada} className="flex min-w-0 flex-col gap-4">
        <legend className="mb-2 text-xl font-bold">Producto {numero}</legend>

        <Campo etiqueta="Artículo" idCampo={id("articulo")} error={errores.articulo}>
          <input
            ref={refCampo("articulo")}
            id={id("articulo")}
            type="text"
            value={fila.articulo}
            onChange={(e) => alCambiar({ articulo: e.target.value })}
            maxLength={MAX_ARTICULO}
            autoComplete="off"
            enterKeyHint="next"
            className={claseCon("articulo")}
            {...describir(id("articulo"), errores.articulo)}
          />
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo
            etiqueta="Contenido"
            idCampo={id("cantidad")}
            error={errores.cantidad}
            ayuda="De una pieza. Ej. 600"
          >
            <input
              ref={refCampo("cantidad")}
              id={id("cantidad")}
              type="text"
              inputMode="decimal"
              value={fila.cantidad}
              onChange={(e) => alCambiar({ cantidad: e.target.value })}
              autoComplete="off"
              enterKeyHint="next"
              className={claseCon("cantidad")}
              {...describir(id("cantidad"), errores.cantidad, "De una pieza. Ej. 600")}
            />
          </Campo>
          <Campo etiqueta="Unidad" idCampo={id("unidad")} error={errores.unidad}>
            <select
              ref={refCampo("unidad")}
              id={id("unidad")}
              value={fila.unidad}
              onChange={(e) => alCambiar({ unidad: e.target.value as FilaBorrador["unidad"] })}
              className={claseCon("unidad")}
              {...describir(id("unidad"), errores.unidad)}
            >
              <option value="">Elige…</option>
              {UNIDADES.map((u) => (
                <option key={u} value={u}>
                  {NOMBRE_UNIDAD[u]}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Campo
            etiqueta="Piezas"
            idCampo={id("piezas")}
            error={errores.piezas}
            ayuda="1 si es suelto. 6 × 355 ml → 6"
          >
            <input
              ref={refCampo("piezas")}
              id={id("piezas")}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={fila.piezas}
              onChange={(e) => alCambiar({ piezas: e.target.value })}
              autoComplete="off"
              enterKeyHint="next"
              className={claseCon("piezas")}
              {...describir(id("piezas"), errores.piezas, "1 si es suelto. 6 × 355 ml → 6")}
            />
          </Campo>
          <Campo
            etiqueta="Precio regular"
            idCampo={id("precio_regular")}
            error={errores.precio_regular}
            aviso={avisos.precio_regular}
            ayuda="$ del paquete completo"
          >
            <input
              ref={refCampo("precio_regular")}
              id={id("precio_regular")}
              type="text"
              inputMode="decimal"
              value={fila.precio_regular}
              onChange={(e) => alCambiar({ precio_regular: e.target.value })}
              autoComplete="off"
              enterKeyHint="next"
              className={claseCon("precio_regular")}
              {...describir(id("precio_regular"), errores.precio_regular, "$ del paquete completo", avisos.precio_regular)}
            />
          </Campo>
        </div>

        <CampoSugerencias
          etiqueta="Marca"
          nota="(recomendado)"
          valor={fila.marca}
          opciones={sugerencias.marcas}
          alEscribir={(v) => alCambiar({ marca: v, marca_de_lista: false })}
          alElegir={(v) => alCambiar({ marca: v, marca_de_lista: true })}
          error={errores.marca}
          maxLength={MAX_MARCA_AREA}
          refCampo={refCampo("marca")}
          claseCampo={CLASE_CAMPO}
        />

        <CampoSugerencias
          etiqueta="Área"
          nota="(recomendado)"
          valor={fila.area}
          opciones={sugerencias.areas}
          alEscribir={(v) => alCambiar({ area: v, area_de_lista: false })}
          alElegir={(v) => alCambiar({ area: v, area_de_lista: true })}
          error={errores.area}
          ayuda="Escribe y elige de la lista, o déjalo como lo escribiste."
          maxLength={MAX_MARCA_AREA}
          refCampo={refCampo("area")}
          claseCampo={CLASE_CAMPO}
        />

        {/* --- Promoción (opcional) --- */}
        <label className="flex min-h-12 cursor-pointer items-center gap-3 text-lg font-semibold">
          <input
            type="checkbox"
            checked={fila.tiene_promo}
            onChange={(e) => alCambiar({ tiene_promo: e.target.checked })}
            className="h-6 w-6 shrink-0 accent-marca"
          />
          Tiene promoción
        </label>

        {fila.tiene_promo && (
          <div className="flex flex-col gap-4 rounded-xl border-2 border-dashed border-borde p-3">
            <Campo etiqueta="Tipo de promoción" idCampo={id("promo_tipo")} error={errores.promo_tipo}>
              <select
                ref={refCampo("promo_tipo")}
                id={id("promo_tipo")}
                value={fila.promo_tipo}
                onChange={(e) => alCambiar({ promo_tipo: e.target.value as FilaBorrador["promo_tipo"] })}
                className={claseCon("promo_tipo")}
                {...describir(id("promo_tipo"), errores.promo_tipo)}
              >
                <option value="">Elige…</option>
                {PROMO_TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {NOMBRE_PROMO[t]}
                  </option>
                ))}
              </select>
            </Campo>

            {(fila.promo_tipo === "n_por_precio" || fila.promo_tipo === "nxm" || fila.promo_tipo === "otro") && (
              <div className="grid grid-cols-2 gap-3">
                <Campo
                  etiqueta={fila.promo_tipo === "nxm" ? "Lleva" : "Piezas"}
                  nota={fila.promo_tipo === "otro" ? "(opcional)" : undefined}
                  idCampo={id("promo_piezas")}
                  error={errores.promo_piezas}
                >
                  <input
                    ref={refCampo("promo_piezas")}
                    id={id("promo_piezas")}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={fila.promo_piezas}
                    onChange={(e) => alCambiar({ promo_piezas: e.target.value })}
                    autoComplete="off"
                    className={claseCon("promo_piezas")}
                    {...describir(id("promo_piezas"), errores.promo_piezas)}
                  />
                </Campo>
                {fila.promo_tipo === "nxm" ? (
                  <Campo etiqueta="Paga" idCampo={id("promo_paga_piezas")} error={errores.promo_paga_piezas}>
                    <input
                      ref={refCampo("promo_paga_piezas")}
                      id={id("promo_paga_piezas")}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={fila.promo_paga_piezas}
                      onChange={(e) => alCambiar({ promo_paga_piezas: e.target.value })}
                      autoComplete="off"
                      className={claseCon("promo_paga_piezas")}
                      {...describir(id("promo_paga_piezas"), errores.promo_paga_piezas)}
                    />
                  </Campo>
                ) : (
                  <CampoPrecioPromo
                    fila={fila}
                    errores={errores}
                    avisos={avisos}
                    id={id}
                    refCampo={refCampo}
                    alCambiar={alCambiar}
                    claseCon={claseCon}
                  />
                )}
              </div>
            )}

            {fila.promo_tipo === "precio_rebajado" && (
              <CampoPrecioPromo
                fila={fila}
                errores={errores}
                avisos={avisos}
                id={id}
                refCampo={refCampo}
                alCambiar={alCambiar}
                claseCon={claseCon}
              />
            )}

            <Campo etiqueta="¿Para quién?" idCampo={id("promo_condicion")}>
              <select
                ref={refCampo("promo_condicion")}
                id={id("promo_condicion")}
                value={fila.promo_condicion}
                onChange={(e) =>
                  alCambiar({ promo_condicion: e.target.value as FilaBorrador["promo_condicion"] })
                }
                className={CLASE_CAMPO}
              >
                {CONDICIONES.map((c) => (
                  <option key={c} value={c}>
                    {NOMBRE_CONDICION[c]}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
        )}

        <Campo
          etiqueta="Observaciones"
          nota="(opcional)"
          idCampo={id("observaciones")}
          error={errores.observaciones}
        >
          <input
            ref={refCampo("observaciones")}
            id={id("observaciones")}
            type="text"
            value={fila.observaciones}
            onChange={(e) => alCambiar({ observaciones: e.target.value })}
            maxLength={MAX_OBSERVACIONES}
            autoComplete="off"
            enterKeyHint="done"
            className={claseCon("observaciones")}
            {...describir(id("observaciones"), errores.observaciones)}
          />
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={alDuplicar}
            className="boton-gris min-h-12 rounded-xl px-3 py-3 text-lg font-semibold"
          >
            Duplicar fila
          </button>
          <button
            type="button"
            onClick={alQuitar}
            className="boton-gris min-h-12 rounded-xl px-3 py-3 text-lg font-semibold"
          >
            Quitar
          </button>
        </div>
      </fieldset>
    </li>
  );
}

function CampoPrecioPromo({
  fila,
  errores,
  avisos,
  id,
  refCampo,
  alCambiar,
  claseCon,
}: {
  fila: FilaBorrador;
  errores: Partial<Record<CampoFila, string>>;
  avisos: Partial<Record<CampoFila, string>>;
  id: (campo: string) => string;
  refCampo: (campo: CampoFila | "acciones") => (el: HTMLElement | null) => void;
  alCambiar: (cambios: Partial<FilaBorrador>) => void;
  claseCon: (campo: CampoFila) => string;
}) {
  const etiqueta = fila.promo_tipo === "precio_rebajado" ? "Precio con promoción" : "Precio total";
  return (
    <Campo
      etiqueta={etiqueta}
      nota={fila.promo_tipo === "otro" ? "(opcional)" : undefined}
      idCampo={id("promo_precio_total")}
      error={errores.promo_precio_total}
      aviso={avisos.promo_precio_total}
    >
      <input
        ref={refCampo("promo_precio_total")}
        id={id("promo_precio_total")}
        type="text"
        inputMode="decimal"
        value={fila.promo_precio_total}
        onChange={(e) => alCambiar({ promo_precio_total: e.target.value })}
        autoComplete="off"
        className={claseCon("promo_precio_total")}
        {...describir(id("promo_precio_total"), errores.promo_precio_total, undefined, avisos.promo_precio_total)}
      />
    </Campo>
  );
}

// -----------------------------------------------------------------------------
// Tarjeta de una fila GUARDADA (solo lectura).
// -----------------------------------------------------------------------------

function TarjetaGuardada({
  fila,
  puedeQuitar,
  preguntando,
  quitando,
  alPreguntar,
  alCancelar,
  alQuitar,
}: {
  fila: FilaGuardada;
  puedeQuitar: boolean;
  preguntando: boolean;
  quitando: boolean;
  alPreguntar: () => void;
  alCancelar: () => void;
  alQuitar: () => void;
}) {
  const promo = textoPromocion(fila);
  return (
    <li className="rounded-xl border-2 border-borde bg-fondo p-4">
      <p className="text-lg font-bold break-words">{fila.articulo}</p>
      <p className="text-lg">
        {textoContenido(fila.cantidad, fila.unidad, fila.piezas)} ·{" "}
        <span className="font-semibold">{formatearPesos(fila.precio_regular)}</span>
      </p>
      {(fila.marca || fila.area) && (
        <p className="text-base text-texto-suave break-words">
          {[fila.marca && `Marca: ${fila.marca}`, fila.area && `Área: ${fila.area}`].filter(Boolean).join(" · ")}
        </p>
      )}
      {promo && <p className="text-base font-semibold break-words">Promoción: {promo}</p>}
      {fila.observaciones && <p className="text-base break-words">“{fila.observaciones}”</p>}
      <p className="text-base text-texto-suave">Guardado {formatearFecha(fila.created_at)}</p>

      {puedeQuitar && !preguntando && (
        <button
          type="button"
          onClick={alPreguntar}
          disabled={quitando}
          className="boton-gris mt-3 min-h-12 w-full rounded-xl px-4 py-3 text-lg font-semibold"
        >
          {quitando ? "Quitando…" : "Quitar"}
        </button>
      )}
      {puedeQuitar && preguntando && (
        <div role="group" aria-label="Confirmar quitar" className="mt-3 flex flex-col gap-2">
          <p className="font-semibold">¿Quitar este producto? Ya no se mostrará.</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={alCancelar}
              className="boton-gris min-h-12 rounded-xl px-3 py-3 text-lg font-semibold"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={alQuitar}
              className="boton-primario min-h-12 rounded-xl px-3 py-3 text-lg font-semibold"
            >
              Sí, quitar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
