// Captura rápida de productos (supabase/010_capturas_manuales.sql + 011_captura_rapida.sql).
//
// Aquí vive todo lo que NO es pantalla: cómo se limpian y leen los precios (con coma o
// punto), qué falta para poder agregar un producto, los avisos en español, el filtro de
// sugerencias de artículo y el borrador guardado en el celular. La pantalla está en
// src/app/visitas/[id]/CapturaManual.tsx.
//
// El formulario tiene SOLO 4 campos: artículo y precio regular (obligatorios), precio de
// promoción por pieza y observaciones (opcionales: NUNCA impiden agregar un producto).
// Las reglas son las MISMAS que la base de datos (los CHECK de 010 y 011). La app las
// revisa antes para dar mensajes claros; si algo se escapara, la base lo rechaza.

import type { NuevaCapturaManual } from "./tipos";

// --- Límites (los mismos de 011) ----------------------------------------------------

export const MAX_ARTICULO = 200;
export const MAX_OBSERVACIONES = 500;
/** Enteros de un precio: 7 dígitos (hasta 9,999,999.99; la base acepta < 100,000,000). */
const MAX_DIGITOS_ENTEROS = 7;
const MAX_DECIMALES = 2;
/** Arriba de esto se avisa ("¿seguro?"), pero se puede agregar igual. */
export const PRECIO_SOSPECHOSO = 10_000;

// --- Un producto en pantalla (todo como texto, tal como lo escribe la persona) -----

export type ProductoBorrador = {
  /** Solo para la pantalla (React key y correcciones). No se guarda en la base. */
  clave: string;
  articulo: string;
  /** true solo si el texto es EXACTAMENTE una sugerencia elegida (si se edita, false). */
  articulo_de_lista: boolean;
  precio_regular: string;
  promo_precio_pieza: string;
  observaciones: string;
};

export type CampoProducto = Exclude<keyof ProductoBorrador, "clave" | "articulo_de_lista">;

