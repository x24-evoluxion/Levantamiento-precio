// Captura manual de datos del levantamiento (supabase/010_capturas_manuales.sql).
//
// Aquí vive todo lo que NO es pantalla: listas de valores, cómo se leen los números
// (con coma o punto), la validación en español, el filtro de sugerencias y el
// borrador guardado en el celular. La pantalla está en
// src/app/visitas/[id]/CapturaManual.tsx.
//
// Las reglas son las MISMAS que la base de datos (los CHECK de 010). La app las
// revisa antes para dar mensajes claros; si algo se escapara, la base lo rechaza.

import type { NuevaCapturaManual } from "./tipos";

// --- Listas de valores (iguales a los CHECK de 010 y a lecturas_precio) ---------

export const UNIDADES = ["g", "kg", "ml", "l", "pza"] as const;
export type Unidad = (typeof UNIDADES)[number];

export const NOMBRE_UNIDAD: Record<Unidad, string> = {
  g: "g (gramos)",
  kg: "kg (kilos)",
  ml: "ml (mililitros)",
  l: "l (litros)",
  pza: "pza (piezas)",
};

export const PROMO_TIPOS = ["precio_rebajado", "n_por_precio", "nxm", "otro"] as const;
export type PromoTipo = "ninguna" | (typeof PROMO_TIPOS)[number];

export const NOMBRE_PROMO: Record<(typeof PROMO_TIPOS)[number], string> = {
  precio_rebajado: "Precio rebajado (antes / ahora)",
  n_por_precio: "Varias por un precio (ej. 2 x $30)",
  nxm: "Lleva N, paga M (ej. 3 x 2)",
  otro: "Otra promoción",
};

export const CONDICIONES = ["ninguna", "tarjeta", "app", "otro"] as const;
export type PromoCondicion = (typeof CONDICIONES)[number];

export const NOMBRE_CONDICION: Record<PromoCondicion, string> = {
  ninguna: "Para todos (sin condición)",
  tarjeta: "Solo con tarjeta",
  app: "Solo con la app de la tienda",
  otro: "Otra condición",
};

// Límites (los mismos de 010).
export const MAX_ARTICULO = 200;
export const MAX_MARCA_AREA = 100;
export const MAX_OBSERVACIONES = 300;
const MAX_PIEZAS = 1000;
const MAX_CANTIDAD = 10_000_000; // menor que
const MAX_PRECIO = 100_000_000; // menor que

// --- Una fila en pantalla (todo como texto, tal como lo escribe la persona) -----

export type FilaBorrador = {
  /** Solo para la pantalla (React key y focos). No se guarda en la base. */
  clave: string;
  articulo: string;
  cantidad: string;
  unidad: "" | Unidad;
  piezas: string;
  precio_regular: string;
  marca: string;
  marca_de_lista: boolean;
  area: string;
  area_de_lista: boolean;
  tiene_promo: boolean;
  promo_tipo: "" | (typeof PROMO_TIPOS)[number];
  promo_piezas: string;
  promo_precio_total: string;
  promo_paga_piezas: string;
  promo_condicion: PromoCondicion;
  observaciones: string;
};

export type CampoFila = Exclude<keyof FilaBorrador, "clave">;

