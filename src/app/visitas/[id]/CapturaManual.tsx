"use client";

// Sección OPCIONAL "Datos del levantamiento (manual)" de una visita: CAPTURA RÁPIDA
// (supabase/010_capturas_manuales.sql + 011_captura_rapida.sql). La persona recorre la
// tienda y anota un producto en segundos. Sirven después para comparar contra lo que lean
// los agentes y como muestra verificada; NINGÚN agente las lee al leer fotos.
//
// - Formulario de SOLO 4 campos: Artículo (con sugerencias del catálogo propio, nunca
//   obliga a elegir), Precio regular, Precio de promoción individual (opcional) y
//   Observaciones (opcional). Solo artículo y precio regular son obligatorios.
// - Enter avanza al siguiente campo; en el último, agrega el producto. Al elegir una
//   sugerencia, el foco pasa a Precio regular. "Agregar" está desactivado mientras falte
//   algo y dice qué falta ("Falta: precio regular").
// - Al agregar, el producto pasa a una lista compacta de una línea y el formulario se
//   limpia con el foco otra vez en Artículo. Tocar un producto de la lista lo sube al
//   formulario para corregirlo; "Quitar" lo saca (con "Deshacer").
// - "Guardar datos" manda TODA la lista en UNA sola operación: o se guardan todos o
//   ninguno.
// - Sugerencias: al abrir la sección se pide UNA vez la lista de artículos (solo
//   descripciones, función articulos_captura) y se guarda en memoria. Se filtra aquí, en
//   el celular. Si no carga (sin señal), se captura igual con texto libre.
// - Borrador: el formulario a medias y la lista sin guardar se guardan en el celular
//   (localStorage) por persona y por visita. Al salir con algo sin guardar, se avisa
//   (pestaña: beforeunload; enlace "Volver a la lista": EnlaceVolver.tsx).
// - Filas guardadas: solo lectura. Su autor las puede "Quitar" (descarte, no se borra).
// - Quién escribe: solo en visitas PROPIAS (la base lo exige). El admin ve las filas de
//   cualquier visita, pero escribe solo en las suyas.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSesion } from "@/lib/sesion";
import { formatearFecha } from "@/lib/fechas";
import type { CapturaManual as FilaGuardada } from "@/lib/tipos";
import {
  MAX_ARTICULO,
  MAX_OBSERVACIONES,
  avisosProducto,
  faltantes,
  formatearPesos,
  guardarBorrador,
  leerBorrador,
  leerPrecio,
  limpiarPrecio,
  limpiarPrecioPegado,
  marcarPendientes,
  productoParaGuardar,
  productoTieneDatos,
  productoVacio,
  textoContenido,
  textoFalta,
  textoPromocion,
  type ProductoBorrador,
} from "@/lib/capturas";
import { clasificarFalla, fallaConCodigo, mensajeDeFalla, type Falla } from "@/lib/errores";
import CampoSugerencias from "@/components/CampoSugerencias";
import TituloError, { IconoAlerta } from "@/components/TituloError";
import BotonEntrarOtraVez from "@/components/BotonEntrarOtraVez";

// Letra de 18 px en todos los campos (más de 16 px: iOS no hace zoom) y al menos 48 px
// de alto (área táctil de más de 44 px). El texto de ejemplo ("Opcional") va en gris
// legible: #5c5c5c sobre blanco da 6.6:1 (más de 4.5:1).
const CLASE_CAMPO =
  "w-full min-h-12 rounded-xl border-2 border-borde bg-fondo px-3 py-2 text-lg text-texto outline-offset-2 focus-visible:outline-3 focus-visible:outline-marca placeholder:text-texto-desactivado";

type Campo = "articulo" | "precio_regular" | "promo_precio_pieza" | "observaciones";
const SIGUIENTE: Record<Exclude<Campo, "observaciones">, Campo> = {
  articulo: "precio_regular",
  precio_regular: "promo_precio_pieza",
  promo_precio_pieza: "observaciones",
};