function claveNueva(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function productoVacio(): ProductoBorrador {
  return {
    clave: claveNueva(),
    articulo: "",
    articulo_de_lista: false,
    precio_regular: "",
    promo_precio_pieza: "",
    observaciones: "",
  };
}

/** true si la persona ya escribió algo en el formulario. */
export function productoTieneDatos(p: ProductoBorrador): boolean {
  return (
    p.articulo.trim() !== "" ||
    p.precio_regular.trim() !== "" ||
    p.promo_precio_pieza.trim() !== "" ||
    p.observaciones.trim() !== ""
  );
}

// --- Precios: solo números, con punto o coma, hasta 2 decimales ---------------------

const SEPARADOR = /[.,]/;

/**
 * Limpia lo que la persona ESCRIBE en un precio: descarta todo lo que no sea número,
 * deja solo el PRIMER separador (punto o coma, el que haya escrito), corta en 2
 * decimales y en 7 enteros. Ej.: "$18,50" → "18,50"; "12.5.3" → "12.53"; "1.999" → "1.99".
 */
export function limpiarPrecio(texto: string): string {
  let enteros = "";
  let decimales = "";
  let separador = "";
  for (const c of texto) {
    if (c >= "0" && c <= "9") {
      if (separador) {
        if (decimales.length < MAX_DECIMALES) decimales += c;
      } else if (enteros.length < MAX_DIGITOS_ENTEROS) {
        enteros += c;
      }
    } else if (SEPARADOR.test(c) && !separador) {
      separador = c;
    }
  }
  return enteros + separador + decimales;
}

/**
 * Limpia lo que la persona PEGA en un precio. Si trae varios separadores
 * ("$1,234.50"), el ÚLTIMO es el decimal y los demás se quitan (eran de miles).
 */
export function limpiarPrecioPegado(texto: string): string {
  const soloNumeros = texto.replace(/[^\d.,]/g, "");
  const ultimo = Math.max(soloNumeros.lastIndexOf("."), soloNumeros.lastIndexOf(","));
  if (ultimo < 0) return limpiarPrecio(soloNumeros);
  const sinMiles = soloNumeros.slice(0, ultimo).replace(/[.,]/g, "") + soloNumeros.slice(ultimo);
  return limpiarPrecio(sinMiles);
}

/** Lee un precio ya limpio: "18,50" → 18.5. Vacío o solo "." → null. */
export function leerPrecio(texto: string): number | null {
  const limpio = limpiarPrecio(texto.trim());
  const [enteros = "", decimales = ""] = limpio.split(SEPARADOR);
  if (enteros === "" && decimales === "") return null;
  const valor = Number(`${enteros || "0"}.${decimales || "0"}`);
  return Number.isFinite(valor) ? valor : null;
}

// --- Qué falta y avisos ----------------------------------------------------------------

export type FaltaProducto = "artículo" | "precio regular";

/** Lo que falta para poder agregar el producto (solo artículo y precio regular). */
export function faltantes(p: ProductoBorrador): FaltaProducto[] {
  const falta: FaltaProducto[] = [];
  if (p.articulo.trim() === "") falta.push("artículo");
  if (leerPrecio(p.precio_regular) === null) falta.push("precio regular");
  return falta;
}

/** "Falta: artículo y precio regular" (o null si ya se puede agregar). */
export function textoFalta(falta: FaltaProducto[]): string | null {
  if (falta.length === 0) return null;
  return `Falta: ${falta.join(" y ")}`;
}

export type AvisosProducto = Partial<Record<"precio_regular" | "promo_precio_pieza", string>>;

/** Avisos que NO impiden agregar (la persona revisa y decide). */
export function avisosProducto(p: ProductoBorrador): AvisosProducto {
  const a: AvisosProducto = {};
  const regular = leerPrecio(p.precio_regular);
  const promo = leerPrecio(p.promo_precio_pieza);
  if (regular === 0) {
    a.precio_regular = "El precio regular es 0. Revísalo (si es correcto, puedes agregarlo así).";
  } else if (regular !== null && regular > PRECIO_SOSPECHOSO) {
    a.precio_regular = "El precio parece muy alto (más de $10,000). Revísalo.";
  }
  if (promo !== null) {
    if (regular !== null && regular > 0 && promo >= regular) {
      a.promo_precio_pieza = "La promoción no es menor que el precio regular. Revísala.";
    } else if (promo > PRECIO_SOSPECHOSO) {
      a.promo_precio_pieza = "La promoción parece muy alta (más de $10,000). Revísala.";
    }
  }
  return a;
}

/** Texto vacío → null; si no, recortado. */
function textoONulo(t: string): string | null {
  const limpio = t.trim();
  return limpio === "" ? null : limpio;
}

/**
 * Convierte un producto YA COMPLETO en lo que se manda a Supabase. Siempre las MISMAS
 * columnas (en un insert de varias filas, supabase-js pone null en las que falten).
 * No manda cantidad, unidad ni piezas: la base deja vacías las dos primeras y piezas = 1.
 * Nunca manda usuario_id ni descartada_at.
 */
export function productoParaGuardar(visitaId: string, p: ProductoBorrador): NuevaCapturaManual {
  const articulo = p.articulo.trim().slice(0, MAX_ARTICULO);
  const observaciones = textoONulo(p.observaciones);
  return {
    visita_id: visitaId,
    articulo,
    articulo_de_lista: p.articulo_de_lista,
    precio_regular: leerPrecio(p.precio_regular) ?? 0,
    promo_precio_pieza: leerPrecio(p.promo_precio_pieza),
    observaciones: observaciones === null ? null : observaciones.slice(0, MAX_OBSERVACIONES),
  };
}

// --- Sugerencias de artículo -----------------------------------------------------------

/** Minúsculas, sin acentos y sin espacios de más (como normalizar_texto de 004). */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export const MIN_CARACTERES_SUGERENCIA = 2;
/**
 * La lista de sugerencias muestra TODAS las coincidencias, pero las pinta en bloques de
 * este tamaño: al acercarse al final del scroll se agrega el siguiente bloque.
 */
export const SUGERENCIAS_POR_BLOQUE = 50;
/** Renglones a la vista en la caja de sugerencias (o el 45 % de la pantalla, lo que sea menor). */
export const RENGLONES_VISIBLES = 6;

/** Cada lista de opciones se normaliza UNA vez (el catálogo tiene miles de artículos). */
const normalizadas = new WeakMap<readonly string[], string[]>();

function versionNormalizada(opciones: readonly string[]): string[] {
  let n = normalizadas.get(opciones);
  if (!n) {
    n = opciones.map(normalizar);
    normalizadas.set(opciones, n);
  }
  return n;
}

/**
 * TODAS las sugerencias para lo escrito (mínimo 2 letras), sin distinguir mayúsculas ni
 * acentos. Lo escrito se parte en palabras y TODAS deben aparecer, en cualquier orden:
 * "coca zero" encuentra "Refresco coca cola zero 250 ml". Primero las que EMPIEZAN con
 * lo escrito y luego las que lo CONTIENEN, cada grupo en orden alfabético.
 * Si lo escrito ya es IDÉNTICO a una opción (por ejemplo, recién elegida), no sugiere nada.
 * La pantalla decide cuántas pinta a la vez (SUGERENCIAS_POR_BLOQUE); el total es
 * siempre el largo de esta lista.
 */
export function filtrarSugerencias(opciones: readonly string[], texto: string): string[] {
  const buscado = normalizar(texto);
  if (buscado.length < MIN_CARACTERES_SUGERENCIA) return [];
  const palabras = buscado.split(" ");
  const tal = texto.trim();
  const norm = versionNormalizada(opciones);
  const empiezan: string[] = [];
  const contienen: string[] = [];
  for (let i = 0; i < opciones.length; i++) {
    if (opciones[i] === tal) return [];
    const n = norm[i];
    if (!palabras.every((p) => n.includes(p))) continue;
    if (n.startsWith(buscado)) empiezan.push(opciones[i]);
    else contienen.push(opciones[i]);
  }
  const porNombre = (a: string, b: string) => a.localeCompare(b, "es");
  return [...empiezan.sort(porNombre), ...contienen.sort(porNombre)];
}

/** "1 coincidencia", "128 coincidencias". */
export function textoCoincidencias(n: number): string {
  return `${n.toLocaleString("es-MX")} ${n === 1 ? "coincidencia" : "coincidencias"}`;
}

/**
 * Cuántas sugerencias pintar después de mover el scroll o la selección:
 *   - nunca más que el total ni menos de un bloque (si hay);
 *   - si el scroll está a menos de `margen` px del final, o la selección (teclado) llegó
 *     al último bloque pintado, se agrega el siguiente bloque.
 * Así el bloque nuevo aparece ANTES de llegar al final: no se nota el corte.
 */
export function cantidadAPintar(
  actual: number,
  total: number,
  opciones: { distanciaAlFinal?: number; margen?: number; activa?: number } = {},
): number {
  const { distanciaAlFinal, margen = 0, activa = -1 } = opciones;
  let n = Math.min(total, Math.max(actual, SUGERENCIAS_POR_BLOQUE));
  const cercaDelFinal = distanciaAlFinal !== undefined && distanciaAlFinal <= margen;
  const seleccionAlFinal = activa >= n - 1 - Math.floor(SUGERENCIAS_POR_BLOQUE / 5);
  if (n < total && (cercaDelFinal || (activa >= 0 && seleccionAlFinal))) {
    n = Math.min(total, n + SUGERENCIAS_POR_BLOQUE);
  }
  return n;
}

/**
 * Al guardar un artículo EDITADO: articulo_de_lista es true solo si el texto final es
 * EXACTAMENTE igual a una sugerencia. Si las sugerencias no se pudieron cargar, no se
 * puede comprobar: se conserva la marca original solo si el texto no cambió.
 */
export function articuloEsDeLista(
  articuloFinal: string,
  opciones: readonly string[] | null,
  original?: { articulo: string; articulo_de_lista: boolean },
): boolean {
  if (opciones && opciones.length > 0) return opciones.includes(articuloFinal);
  return original !== undefined && original.articulo === articuloFinal && original.articulo_de_lista;
}

// --- Borrador en el celular (localStorage) -----------------------------------------
// Por persona y por visita, para no perder lo escrito si se va la señal o se cierra la
// pestaña: el formulario a medias y la lista de productos sin guardar. Nunca se guarda
// nada de otra persona. Todo con try/catch: en modo privado o con el almacenamiento
// bloqueado simplemente no hay borrador.
//
// "v2": el formato de 011. Los borradores del formulario anterior (010) se guardaron con
// la clave "v1" y una forma distinta: se ignoran (no se leen ni se borran).

export type Borrador = { formulario: ProductoBorrador; pendientes: ProductoBorrador[] };

function claveBorrador(usuarioId: string, visitaId: string): string {
  return `levantamiento:captura:v2:${usuarioId}:${visitaId}`;
}

function esProducto(x: unknown): x is ProductoBorrador {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.clave === "string" &&
    typeof o.articulo === "string" &&
    typeof o.articulo_de_lista === "boolean" &&
    typeof o.precio_regular === "string" &&
    typeof o.promo_precio_pieza === "string" &&
    typeof o.observaciones === "string"
  );
}