function claveNueva(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function filaVacia(): FilaBorrador {
  return {
    clave: claveNueva(),
    articulo: "",
    cantidad: "",
    unidad: "",
    piezas: "1",
    precio_regular: "",
    marca: "",
    marca_de_lista: false,
    area: "",
    area_de_lista: false,
    tiene_promo: false,
    promo_tipo: "",
    promo_piezas: "",
    promo_precio_total: "",
    promo_paga_piezas: "",
    promo_condicion: "ninguna",
    observaciones: "",
  };
}

export function duplicarFila(fila: FilaBorrador): FilaBorrador {
  return { ...fila, clave: claveNueva() };
}

/** true si la persona ya escribió algo en la fila (una fila recién agregada no cuenta). */
export function filaTieneDatos(fila: FilaBorrador): boolean {
  const vacia = filaVacia();
  return (Object.keys(vacia) as (keyof FilaBorrador)[]).some(
    (k) => k !== "clave" && fila[k] !== vacia[k],
  );
}

// --- Números: aceptan coma o punto decimal --------------------------------------

type Numero = { ok: true; valor: number; decimales: number } | { ok: false };

/**
 * Lee "12,50", "12.50", "12" o " 12.5 ". Solo un separador decimal y sin signos
 * (ni miles, ni "$", ni negativos). Devuelve también cuántos decimales tenía.
 */
export function leerNumero(texto: string): Numero {
  const limpio = texto.trim();
  const m = /^(\d+)(?:[.,](\d+))?$/.exec(limpio);
  if (!m) return { ok: false };
  const decimales = m[2]?.length ?? 0;
  const valor = Number(`${m[1]}.${m[2] ?? "0"}`);
  return Number.isFinite(valor) ? { ok: true, valor, decimales } : { ok: false };
}

/** Lee un entero ("1", "12"). */
function leerEntero(texto: string): number | null {
  const limpio = texto.trim();
  return /^\d+$/.test(limpio) ? Number(limpio) : null;
}

// --- Validación -------------------------------------------------------------------

export type ErroresFila = Partial<Record<CampoFila, string>>;
export type AvisosFila = Partial<Record<CampoFila, string>>;

function validarPrecio(texto: string, nombre: string, obligatorio: boolean): string | undefined {
  if (texto.trim() === "") return obligatorio ? `Escribe ${nombre}.` : undefined;
  const n = leerNumero(texto);
  if (!n.ok) return `Escribe ${nombre} solo con números, por ejemplo 18.50 o 18,50 (sin $).`;
  if (n.decimales > 2) return "Usa como máximo 2 decimales (centavos).";
  if (n.valor >= MAX_PRECIO) return "El precio es demasiado grande. Revísalo.";
  return undefined;
}

function validarPiezas(texto: string, minimo: number, mensajeMinimo: string): string | undefined {
  const n = leerEntero(texto);
  if (n === null) return "Escribe un número entero (sin decimales).";
  if (n < minimo) return mensajeMinimo;
  if (n > MAX_PIEZAS) return `Como máximo ${MAX_PIEZAS}.`;
  return undefined;
}

/** Errores que impiden guardar la fila (texto en español para la persona). */
export function validarFila(f: FilaBorrador): ErroresFila {
  const e: ErroresFila = {};

  const articulo = f.articulo.trim();
  if (articulo === "") e.articulo = "Escribe el nombre del artículo.";
  else if (articulo.length > MAX_ARTICULO) e.articulo = `Como máximo ${MAX_ARTICULO} letras.`;

  if (f.cantidad.trim() === "") {
    e.cantidad = "Escribe el contenido (por ejemplo 600).";
  } else {
    const n = leerNumero(f.cantidad);
    if (!n.ok) e.cantidad = "Escribe solo números, por ejemplo 600 o 1,5.";
    else if (n.valor <= 0) e.cantidad = "Debe ser mayor que 0.";
    else if (n.decimales > 3) e.cantidad = "Usa como máximo 3 decimales.";
    else if (n.valor >= MAX_CANTIDAD) e.cantidad = "El número es demasiado grande. Revísalo.";
  }

  if (f.unidad === "") e.unidad = "Elige la unidad.";

  const piezas = validarPiezas(f.piezas, 1, "Debe ser al menos 1.");
  if (piezas) e.piezas = piezas;

  const precio = validarPrecio(f.precio_regular, "el precio", true);
  if (precio) e.precio_regular = precio;

  if (f.marca.trim().length > MAX_MARCA_AREA) e.marca = `Como máximo ${MAX_MARCA_AREA} letras.`;
  if (f.area.trim().length > MAX_MARCA_AREA) e.area = `Como máximo ${MAX_MARCA_AREA} letras.`;
  if (f.observaciones.trim().length > MAX_OBSERVACIONES) {
    e.observaciones = `Como máximo ${MAX_OBSERVACIONES} letras.`;
  }

  if (f.tiene_promo) {
    if (f.promo_tipo === "") {
      e.promo_tipo = "Elige el tipo de promoción (o quita la marca de \"Tiene promoción\").";
    } else if (f.promo_tipo === "precio_rebajado") {
      const p = validarPrecio(f.promo_precio_total, "el precio con promoción", true);
      if (p) e.promo_precio_total = p;
    } else if (f.promo_tipo === "n_por_precio") {
      const pz = validarPiezas(f.promo_piezas, 2, "Deben ser al menos 2 piezas (por ejemplo 2 x $30).");
      if (pz) e.promo_piezas = pz;
      const p = validarPrecio(f.promo_precio_total, "el precio total de la promoción", true);
      if (p) e.promo_precio_total = p;
    } else if (f.promo_tipo === "nxm") {
      const lleva = validarPiezas(f.promo_piezas, 2, "Deben ser al menos 2 piezas (por ejemplo lleva 3).");
      if (lleva) e.promo_piezas = lleva;
      const paga = validarPiezas(f.promo_paga_piezas, 1, "Debe ser al menos 1.");
      if (paga) e.promo_paga_piezas = paga;
      else if (!lleva && Number(f.promo_paga_piezas) >= Number(f.promo_piezas)) {
        e.promo_paga_piezas = "Debe pagar MENOS piezas de las que lleva (por ejemplo lleva 3, paga 2).";
      }
    } else {
      // "otro": piezas y precio son opcionales.
      if (f.promo_piezas.trim() !== "") {
        const pz = validarPiezas(f.promo_piezas, 1, "Debe ser al menos 1.");
        if (pz) e.promo_piezas = pz;
      }
      const p = validarPrecio(f.promo_precio_total, "el precio de la promoción", false);
      if (p) e.promo_precio_total = p;
    }
  }

  return e;
}

/** Avisos que NO impiden guardar (por ejemplo, precio en 0). */
export function avisosFila(f: FilaBorrador): AvisosFila {
  const a: AvisosFila = {};
  const precio = leerNumero(f.precio_regular);
  if (precio.ok && precio.valor === 0) {
    a.precio_regular = "El precio es 0. Si es correcto, puedes guardarlo así.";
  }
  if (f.tiene_promo && f.promo_tipo === "precio_rebajado" && precio.ok) {
    const promo = leerNumero(f.promo_precio_total);
    if (promo.ok && promo.valor >= precio.valor && precio.valor > 0) {
      a.promo_precio_total = "El precio con promoción no es menor que el regular. Revísalo.";
    }
  }
  return a;
}

/** Orden de los campos en pantalla (para llevar el foco al primer error). */
export const ORDEN_CAMPOS: CampoFila[] = [
  "articulo",
  "cantidad",
  "unidad",
  "piezas",
  "precio_regular",
  "marca",
  "area",
  "promo_tipo",
  "promo_piezas",
  "promo_paga_piezas",
  "promo_precio_total",
  "promo_condicion",
  "observaciones",
];

/** Texto vacío → null; si no, recortado. */
function textoONulo(t: string): string | null {
  const limpio = t.trim();
  return limpio === "" ? null : limpio;
}

function numeroONulo(t: string): number | null {
  const n = leerNumero(t);
  return n.ok ? n.valor : null;
}

/**
 * Convierte una fila YA VALIDADA en lo que se manda a Supabase. Manda TODAS las
 * columnas (también las vacías como null), porque en un insert de varias filas
 * supabase-js pone null en las que falten. Nunca manda usuario_id ni descartada_at.
 */
export function filaParaGuardar(visitaId: string, f: FilaBorrador): NuevaCapturaManual {
  const promoTipo: PromoTipo = f.tiene_promo && f.promo_tipo !== "" ? f.promo_tipo : "ninguna";
  const conPromo = promoTipo !== "ninguna";
  const marca = textoONulo(f.marca);
  const area = textoONulo(f.area);
  return {
    visita_id: visitaId,
    articulo: f.articulo.trim(),
    cantidad: numeroONulo(f.cantidad) ?? 0,
    unidad: f.unidad as Unidad,
    piezas: Number(f.piezas.trim()),
    precio_regular: numeroONulo(f.precio_regular) ?? 0,
    marca,
    marca_de_lista: marca !== null && f.marca_de_lista,
    area,
    area_de_lista: area !== null && f.area_de_lista,
    promo_tipo: promoTipo,
    promo_piezas:
      promoTipo === "precio_rebajado"
        ? 1
        : promoTipo === "n_por_precio" || promoTipo === "nxm" || promoTipo === "otro"
          ? (leerEntero(f.promo_piezas) ?? null)
          : null,
    promo_precio_total:
      promoTipo === "precio_rebajado" || promoTipo === "n_por_precio" || promoTipo === "otro"
        ? numeroONulo(f.promo_precio_total)
        : null,
    promo_paga_piezas: promoTipo === "nxm" ? leerEntero(f.promo_paga_piezas) : null,
    promo_condicion: conPromo ? f.promo_condicion : "ninguna",
    observaciones: textoONulo(f.observaciones),
  };
}

// --- Sugerencias -----------------------------------------------------------------

/** Minúsculas, sin acentos y sin espacios de más (como normalizar_texto de 004). */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export const MAX_SUGERENCIAS = 5;

/**
 * Hasta 5 sugerencias para lo escrito: primero las que EMPIEZAN con el texto y
 * luego las que lo CONTIENEN, sin distinguir mayúsculas ni acentos.
 * Ej.: "BE" → "BEBIDAS". Si lo escrito ya es IDÉNTICO a una opción, no sugiere nada
 * (si solo cambian mayúsculas o acentos, sí la sugiere: "lacteos" → "LÁCTEOS").
 */
export function filtrarSugerencias(opciones: readonly string[], texto: string): string[] {
  const buscado = normalizar(texto);
  if (buscado === "") return [];
  const tal = texto.trim();
  const empiezan: string[] = [];
  const contienen: string[] = [];
  for (const opcion of opciones) {
    if (opcion === tal) return [];
    const n = normalizar(opcion);
    if (n.startsWith(buscado)) empiezan.push(opcion);
    else if (n.includes(buscado)) contienen.push(opcion);
  }
  const porNombre = (a: string, b: string) => a.localeCompare(b, "es");
  return [...empiezan.sort(porNombre), ...contienen.sort(porNombre)].slice(0, MAX_SUGERENCIAS);
}

// --- Borrador en el celular (localStorage) -----------------------------------------
// Por persona y por visita, para no perder lo escrito si se va la señal o se cierra
// la pestaña. Nunca se guarda nada de otra persona. Todo con try/catch: en modo
// privado o con el almacenamiento bloqueado simplemente no hay borrador.

function claveBorrador(usuarioId: string, visitaId: string): string {
  return `levantamiento:captura:v1:${usuarioId}:${visitaId}`;
}

function esFilaBorrador(x: unknown): x is FilaBorrador {
  if (!x || typeof x !== "object") return false;
  const vacia = filaVacia();
  return (Object.keys(vacia) as (keyof FilaBorrador)[]).every(
    (k) => typeof (x as Record<string, unknown>)[k] === typeof vacia[k],
  );
}

export function leerBorrador(usuarioId: string, visitaId: string): FilaBorrador[] {
  try {
    const crudo = window.localStorage.getItem(claveBorrador(usuarioId, visitaId));
    if (!crudo) return [];
    const datos: unknown = JSON.parse(crudo);
    if (!Array.isArray(datos)) return [];
    // Se aceptan solo filas con la forma esperada y valores de lista válidos.
    return datos.filter(esFilaBorrador).map((f) => ({
      ...f,
      unidad: (UNIDADES as readonly string[]).includes(f.unidad) ? f.unidad : "",
      promo_tipo: (PROMO_TIPOS as readonly string[]).includes(f.promo_tipo) ? f.promo_tipo : "",
      promo_condicion: (CONDICIONES as readonly string[]).includes(f.promo_condicion)
        ? f.promo_condicion
        : "ninguna",
    }));
  } catch {
    return [];
  }
}

/** Guarda las filas con datos; si no queda ninguna, borra el borrador. */
export function guardarBorrador(usuarioId: string, visitaId: string, filas: FilaBorrador[]): void {
  try {
    const conDatos = filas.filter(filaTieneDatos);
    const clave = claveBorrador(usuarioId, visitaId);
    if (conDatos.length === 0) window.localStorage.removeItem(clave);
    else window.localStorage.setItem(clave, JSON.stringify(conDatos));
  } catch {
    // Sin almacenamiento: no hay borrador, pero la pantalla sigue funcionando.
  }
}

// --- Aviso al salir con filas sin guardar -------------------------------------------
// La pantalla de captura avisa aquí si tiene filas sin guardar. El enlace "Volver a
// la lista" lo consulta antes de salir. Con cacheComponents, una pantalla escondida
// limpia sus efectos, así que solo cuenta la visita que está a la vista.

const visitasConPendientes = new Set<string>();

export function marcarPendientes(visitaId: string, hay: boolean): void {
  if (hay) visitasConPendientes.add(visitaId);
  else visitasConPendientes.delete(visitaId);
}

export function hayCapturasSinGuardar(): boolean {
  return visitasConPendientes.size > 0;
}

// --- Para mostrar las filas guardadas ------------------------------------------------

const formatoPesos = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function formatearPesos(valor: number): string {
  return formatoPesos.format(valor);
}

const formatoCantidad = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 });