type EstadoArticulos =
  | { tipo: "cargando" }
  | { tipo: "ok"; lista: string[] }
  // Sin sugerencias se captura igual (texto libre): solo se avisa.
  | { tipo: "error" };

type EstadoGuardadas =
  | { tipo: "cargando" }
  | { tipo: "ok"; filas: FilaGuardada[] }
  | { tipo: "error"; detalle: string };

type Mensaje =
  | { tipo: "exito"; texto: string }
  | { tipo: "aviso"; texto: string }
  | { tipo: "falla"; inicio: string; falla: Falla };

/** Producto que se está corrigiendo: dónde estaba en la lista y cómo era. */
type Correccion = { indice: number; original: ProductoBorrador };

const SIN_ARTICULOS: string[] = [];

function insertar<T>(lista: T[], indice: number, x: T): T[] {
  const i = Math.max(0, Math.min(indice, lista.length));
  return [...lista.slice(0, i), x, ...lista.slice(i)];
}

function mismoProducto(a: ProductoBorrador, b: ProductoBorrador): boolean {
  return (
    a.articulo === b.articulo &&
    a.precio_regular === b.precio_regular &&
    a.promo_precio_pieza === b.promo_precio_pieza &&
    a.observaciones === b.observaciones
  );
}

/** Enter sin estar escribiendo con un teclado de composición (japonés, etc.). */
function esEnter(e: React.KeyboardEvent) {
  return e.key === "Enter" && !e.nativeEvent.isComposing;
}