/** Lo vuelve a limpiar por si el almacenamiento trae algo raro. */
function sanear(p: ProductoBorrador): ProductoBorrador {
  return {
    clave: p.clave,
    articulo: p.articulo.slice(0, MAX_ARTICULO),
    articulo_de_lista: p.articulo_de_lista,
    precio_regular: limpiarPrecio(p.precio_regular),
    promo_precio_pieza: limpiarPrecio(p.promo_precio_pieza),
    observaciones: p.observaciones.slice(0, MAX_OBSERVACIONES),
  };
}

export function leerBorrador(usuarioId: string, visitaId: string): Borrador | null {
  try {
    const crudo = window.localStorage.getItem(claveBorrador(usuarioId, visitaId));
    if (!crudo) return null;
    const datos: unknown = JSON.parse(crudo);
    if (!datos || typeof datos !== "object") return null;
    const { formulario, pendientes } = datos as Record<string, unknown>;
    const lista = Array.isArray(pendientes)
      ? pendientes.filter(esProducto).map(sanear).filter((p) => faltantes(p).length === 0)
      : [];
    let form = esProducto(formulario) ? sanear(formulario) : productoVacio();
    // Si se cerró a media corrección, el formulario trae la clave de un producto que
    // también está en la lista: se le da otra para que no se confundan.
    if (lista.some((p) => p.clave === form.clave)) form = { ...form, clave: claveNueva() };
    if (lista.length === 0 && !productoTieneDatos(form)) return null;
    return { formulario: form, pendientes: lista };
  } catch {
    return null;
  }
}