/** "600 ml" o "6 × 355 ml". */
export function textoContenido(cantidad: number, unidad: string, piezas: number): string {
  const una = `${formatoCantidad.format(cantidad)} ${unidad}`;
  return piezas > 1 ? `${piezas} × ${una}` : una;
}

/** "2 x $30.00 · solo con tarjeta" (o null si no hay promoción). */
export function textoPromocion(f: {
  promo_tipo: string;
  promo_piezas: number | null;
  promo_precio_total: number | null;
  promo_paga_piezas: number | null;
  promo_condicion: string;
}): string | null {
  let texto: string;
  switch (f.promo_tipo) {
    case "precio_rebajado":
      texto = `Precio rebajado: ${f.promo_precio_total != null ? formatearPesos(f.promo_precio_total) : "?"}`;
      break;
    case "n_por_precio":
      texto = `${f.promo_piezas ?? "?"} x ${f.promo_precio_total != null ? formatearPesos(f.promo_precio_total) : "?"}`;
      break;
    case "nxm":
      texto = `Lleva ${f.promo_piezas ?? "?"}, paga ${f.promo_paga_piezas ?? "?"}`;
      break;
    case "otro": {
      const partes = [
        f.promo_piezas != null ? `${f.promo_piezas} pzas` : "",
        f.promo_precio_total != null ? formatearPesos(f.promo_precio_total) : "",
      ].filter(Boolean);
      texto = `Otra promoción${partes.length ? `: ${partes.join(" por ")}` : ""}`;
      break;
    }
    default:
      return null;
  }
  const condicion = f.promo_condicion in NOMBRE_CONDICION ? f.promo_condicion : "otro";
  return condicion === "ninguna"
    ? texto
    : `${texto} · ${NOMBRE_CONDICION[condicion as PromoCondicion].toLowerCase()}`;
}