export default function CapturaManual({ visitaId, esMia }: { visitaId: string; esMia: boolean }) {
  const { usuario } = useSesion();

  // Borrador de esta persona en esta visita (si lo hay, la sección empieza abierta).
  const [inicio] = useState(() => (esMia ? leerBorrador(usuario.id, visitaId) : null));
  const [abierta, setAbierta] = useState(inicio !== null);
  const [form, setForm] = useState<ProductoBorrador>(() => inicio?.formulario ?? productoVacio());
  const [pendientes, setPendientes] = useState<ProductoBorrador[]>(() => inicio?.pendientes ?? []);
  const [correccion, setCorreccion] = useState<Correccion | null>(null);
  /** Último producto quitado de la lista (para "Deshacer"). */
  const [quitado, setQuitado] = useState<Correccion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);

  const [articulos, setArticulos] = useState<EstadoArticulos>({ tipo: "cargando" });
  const [intentoArticulos, setIntentoArticulos] = useState(0);
  const [guardadas, setGuardadas] = useState<EstadoGuardadas>({ tipo: "cargando" });
  const [intentoGuardadas, setIntentoGuardadas] = useState(0);
  /** Fila guardada con la pregunta "¿Quitar este producto?" abierta. */
  const [porQuitar, setPorQuitar] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<ReadonlySet<string>>(() => new Set());
  const [anuncio, setAnuncio] = useState("");

  /** Campos del formulario, para mover el foco (Enter, elegir, agregar). */
  const refArticulo = useRef<HTMLInputElement | null>(null);
  const refPrecio = useRef<HTMLInputElement | null>(null);
  const refPromo = useRef<HTMLInputElement | null>(null);
  const refObservaciones = useRef<HTMLInputElement | null>(null);
  // El foco se mueve EN el mismo toque o tecla (no después): así el celular mantiene el
  // teclado abierto.
  function enfocar(campo: Campo) {
    const refs = {
      articulo: refArticulo,
      precio_regular: refPrecio,
      promo_precio_pieza: refPromo,
      observaciones: refObservaciones,
    };
    refs[campo].current?.focus();
  }

  // Con cacheComponents, Next.js esconde (no desmonta) esta pantalla al ir a otra.
  // Si se fue con la pregunta "¿Quitar este producto?" abierta, al volver aparece
  // cerrada (doc de Next: preserving-ui-state.md).
  useLayoutEffect(() => () => setPorQuitar(null), []);

  /** "nada" → "pidiendo" → "listo". La lista de artículos se pide una sola vez. */
  const pedidoArticulos = useRef<"nada" | "pidiendo" | "listo">("nada");

  // Lista de artículos para las sugerencias: UNA vez, al abrir la sección. Se guarda
  // solo en memoria (no en el celular). Un solo valor: no la corta el límite de filas.
  useEffect(() => {
    if (!abierta || !esMia || pedidoArticulos.current !== "nada") return;
    pedidoArticulos.current = "pidiendo";
    let cancelado = false;
    async function cargar() {
      try {
        const { data, error } = await supabase.rpc("articulos_captura");
        if (cancelado) return;
        pedidoArticulos.current = "listo";
        if (error || !Array.isArray(data)) {
          setArticulos({ tipo: "error" });
          return;
        }
        setArticulos({ tipo: "ok", lista: data.filter((x): x is string => typeof x === "string") });
      } catch {
        if (cancelado) return;
        pedidoArticulos.current = "listo";
        setArticulos({ tipo: "error" });
      }
    }
    cargar();
    return () => {
      cancelado = true;
      // Si la pantalla se escondió ANTES de terminar, se vuelve a pedir al regresar.
      if (pedidoArticulos.current === "pidiendo") pedidoArticulos.current = "nada";
    };
  }, [abierta, esMia, intentoArticulos]);

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

  // Borrador: cada cambio se guarda en el celular. Un producto en corrección se guarda
  // en su lugar de la lista (si se cierra la pestaña a la mitad, no se pierde).
  useEffect(() => {
    if (!esMia) return;
    const lista = correccion ? insertar(pendientes, correccion.indice, correccion.original) : pendientes;
    const formulario = correccion && mismoProducto(form, correccion.original) ? productoVacio() : form;
    guardarBorrador(usuario.id, visitaId, { formulario, pendientes: lista });
  }, [esMia, usuario.id, visitaId, form, pendientes, correccion]);

  // Aviso antes de salir con productos sin guardar.
  const hayPendientes = pendientes.length > 0 || correccion !== null || productoTieneDatos(form);
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

  function cambiar(cambios: Partial<ProductoBorrador>) {
    setForm((antes) => ({ ...antes, ...cambios }));
  }

  const falta = faltantes(form);
  const avisos = avisosProducto(form);

  function agregar() {
    if (falta.length > 0) {
      // Lleva el foco a lo que falta; nada más (no se borra lo escrito).
      enfocar(falta[0] === "artículo" ? "articulo" : "precio_regular");
      setAnuncio(textoFalta(falta) ?? "");
      return;
    }
    const producto: ProductoBorrador = {
      ...form,
      articulo: form.articulo.trim().slice(0, MAX_ARTICULO),
      observaciones: form.observaciones.trim().slice(0, MAX_OBSERVACIONES),
    };
    setPendientes((antes) =>
      correccion ? insertar(antes, correccion.indice, producto) : [...antes, producto],
    );
    const n = pendientes.length + 1;
    setAnuncio(
      `${correccion ? "Corregido" : "Agregado"}: ${producto.articulo}. ${n} ${n === 1 ? "producto" : "productos"} por guardar.`,
    );
    setCorreccion(null);
    setQuitado(null);
    setMensaje(null);
    setForm(productoVacio());
    enfocar("articulo");
  }

  function corregir(indice: number) {
    if (guardando) return;
    const cambiado = correccion ? !mismoProducto(form, correccion.original) : productoTieneDatos(form);
    if (
      cambiado &&
      !window.confirm(
        correccion
          ? "La corrección que estabas haciendo se descarta (ese producto se queda como estaba). ¿Corregir este otro?"
          : "Lo que escribiste en el formulario se pierde. ¿Corregir este producto?",
      )
    ) {
      return;
    }
    // Si ya se corregía otro, vuelve a la lista como estaba.
    let lista = pendientes;
    let i = indice;
    if (correccion) {
      lista = insertar(lista, correccion.indice, correccion.original);
      if (correccion.indice <= indice) i += 1;
    }
    const producto = lista[i];
    if (!producto) return;
    setPendientes(lista.filter((_, j) => j !== i));
    setCorreccion({ indice: i, original: producto });
    setForm(producto);
    setQuitado(null);
    setMensaje(null);
    setAnuncio(`Corrigiendo: ${producto.articulo}.`);
    enfocar("articulo");
  }

  function cancelarCorreccion() {
    if (!correccion) {
      setForm(productoVacio());
      setAnuncio("Formulario limpio.");
    } else {
      setPendientes((antes) => insertar(antes, correccion.indice, correccion.original));
      setCorreccion(null);
      setForm(productoVacio());
      setAnuncio("Corrección cancelada; el producto quedó como estaba.");
    }
    enfocar("articulo");
  }

  function quitarPendiente(indice: number) {
    if (guardando) return;
    const producto = pendientes[indice];
    if (!producto) return;
    setPendientes((antes) => antes.filter((_, j) => j !== indice));
    if (correccion && correccion.indice > indice) {
      setCorreccion({ ...correccion, indice: correccion.indice - 1 });
    }
    setQuitado({ indice, original: producto });
    setAnuncio(`Quitado de la lista: ${producto.articulo}.`);
  }

  function deshacerQuitar() {
    if (!quitado) return;
    setPendientes((antes) => insertar(antes, quitado.indice, quitado.original));
    if (correccion && correccion.indice >= quitado.indice) {
      setCorreccion({ ...correccion, indice: correccion.indice + 1 });
    }
    setAnuncio(`De vuelta en la lista: ${quitado.original.articulo}.`);
    setQuitado(null);
  }

  async function guardar() {
    if (guardando) return;
    setMensaje(null);
    const aGuardar = pendientes;
    if (aGuardar.length === 0) {
      setMensaje({ tipo: "aviso", texto: "No hay productos en la lista para guardar." });
      return;
    }

    setGuardando(true);
    try {
      // UN solo insert con todos los productos: Postgres lo hace todo o nada.
      const { data, error, status } = await supabase
        .from("capturas_manuales")
        .insert(aGuardar.map((p) => productoParaGuardar(visitaId, p)))
        .select();
      if (error) {
        setMensaje({ tipo: "falla", inicio: "No se guardaron los datos.", falla: clasificarFalla(error, status) });
      } else if (!data || data.length !== aGuardar.length) {
        // Respondió sin las filas esperadas: se recarga la lista para ver qué quedó.
        setMensaje({ tipo: "falla", inicio: "No se guardaron los datos.", falla: fallaConCodigo("SIN-FILAS") });
        setIntentoGuardadas((n) => n + 1);
      } else {
        const claves = new Set(aGuardar.map((p) => p.clave));
        setPendientes((antes) => antes.filter((p) => !claves.has(p.clave)));
        setQuitado(null);
        setGuardadas((antes) =>
          antes.tipo === "ok" ? { tipo: "ok", filas: [...antes.filas, ...data] } : { tipo: "ok", filas: data },
        );
        const n = data.length;
        const restante =
          correccion || productoTieneDatos(form) ? " El formulario todavía tiene datos sin agregar." : "";
        setMensaje({
          tipo: "exito",
          texto: (n === 1 ? "Se guardó 1 producto." : `Se guardaron ${n} productos.`) + restante,
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

  const opciones = articulos.tipo === "ok" ? articulos.lista : SIN_ARTICULOS;
  const numGuardadas = guardadas.tipo === "ok" ? guardadas.filas.length : 0;
  const textoFaltante = textoFalta(falta);

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
              Opcional. Artículo y precio, uno por uno.
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
            {esMia ? (
              <>
                {articulos.tipo === "error" && (
                  <div className="caja-aviso">
                    <p className="flex items-start gap-2 font-semibold">
                      <IconoAlerta className="mt-0.5" />
                      <span>No se cargaron las sugerencias de artículos. Escribe el nombre a mano.</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        pedidoArticulos.current = "nada";
                        setArticulos({ tipo: "cargando" });
                        setIntentoArticulos((n) => n + 1);
                      }}
                      className="boton-gris mt-3 min-h-12 w-full rounded-xl px-4 py-2 text-lg font-semibold"
                    >
                      Volver a cargar sugerencias
                    </button>
                  </div>
                )}

                {/* --- Formulario de 4 campos --- */}
                <form
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    agregar();
                  }}
                  aria-labelledby="titulo-formulario-captura"
                  className="flex flex-col gap-4 rounded-xl border-2 border-borde bg-tarjeta p-4"
                >
                  <h3 id="titulo-formulario-captura" className="text-xl font-bold">
                    {correccion ? "Corregir producto" : "Agregar producto"}
                  </h3>

                  <CampoSugerencias
                    etiqueta="Artículo"
                    valor={form.articulo}
                    opciones={opciones}
                    alEscribir={(v) => cambiar({ articulo: v, articulo_de_lista: false })}
                    alElegir={(v) => {
                      cambiar({ articulo: v, articulo_de_lista: true });
                      enfocar("precio_regular");
                    }}
                    alEnter={() => enfocar(SIGUIENTE.articulo)}
                    ayuda={
                      articulos.tipo === "cargando"
                        ? "Cargando sugerencias… ya puedes escribir."
                        : "Escribe y elige de la lista, o déjalo como lo escribiste."
                    }
                    maxLength={MAX_ARTICULO}
                    obligatorio
                    campoRef={refArticulo}
                    claseCampo={CLASE_CAMPO}
                  />

                  <CampoPrecio
                    campo="precio_regular"
                    etiqueta="Precio regular"
                    valor={form.precio_regular}
                    alCambiar={(v) => cambiar({ precio_regular: v })}
                    aviso={avisos.precio_regular}
                    obligatorio
                    campoRef={refPrecio}
                    alEnter={() => enfocar(SIGUIENTE.precio_regular)}
                  />

                  <CampoPrecio
                    campo="promo_precio_pieza"
                    etiqueta="Precio de promoción individual"
                    nota="(opcional)"
                    placeholder="Opcional"
                    ayuda="Precio por pieza. Si es 2x$42, anota 21 y escribe 2x42 en observaciones."
                    valor={form.promo_precio_pieza}
                    alCambiar={(v) => cambiar({ promo_precio_pieza: v })}
                    aviso={avisos.promo_precio_pieza}
                    campoRef={refPromo}
                    alEnter={() => enfocar(SIGUIENTE.promo_precio_pieza)}
                  />

                  <div className="flex flex-col gap-2">
                    <label htmlFor="captura-observaciones" className="text-lg font-semibold">
                      Observaciones
                      <span className="ml-1 text-base font-normal text-texto-suave">(opcional)</span>
                    </label>
                    <input
                      ref={refObservaciones}
                      id="captura-observaciones"
                      type="text"
                      value={form.observaciones}
                      onChange={(e) => cambiar({ observaciones: e.target.value })}
                      onKeyDown={(e) => {
                        if (esEnter(e)) {
                          e.preventDefault();
                          agregar();
                        }
                      }}
                      maxLength={MAX_OBSERVACIONES}
                      placeholder="Opcional"
                      autoComplete="off"
                      enterKeyHint="done"
                      className={CLASE_CAMPO}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      type="submit"
                      disabled={falta.length > 0}
                      aria-describedby={textoFaltante ? "captura-falta" : undefined}
                      className="boton-primario min-h-14 rounded-2xl px-6 py-4 text-xl font-bold"
                    >
                      {correccion ? "Guardar corrección" : "Agregar"}
                    </button>
                    {textoFaltante && (
                      <p id="captura-falta" className="text-center text-lg font-semibold text-texto">
                        {textoFaltante}
                      </p>
                    )}
                    {(correccion || productoTieneDatos(form)) && (
                      <button
                        type="button"
                        onClick={cancelarCorreccion}
                        className="boton-gris min-h-12 rounded-xl px-4 py-2 text-lg font-semibold"
                      >
                        {correccion ? "Cancelar corrección" : "Limpiar formulario"}
                      </button>
                    )}
                  </div>
                </form>

                {/* --- Lista sin guardar (una línea por producto) --- */}
                {pendientes.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xl font-semibold">Por guardar ({pendientes.length})</h3>
                    <p className="text-base text-texto-suave">Toca un producto para corregirlo.</p>
                    <ol className="flex flex-col gap-2">
                      {pendientes.map((p, i) => (
                        <FilaPendiente
                          key={p.clave}
                          producto={p}
                          deshabilitada={guardando}
                          alCorregir={() => corregir(i)}
                          alQuitar={() => quitarPendiente(i)}
                        />
                      ))}
                    </ol>
                  </div>
                )}

                {quitado && (
                  <div className="caja-info flex items-center justify-between gap-3">
                    <span className="min-w-0 break-words">Quitado: {quitado.original.articulo}</span>
                    <button
                      type="button"
                      onClick={deshacerQuitar}
                      className="boton-gris min-h-12 shrink-0 rounded-xl px-4 py-2 text-lg font-semibold"
                    >
                      Deshacer
                    </button>
                  </div>
                )}

                {pendientes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void guardar()}
                    disabled={guardando}
                    className="boton-primario min-h-12 rounded-2xl px-6 py-4 text-xl font-bold"
                  >
                    {guardando
                      ? "Guardando…"
                      : `Guardar datos (${pendientes.length} ${pendientes.length === 1 ? "producto" : "productos"})`}
                  </button>
                )}

                {hayPendientes && (
                  <p className="text-base text-texto-suave">
                    Lo que escribes se queda en este celular como borrador hasta que toques
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
                      <p className="mt-1 text-base">Tu lista sigue aquí; no se perdió.</p>
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

            {/* --- Productos ya guardados (solo lectura) --- */}
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
              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-semibold">Guardados ({numGuardadas})</h3>
                <ul className="flex flex-col gap-2">
                  {guardadas.filas.map((f) => (
                    <FilaGuardadaVista
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
// Campo de precio: teclado numérico con punto decimal (inputMode="decimal", no
// type="number"), acepta punto o coma, hasta 2 decimales, y descarta todo lo que no
// sea número, también al pegar (src/lib/capturas.ts → limpiarPrecio).
// -----------------------------------------------------------------------------

function CampoPrecio({
  campo,
  etiqueta,
  nota,
  placeholder,
  ayuda,
  valor,
  alCambiar,
  aviso,
  obligatorio,
  campoRef,
  alEnter,
}: {
  campo: Campo;
  etiqueta: string;
  nota?: string;
  placeholder?: string;
  ayuda?: string;
  valor: string;
  alCambiar: (valor: string) => void;
  aviso?: string;
  obligatorio?: boolean;
  campoRef: React.RefObject<HTMLInputElement | null>;
  alEnter: () => void;
}) {
  const id = `captura-${campo}`;
  const describe = [ayuda ? `${id}-ayuda` : "", aviso ? `${id}-aviso` : ""].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-lg font-semibold">
        {etiqueta}
        {nota && <span className="ml-1 text-base font-normal text-texto-suave">{nota}</span>}
      </label>
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-lg text-texto-suave"
        >
          $
        </span>
        <input
          ref={campoRef}
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          value={valor}
          placeholder={placeholder}
          aria-required={obligatorio || undefined}
          aria-describedby={describe || undefined}
          onChange={(e) => alCambiar(limpiarPrecio(e.target.value))}
          onPaste={(e) => {
            // Lo pegado se limpia aparte: "$1,234.50" → "1234.50".
            e.preventDefault();
            const el = e.currentTarget;
            const pegado = limpiarPrecioPegado(e.clipboardData.getData("text"));
            const inicio = el.selectionStart ?? valor.length;
            const fin = el.selectionEnd ?? valor.length;
            alCambiar(limpiarPrecio(valor.slice(0, inicio) + pegado + valor.slice(fin)));
          }}
          onKeyDown={(e) => {
            if (esEnter(e)) {
              e.preventDefault();
              alEnter();
            }
          }}
          className={`${CLASE_CAMPO} pl-8`}
        />
      </div>
      {ayuda && (
        <p id={`${id}-ayuda`} className="text-base text-texto-suave">
          {ayuda}
        </p>
      )}
      {aviso && (
        <p id={`${id}-aviso`} className="text-base font-semibold text-aviso-texto">
          ⚠️ {aviso}
        </p>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Un producto de la lista sin guardar: una línea (artículo · $ precio · promo).
// -----------------------------------------------------------------------------

function FilaPendiente({
  producto,
  deshabilitada,
  alCorregir,
  alQuitar,
}: {
  producto: ProductoBorrador;
  deshabilitada: boolean;
  alCorregir: () => void;
  alQuitar: () => void;
}) {
  const regular = leerPrecio(producto.precio_regular);
  const promo = leerPrecio(producto.promo_precio_pieza);
  const precio = regular !== null ? formatearPesos(regular) : "";
  const textoPromo = promo !== null ? `promo ${formatearPesos(promo)}` : "";
  const resumen = [producto.articulo, precio, textoPromo].filter(Boolean).join(" · ");
  return (
    <li className="flex items-stretch gap-2">
      <button
        type="button"
        onClick={alCorregir}
        disabled={deshabilitada}
        aria-label={`Corregir: ${resumen}${producto.observaciones ? `. Observaciones: ${producto.observaciones}` : ""}`}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-xl border-2 border-borde bg-fondo px-3 py-2 text-left text-lg active:bg-tarjeta-presionada disabled:text-texto-desactivado"
      >
        <span className="min-w-0 flex-1 truncate">{producto.articulo}</span>
        <span className="shrink-0 font-semibold">{precio}</span>
        {textoPromo && <span className="shrink-0 text-base text-texto-suave">· {textoPromo}</span>}
        {producto.observaciones && (
          <span aria-hidden className="shrink-0 text-base text-texto-suave">
            ✎
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={alQuitar}
        disabled={deshabilitada}
        aria-label={`Quitar ${producto.articulo}`}
        className="boton-gris min-h-12 shrink-0 rounded-xl px-3 py-2 text-lg font-semibold"
      >
        Quitar
      </button>
    </li>
  );
}

// -----------------------------------------------------------------------------
// Un producto GUARDADO (solo lectura), compacto. Las filas del formulario anterior
// (010) muestran también su contenido y su promoción.
// -----------------------------------------------------------------------------

function FilaGuardadaVista({
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
  const contenido = textoContenido(fila.cantidad, fila.unidad, fila.piezas);
  const detalles = [contenido, fila.marca && `Marca: ${fila.marca}`, fila.area && `Área: ${fila.area}`]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="rounded-xl border-2 border-borde bg-fondo px-3 py-2">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-lg break-words">
          <span className="font-semibold">{fila.articulo}</span> · {formatearPesos(fila.precio_regular)}
          {promo && <span className="text-texto-suave"> · {promo}</span>}
        </p>
        {puedeQuitar && !preguntando && (
          <button
            type="button"
            onClick={alPreguntar}
            disabled={quitando}
            className="boton-gris min-h-12 shrink-0 rounded-xl px-3 py-2 text-lg font-semibold"
          >
            {quitando ? "Quitando…" : "Quitar"}
          </button>
        )}
      </div>
      {detalles && <p className="text-base text-texto-suave break-words">{detalles}</p>}
      {fila.observaciones && <p className="text-base break-words">“{fila.observaciones}”</p>}
      <p className="text-base text-texto-suave">Guardado {formatearFecha(fila.created_at)}</p>

      {puedeQuitar && preguntando && (
        <div role="group" aria-label="Confirmar quitar" className="mt-2 flex flex-col gap-2">
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