/** Guarda el borrador; si no queda nada escrito, lo borra. */
export function guardarBorrador(usuarioId: string, visitaId: string, b: Borrador): void {
  try {
    const clave = claveBorrador(usuarioId, visitaId);
    if (b.pendientes.length === 0 && !productoTieneDatos(b.formulario)) {
      window.localStorage.removeItem(clave);
    } else {
      window.localStorage.setItem(clave, JSON.stringify(b));
    }
  } catch {
    // Sin almacenamiento: no hay borrador, pero la pantalla sigue funcionando.
  }
}

// --- Aviso al salir con productos sin guardar ------------------------------------------
// La pantalla de captura avisa aquí si tiene productos sin guardar. El enlace "Volver a
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

// --- Para mostrar productos ------------------------------------------------------------

const formatoPesos = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function formatearPesos(valor: number): string {
  return formatoPesos.format(valor);
}

const formatoCantidad = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 });

/**
 * Filas guardadas con el formulario anterior (010): "600 ml" o "6 × 355 ml".
 * null si la fila no tiene presentación (formulario de 011).
 */
export function textoContenido(cantidad: number | null, unidad: string | null, piezas: number | null): string | null {
  if (cantidad == null || unidad == null) return null;
  const una = `${formatoCantidad.format(cantidad)} ${unidad}`;
  return piezas != null && piezas > 1 ? `${piezas} × ${una}` : una;
}

const NOMBRE_CONDICION: Record<string, string> = {
  tarjeta: "solo con tarjeta",
  app: "solo con la app de la tienda",
  otro: "otra condición",
};

/**
 * Promoción de una fila guardada en una línea: "promo $21.00" (011) o, en filas del
 * formulario anterior (010), "2 x $30.00 · solo con tarjeta". null si no hay.
 */
export function textoPromocion(f: {
  promo_precio_pieza: number | null;
  promo_tipo: string;
  promo_piezas: number | null;
  promo_precio_total: number | null;
  promo_paga_piezas: number | null;
  promo_condicion: string;
}): string | null {
  const partes: string[] = [];
  if (f.promo_precio_pieza != null) partes.push(`promo ${formatearPesos(f.promo_precio_pieza)}`);
  const total = f.promo_precio_total != null ? formatearPesos(f.promo_precio_total) : "?";
  switch (f.promo_tipo) {
    case "precio_rebajado":
      partes.push(`rebajado ${total}`);
      break;
    case "n_por_precio":
      partes.push(`${f.promo_piezas ?? "?"} x ${total}`);
      break;
    case "nxm":
      partes.push(`lleva ${f.promo_piezas ?? "?"}, paga ${f.promo_paga_piezas ?? "?"}`);
      break;
    case "otro":
      partes.push("otra promoción");
      break;
  }
  if (f.promo_tipo !== "ninguna" && f.promo_condicion in NOMBRE_CONDICION) {
    partes.push(NOMBRE_CONDICION[f.promo_condicion]);
  }
  return partes.length > 0 ? partes.join(" · ") : null;
}
