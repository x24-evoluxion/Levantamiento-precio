// Validación del paquete de precios del SCA (x24_articulos.csv y
// x24_promociones.csv). SOLO SERVIDOR: lo usa scripts/etapa2/importar-catalogo.ts.
// Nunca se importa desde la app.
//
// Reglas (PLAN_ETAPA2 5.6.5 y decisiones del 2026-11-20):
//   - clave es SIEMPRE texto: nunca pasa por Number() ni parseInt.
//   - Errores de FORMATO detienen la importación.
//   - Problemas de CALIDAD no la detienen, no se corrigen y van al reporte privado.
//   - NO se cargan datos de venta, mayoreo, impuestos, resúmenes de promoción,
//     precio normal registrado, descuento ni clave_es_ean. Algunas de esas
//     columnas se LEEN del archivo solo para las revisiones de calidad.

import type { FilaCsv } from "./csv.ts";

type Tipo = "fecha" | "texto" | "01" | "entero" | "decimal";

type Columna = {
  nombre: string;
  /** Tipo como lo escribe diccionario.csv. */
  tipoDiccionario: string;
  tipo: Tipo;
  obligatoria?: boolean;
  /** Se manda a Supabase. */
  carga?: boolean;
  /** Para decimales que se cargan en columnas con límite: si no cabe, ERROR de formato. */
  decimales?: number;
  enteros?: number;
  /** Para decimales que se cargan SIN límite: si traen más decimales, PROBLEMA DE CALIDAD
   * (se guardan exactos, no se redondean). */
  avisoDecimales?: number;
};

const dec2 = { tipo: "decimal" as const, decimales: 2, enteros: 8 };

export const COLUMNAS_ARTICULOS: Columna[] = [
  { nombre: "fecha_corte", tipoDiccionario: "fecha", tipo: "fecha", obligatoria: true },
  { nombre: "clave", tipoDiccionario: "texto", tipo: "texto", obligatoria: true, carga: true },
  { nombre: "clave_es_ean", tipoDiccionario: "0/1", tipo: "01" },
  { nombre: "descripcion", tipoDiccionario: "texto", tipo: "texto", obligatoria: true, carga: true },
  { nombre: "area_id", tipoDiccionario: "entero", tipo: "entero", carga: true },
  { nombre: "area", tipoDiccionario: "texto", tipo: "texto", carga: true },
  { nombre: "depto_id", tipoDiccionario: "entero", tipo: "entero", carga: true },
  { nombre: "departamento", tipoDiccionario: "texto", tipo: "texto", carga: true },
  { nombre: "nacs_subcategoria_id", tipoDiccionario: "texto", tipo: "texto", carga: true },
  { nombre: "nacs_categoria_id", tipoDiccionario: "texto", tipo: "texto", carga: true },
  { nombre: "nacs_categoria", tipoDiccionario: "texto", tipo: "texto", carga: true },
  { nombre: "contenido_pieza", tipoDiccionario: "decimal", tipo: "decimal", carga: true, avisoDecimales: 3 },
  { nombre: "unidad_contenido", tipoDiccionario: "texto", tipo: "texto", carga: true },
  { nombre: "es_servicio", tipoDiccionario: "0/1", tipo: "01", obligatoria: true, carga: true },
  { nombre: "obsoleto", tipoDiccionario: "0/1", tipo: "01", obligatoria: true, carga: true },
  { nombre: "de_baja", tipoDiccionario: "0/1", tipo: "01", obligatoria: true, carga: true },
  { nombre: "tasa_iva", tipoDiccionario: "decimal", tipo: "decimal" },
  { nombre: "tasa_ieps", tipoDiccionario: "decimal", tipo: "decimal" },
  { nombre: "precio_regular", tipoDiccionario: "decimal MXN", ...dec2, obligatoria: true, carga: true },
  { nombre: "precio_regular_sin_impuestos", tipoDiccionario: "decimal MXN", tipo: "decimal" },
  { nombre: "fecha_ultimo_cambio_precio", tipoDiccionario: "fecha", tipo: "fecha", carga: true },
  { nombre: "precio_mayoreo", tipoDiccionario: "decimal MXN", tipo: "decimal" },
  { nombre: "mayoreo_desde_piezas", tipoDiccionario: "entero", tipo: "entero" },
  { nombre: "promos_vigentes_al_corte", tipoDiccionario: "entero", tipo: "entero" },
  { nombre: "precio_promo_pieza_min_al_corte", tipoDiccionario: "decimal MXN", tipo: "decimal" },
  { nombre: "piezas_12m", tipoDiccionario: "decimal", tipo: "decimal" },
  { nombre: "venta_12m_sin_impuestos", tipoDiccionario: "decimal MXN", tipo: "decimal" },
  { nombre: "fecha_ultima_venta", tipoDiccionario: "fecha", tipo: "fecha" },
];

export const COLUMNAS_PROMOCIONES: Columna[] = [
  { nombre: "fecha_corte", tipoDiccionario: "fecha", tipo: "fecha", obligatoria: true },
  { nombre: "origen", tipoDiccionario: "texto", tipo: "texto", obligatoria: true, carga: true },
  { nombre: "id_promocion", tipoDiccionario: "entero", tipo: "entero", carga: true },
  { nombre: "categoria_promo_id", tipoDiccionario: "entero", tipo: "entero", carga: true },
  { nombre: "categoria_promo", tipoDiccionario: "texto", tipo: "texto", carga: true },
  { nombre: "descripcion_promo", tipoDiccionario: "texto", tipo: "texto", carga: true },
  { nombre: "regiones", tipoDiccionario: "texto", tipo: "texto", carga: true },
  { nombre: "fecha_inicio", tipoDiccionario: "fecha", tipo: "fecha", obligatoria: true, carga: true },
  { nombre: "fecha_fin", tipoDiccionario: "fecha", tipo: "fecha", obligatoria: true, carga: true },
  { nombre: "activa", tipoDiccionario: "0/1", tipo: "01", carga: true },
  { nombre: "vigente_al_corte", tipoDiccionario: "0/1", tipo: "01", carga: true },
  { nombre: "es_combo", tipoDiccionario: "0/1", tipo: "01", obligatoria: true, carga: true },
  { nombre: "num_grupos", tipoDiccionario: "entero", tipo: "entero", carga: true },
  { nombre: "id_grupo", tipoDiccionario: "entero", tipo: "entero", carga: true },
  { nombre: "clave", tipoDiccionario: "texto", tipo: "texto", obligatoria: true, carga: true },
  { nombre: "piezas_requeridas", tipoDiccionario: "entero", tipo: "entero", carga: true },
  { nombre: "precio_promo_pieza", tipoDiccionario: "decimal MXN", tipo: "decimal", carga: true, avisoDecimales: 2 },
  { nombre: "precio_promo_grupo", tipoDiccionario: "decimal MXN", tipo: "decimal", carga: true, avisoDecimales: 2 },
  { nombre: "precio_promo_total", tipoDiccionario: "decimal MXN", tipo: "decimal", carga: true, avisoDecimales: 2 },
  { nombre: "precio_regular_al_inicio", tipoDiccionario: "decimal MXN", tipo: "decimal", carga: true, avisoDecimales: 2 },
  { nombre: "precio_normal_registrado", tipoDiccionario: "decimal MXN", tipo: "decimal" },
  { nombre: "descuento_pct", tipoDiccionario: "decimal", tipo: "decimal" },
  { nombre: "piezas_vendidas_promo", tipoDiccionario: "decimal", tipo: "decimal" },
  { nombre: "importe_vendido_promo", tipoDiccionario: "decimal MXN", tipo: "decimal" },
];

export const ARCHIVO_ARTICULOS = "x24_articulos.csv";
export const ARCHIVO_PROMOCIONES = "x24_promociones.csv";

const ORIGENES = new Set(["promogrupo", "catalogo"]);
const UNIDADES_ARCHIVO = new Set(["g", "ml"]);

// ---------------------------------------------------------------------------
// Tipos de salida
// ---------------------------------------------------------------------------

/** Un renglón del reporte privado (va a datos-privados/, nunca a pantalla). */
export type Hallazgo = {
  tipo: string;
  archivo: string;
  renglon: number | null;
  clave: string;
  /** Para promociones: origen|id_promocion|id_grupo. */
  llavePromocion: string;
  columnas: string;
  detalle: string;
};

/** Una revisión que se corrió: qué, desde qué columnas y cuántos encontró. */
export type Revision = {
  tipo: string;
  clase: "formato" | "calidad" | "contenido";
  archivo: string;
  columnas: string;
  descripcion: string;
};

export type ArticuloCarga = {
  clave: string;
  descripcion: string;
  area_id: string | null;
  area: string | null;
  depto_id: string | null;
  departamento: string | null;
  nacs_subcategoria_id: string | null;
  nacs_categoria_id: string | null;
  nacs_categoria: string | null;
  cantidad: string | null;
  unidad: string | null;
  es_servicio: boolean;
  obsoleto: boolean;
  de_baja: boolean;
  precio_regular: string;
  fecha_ultimo_cambio_precio: string | null;
};

export type PromocionCarga = {
  origen: string;
  id_promocion: string | null;
  categoria_promo_id: string | null;
  categoria_promo: string | null;
  descripcion_promo: string | null;
  regiones: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  activa: boolean | null;
  vigente_al_corte: boolean | null;
  es_combo: boolean;
  num_grupos: string | null;
  id_grupo: string | null;
  clave: string;
  piezas_requeridas: string | null;
  precio_promo_pieza: string | null;
  precio_promo_grupo: string | null;
  precio_promo_total: string | null;
  precio_regular_al_inicio: string | null;
};

export type SinContenido = { clave: string; renglon: number; descripcion: string; pista: string };

export type Resultado = {
  fechaCorte: string | null;
  articulos: ArticuloCarga[];
  promociones: PromocionCarga[];
  errores: Hallazgo[];
  calidad: Hallazgo[];
  sinContenido: SinContenido[];
  revisiones: Revision[];
  filasArticulos: number;
  filasPromociones: number;
};

// ---------------------------------------------------------------------------
// Lista de revisiones (se escribe completa en el reporte, con su conteo)
// ---------------------------------------------------------------------------
const A = ARCHIVO_ARTICULOS;
const P = ARCHIVO_PROMOCIONES;
const AMBOS = `${A} y ${P}`;

export const REVISIONES: Revision[] = [
  // Formato (detienen la importación)
  { tipo: "encabezados_distintos", clase: "formato", archivo: AMBOS, columnas: "encabezados", descripcion: "Encabezados exactos y en el mismo orden que diccionario.csv" },
  { tipo: "tipo_distinto_en_diccionario", clase: "formato", archivo: "diccionario.csv", columnas: "tabla, columna, tipo", descripcion: "El tipo de cada columna en el diccionario es el esperado" },
  { tipo: "numero_de_campos", clase: "formato", archivo: AMBOS, columnas: "todas", descripcion: "Cada renglón trae el mismo número de campos que los encabezados" },
  { tipo: "clave_vacia", clase: "formato", archivo: AMBOS, columnas: "clave", descripcion: "Clave vacía" },
  { tipo: "clave_con_espacios", clase: "formato", archivo: AMBOS, columnas: "clave", descripcion: "Clave con espacios al inicio o al final" },
  { tipo: "obligatoria_vacia", clase: "formato", archivo: AMBOS, columnas: "columnas obligatorias", descripcion: "Columna obligatoria vacía" },
  { tipo: "fecha_invalida", clase: "formato", archivo: AMBOS, columnas: "columnas de fecha", descripcion: "Fecha que no es aaaa-mm-dd válida" },
  { tipo: "decimal_invalido", clase: "formato", archivo: AMBOS, columnas: "columnas decimales", descripcion: "Número con formato distinto a punto decimal" },
  { tipo: "entero_invalido", clase: "formato", archivo: AMBOS, columnas: "columnas enteras", descripcion: "Entero con formato inválido o fuera de rango" },
  { tipo: "valor_01_invalido", clase: "formato", archivo: AMBOS, columnas: "columnas 0/1", descripcion: "Valor sí/no distinto de 0 o 1" },
  { tipo: "no_cabe_en_la_base", clase: "formato", archivo: A, columnas: "precio_regular", descripcion: "precio_regular con más de 2 decimales o más de 8 enteros (la base lo redondearía)" },
  { tipo: "fecha_corte_distinta", clase: "formato", archivo: AMBOS, columnas: "fecha_corte", descripcion: "Todas las filas de los dos archivos traen la misma fecha_corte" },
  { tipo: "llave_repetida", clase: "formato", archivo: AMBOS, columnas: `${A}: clave; ${P}: origen, id_promocion, id_grupo, clave`, descripcion: "Llave repetida dentro del corte" },
  { tipo: "origen_invalido", clase: "formato", archivo: P, columnas: "origen", descripcion: "origen distinto de promogrupo o catalogo" },
  { tipo: "unidad_invalida", clase: "formato", archivo: A, columnas: "unidad_contenido", descripcion: "Unidad distinta de g o ml" },
  { tipo: "contenido_incompleto", clase: "formato", archivo: A, columnas: "contenido_pieza, unidad_contenido", descripcion: "Contenido sin unidad o unidad sin contenido" },
  { tipo: "contenido_no_positivo", clase: "formato", archivo: A, columnas: "contenido_pieza", descripcion: "Contenido 0 o negativo" },
  // Calidad (no detienen, no se corrigen)
  { tipo: "mayoreo_mayor_o_igual_al_regular", clase: "calidad", archivo: A, columnas: "precio_mayoreo, precio_regular", descripcion: "Precio de mayoreo mayor o igual al regular" },
  { tipo: "precio_regular_cero_o_negativo", clase: "calidad", archivo: A, columnas: "precio_regular, es_servicio", descripcion: "Precio regular <= 0 en un artículo que no es servicio" },
  { tipo: "descripcion_repetida", clase: "calidad", archivo: A, columnas: "descripcion, clave", descripcion: "Misma descripción (sin distinguir espacios) con claves distintas; un renglón por clave" },
  { tipo: "sin_impuestos_no_cuadra", clase: "calidad", archivo: A, columnas: "precio_regular, precio_regular_sin_impuestos, tasa_iva, tasa_ieps", descripcion: "sin_impuestos × (1 + iva) × (1 + ieps) difiere del regular en más de 1 centavo" },
  { tipo: "descuento_negativo", clase: "calidad", archivo: P, columnas: "descuento_pct", descripcion: "Descuento negativo (promoción más cara que el normal registrado)" },
  { tipo: "promo_grupo_no_cuadra", clase: "calidad", archivo: P, columnas: "precio_promo_grupo, piezas_requeridas, precio_promo_pieza", descripcion: "precio_promo_grupo difiere de piezas × pieza en más de 1 centavo por pieza" },
  { tipo: "fecha_inicio_posterior_a_fin", clase: "calidad", archivo: P, columnas: "fecha_inicio, fecha_fin", descripcion: "La promoción empieza después de terminar" },
  { tipo: "promo_pieza_mayor_o_igual_al_regular", clase: "calidad", archivo: P, columnas: "precio_promo_pieza, precio_regular_al_inicio, es_combo", descripcion: "Precio de promoción por pieza >= regular al inicio, sin ser combo" },
  { tipo: "promocion_sin_articulo", clase: "calidad", archivo: AMBOS, columnas: `${P}: clave; ${A}: clave`, descripcion: "Clave de promoción que no está en los artículos" },
  { tipo: "decimales_de_mas", clase: "calidad", archivo: AMBOS, columnas: `${A}: contenido_pieza (más de 3); ${P}: precio_promo_pieza, precio_promo_grupo, precio_promo_total, precio_regular_al_inicio (más de 2)`, descripcion: "Más decimales de lo normal; se guarda EXACTO como viene (no se redondea)" },
  // Contenido (va a revision_contenido_<fecha>.csv)
  { tipo: "contenido_sin_dato", clase: "contenido", archivo: A, columnas: "contenido_pieza, unidad_contenido, descripcion", descripcion: "Artículo sin contenido; se carga como sin_dato" },
];

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
const RE_DECIMAL = /^-?\d+(\.\d+)?$/;
const RE_ENTERO = /^-?\d+$/;
const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const INT_MAX = BigInt(2147483647);
const INT_MIN = BigInt(-2147483648);

function fechaValida(v: string): boolean {
  const m = RE_FECHA.exec(v);
  if (!m) return false;
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(Date.UTC(a, me - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === me - 1 && f.getUTCDate() === d;
}

/** Centavos enteros de un precio ya validado (los precios NO son claves). */
function centavos(v: string): number {
  return Math.round(Number(v) * 100);
}

const vacio = (v: string) => v === "";
const oNulo = (v: string) => (v === "" ? null : v);
const bool = (v: string) => v === "1";
const boolONulo = (v: string) => (v === "" ? null : v === "1");

export function compararEncabezados(
  archivo: string,
  encontrados: string[],
  esperados: Columna[],
  diccionario: Map<string, { columna: string; tipo: string }[]>,
  tabla: string,
): Hallazgo[] {
  const errores: Hallazgo[] = [];
  const nombres = esperados.map((c) => c.nombre);
  const delDiccionario = (diccionario.get(tabla) ?? []).map((d) => d.columna);
  const igual = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

  if (!igual(encontrados, nombres) || !igual(encontrados, delDiccionario)) {
    errores.push({
      tipo: "encabezados_distintos", archivo, renglon: 1, clave: "", llavePromocion: "",
      columnas: "encabezados",
      detalle: `archivo=[${encontrados.join(" ")}] esperado=[${nombres.join(" ")}] diccionario=[${delDiccionario.join(" ")}]`,
    });
  }
  for (const d of diccionario.get(tabla) ?? []) {
    const c = esperados.find((e) => e.nombre === d.columna);
    if (c && c.tipoDiccionario !== d.tipo) {
      errores.push({
        tipo: "tipo_distinto_en_diccionario", archivo: "diccionario.csv", renglon: null, clave: "",
        llavePromocion: "", columnas: `${tabla}.${d.columna}`,
        detalle: `diccionario=${d.tipo} esperado=${c.tipoDiccionario}`,
      });
    }
  }
  return errores;
}

export function leerDiccionario(filas: FilaCsv[]): Map<string, { columna: string; tipo: string }[]> {
  const mapa = new Map<string, { columna: string; tipo: string }[]>();
  const [enc, ...resto] = filas;
  const iTabla = enc.campos.indexOf("tabla");
  const iColumna = enc.campos.indexOf("columna");
  const iTipo = enc.campos.indexOf("tipo");
  if (iTabla < 0 || iColumna < 0 || iTipo < 0) {
    throw new Error("diccionario.csv no trae las columnas tabla, columna y tipo");
  }
  for (const f of resto) {
    const tabla = f.campos[iTabla];
    if (!mapa.has(tabla)) mapa.set(tabla, []);
    mapa.get(tabla)!.push({ columna: f.campos[iColumna], tipo: f.campos[iTipo] });
  }
  return mapa;
}

/** Revisa el formato de un renglón. Devuelve un objeto nombre→valor si no hay errores. */
function validarFormato(
  archivo: string,
  fila: FilaCsv,
  columnas: Columna[],
  errores: Hallazgo[],
  llave: (r: Record<string, string>) => { clave: string; llavePromocion: string },
): Record<string, string> | null {
  const base = { archivo, renglon: fila.renglon };
  if (fila.campos.length !== columnas.length) {
    errores.push({ ...base, tipo: "numero_de_campos", clave: "", llavePromocion: "", columnas: "todas",
      detalle: `campos=${fila.campos.length} esperados=${columnas.length}` });
    return null;
  }
  const r: Record<string, string> = {};
  columnas.forEach((c, i) => (r[c.nombre] = fila.campos[i]));
  const { clave, llavePromocion } = llave(r);
  const antes = errores.length;
  const err = (tipo: string, columna: string, detalle = "") =>
    errores.push({ ...base, tipo, clave, llavePromocion, columnas: columna, detalle });

  for (const c of columnas) {
    const v = r[c.nombre];
    if (c.nombre === "clave") {
      if (vacio(v)) err("clave_vacia", c.nombre);
      else if (v !== v.trim()) err("clave_con_espacios", c.nombre);
      continue;
    }
    if (vacio(v)) {
      if (c.obligatoria) err("obligatoria_vacia", c.nombre);
      continue;
    }
    switch (c.tipo) {
      case "fecha":
        if (!fechaValida(v)) err("fecha_invalida", c.nombre);
        break;
      case "01":
        if (v !== "0" && v !== "1") err("valor_01_invalido", c.nombre);
        break;
      case "entero":
        if (!RE_ENTERO.test(v) || BigInt(v) > INT_MAX || BigInt(v) < INT_MIN) err("entero_invalido", c.nombre);
        break;
      case "decimal":
        if (!RE_DECIMAL.test(v)) err("decimal_invalido", c.nombre);
        else if (c.carga && c.decimales !== undefined && c.enteros !== undefined) {
          const [ent, frac = ""] = v.replace("-", "").split(".");
          const fracSignificativa = frac.replace(/0+$/, "");
          if (fracSignificativa.length > c.decimales || ent.replace(/^0+(?=\d)/, "").length > c.enteros) {
            err("no_cabe_en_la_base", c.nombre, `max ${c.enteros} enteros y ${c.decimales} decimales`);
          }
        }
        break;
      case "texto":
        break;
    }
  }
  return errores.length === antes ? r : null;
}

/** Decimales significativos (sin ceros a la derecha) de un número ya validado. */
function decimalesDe(v: string): number {
  return (v.split(".")[1] ?? "").replace(/0+$/, "").length;
}

/** Columnas sin límite que traen más decimales de lo normal → problema de calidad. */
function revisarDecimales(r: Record<string, string>, columnas: Columna[], agregar: (columna: string, detalle: string) => void) {
  for (const c of columnas) {
    const v = r[c.nombre];
    if (c.avisoDecimales !== undefined && !vacio(v) && decimalesDe(v) > c.avisoDecimales) {
      agregar(c.nombre, `decimales=${decimalesDe(v)}`);
    }
  }
}

function normalizarDescripcion(d: string): string {
  return d.trim().replace(/\s+/g, " ").toUpperCase();
}

function pistaContenido(descripcion: string): string {
  const d = descripcion.toUpperCase();
  if (/\b\d+\s*(PZ|PZA|PZAS|PIEZAS?)\b/.test(d)) return "la descripcion dice N PZ";
  if (/\b\d+\s*[X×]\s*\d+|\bPACK\b|\bPAQ|\bSIX\b|\bC\/\s*\d+|\bCAJA\b/.test(d)) return "parece paquete";
  return "no trae medida";
}

// ---------------------------------------------------------------------------
// Validación completa del paquete
// ---------------------------------------------------------------------------
export function validarPaquete(
  articulosCsv: FilaCsv[],
  promocionesCsv: FilaCsv[],
  diccionarioCsv: FilaCsv[],
): Resultado {
  const errores: Hallazgo[] = [];
  const calidad: Hallazgo[] = [];
  const sinContenido: SinContenido[] = [];
  const articulos: ArticuloCarga[] = [];
  const promociones: PromocionCarga[] = [];

  const resultado = (fechaCorte: string | null): Resultado => ({
    fechaCorte, articulos, promociones, errores, calidad, sinContenido, revisiones: REVISIONES,
    filasArticulos: Math.max(articulosCsv.length - 1, 0),
    filasPromociones: Math.max(promocionesCsv.length - 1, 0),
  });

  // ---- Encabezados contra diccionario ----
  const dic = leerDiccionario(diccionarioCsv);
  if (articulosCsv.length === 0 || promocionesCsv.length === 0) {
    throw new Error("Un archivo del paquete está vacío");
  }
  errores.push(...compararEncabezados(A, articulosCsv[0].campos, COLUMNAS_ARTICULOS, dic, "x24_articulos"));
  errores.push(...compararEncabezados(P, promocionesCsv[0].campos, COLUMNAS_PROMOCIONES, dic, "x24_promociones"));
  if (errores.length > 0) return resultado(null); // con otro formato no se puede seguir

  // ---- Artículos ----
  const fechas = new Set<string>();
  const claves = new Map<string, number>(); // clave → renglón
  const porDescripcion = new Map<string, { clave: string; renglon: number }[]>();

  for (const fila of articulosCsv.slice(1)) {
    const r = validarFormato(A, fila, COLUMNAS_ARTICULOS, errores, (x) => ({ clave: x.clave ?? "", llavePromocion: "" }));
    if (!r) continue;
    const base = { archivo: A, renglon: fila.renglon, clave: r.clave, llavePromocion: "" };
    let ok = true;
    const err = (tipo: string, columnas: string, detalle = "") => {
      errores.push({ ...base, tipo, columnas, detalle });
      ok = false;
    };

    fechas.add(r.fecha_corte);
    if (claves.has(r.clave)) err("llave_repetida", "clave", `también en renglón ${claves.get(r.clave)}`);
    else claves.set(r.clave, fila.renglon);

    const tieneCont = !vacio(r.contenido_pieza);
    const tieneUni = !vacio(r.unidad_contenido);
    if (tieneCont !== tieneUni) err("contenido_incompleto", "contenido_pieza, unidad_contenido");
    if (tieneUni && !UNIDADES_ARCHIVO.has(r.unidad_contenido)) err("unidad_invalida", "unidad_contenido");
    if (tieneCont && Number(r.contenido_pieza) <= 0) err("contenido_no_positivo", "contenido_pieza");
    if (!ok) continue;

    // Calidad (no detiene)
    const q = (tipo: string, columnas: string, detalle = "") => calidad.push({ ...base, tipo, columnas, detalle });
    revisarDecimales(r, COLUMNAS_ARTICULOS, (col, det) => q("decimales_de_mas", col, det));
    if (!vacio(r.precio_mayoreo) && centavos(r.precio_mayoreo) >= centavos(r.precio_regular)) {
      q("mayoreo_mayor_o_igual_al_regular", "precio_mayoreo, precio_regular");
    }
    if (r.es_servicio !== "1" && centavos(r.precio_regular) <= 0) {
      q("precio_regular_cero_o_negativo", "precio_regular, es_servicio");
    }
    if (!vacio(r.precio_regular_sin_impuestos)) {
      const calc = Number(r.precio_regular_sin_impuestos)
        * (1 + Number(r.tasa_iva || "0")) * (1 + Number(r.tasa_ieps || "0"));
      if (Math.abs(calc - Number(r.precio_regular)) > 0.01 + 1e-9) {
        q("sin_impuestos_no_cuadra", "precio_regular, precio_regular_sin_impuestos, tasa_iva, tasa_ieps",
          `diferencia=${(calc - Number(r.precio_regular)).toFixed(4)}`);
      }
    }
    const nd = normalizarDescripcion(r.descripcion);
    if (!porDescripcion.has(nd)) porDescripcion.set(nd, []);
    porDescripcion.get(nd)!.push({ clave: r.clave, renglon: fila.renglon });

    if (!tieneCont) {
      sinContenido.push({ clave: r.clave, renglon: fila.renglon, descripcion: r.descripcion, pista: pistaContenido(r.descripcion) });
    }

    articulos.push({
      clave: r.clave, // TEXTO tal cual: nunca Number()
      descripcion: r.descripcion,
      area_id: oNulo(r.area_id),
      area: oNulo(r.area),
      depto_id: oNulo(r.depto_id),
      departamento: oNulo(r.departamento),
      nacs_subcategoria_id: oNulo(r.nacs_subcategoria_id),
      nacs_categoria_id: oNulo(r.nacs_categoria_id),
      nacs_categoria: oNulo(r.nacs_categoria),
      cantidad: oNulo(r.contenido_pieza),
      unidad: oNulo(r.unidad_contenido),
      es_servicio: bool(r.es_servicio),
      obsoleto: bool(r.obsoleto),
      de_baja: bool(r.de_baja),
      precio_regular: r.precio_regular,
      fecha_ultimo_cambio_precio: oNulo(r.fecha_ultimo_cambio_precio),
    });
  }

  let grupo = 0;
  for (const lista of porDescripcion.values()) {
    if (lista.length < 2) continue;
    grupo++;
    for (const x of lista) {
      calidad.push({ tipo: "descripcion_repetida", archivo: A, renglon: x.renglon, clave: x.clave,
        llavePromocion: "", columnas: "descripcion, clave", detalle: `grupo=${grupo} claves_en_grupo=${lista.length}` });
    }
  }

  // ---- Promociones ----
  const llavesPromo = new Map<string, number>();
  const llaveDe = (x: Record<string, string>) => `${x.origen ?? ""}|${x.id_promocion ?? ""}|${x.id_grupo ?? ""}`;

  for (const fila of promocionesCsv.slice(1)) {
    const r = validarFormato(P, fila, COLUMNAS_PROMOCIONES, errores,
      (x) => ({ clave: x.clave ?? "", llavePromocion: llaveDe(x) }));
    if (!r) continue;
    const base = { archivo: P, renglon: fila.renglon, clave: r.clave, llavePromocion: llaveDe(r) };
    let ok = true;
    const err = (tipo: string, columnas: string, detalle = "") => {
      errores.push({ ...base, tipo, columnas, detalle });
      ok = false;
    };

    fechas.add(r.fecha_corte);
    if (!ORIGENES.has(r.origen)) err("origen_invalido", "origen");
    const llave = `${llaveDe(r)}|${r.clave}`;
    if (llavesPromo.has(llave)) err("llave_repetida", "origen, id_promocion, id_grupo, clave", `también en renglón ${llavesPromo.get(llave)}`);
    else llavesPromo.set(llave, fila.renglon);
    if (!ok) continue;

    const q = (tipo: string, columnas: string, detalle = "") => calidad.push({ ...base, tipo, columnas, detalle });
    revisarDecimales(r, COLUMNAS_PROMOCIONES, (col, det) => q("decimales_de_mas", col, det));
    if (!vacio(r.descuento_pct) && Number(r.descuento_pct) < 0) q("descuento_negativo", "descuento_pct");
    if (!vacio(r.precio_promo_grupo) && !vacio(r.piezas_requeridas) && !vacio(r.precio_promo_pieza)) {
      const piezas = Number(r.piezas_requeridas);
      const dif = Math.abs(centavos(r.precio_promo_grupo) - piezas * centavos(r.precio_promo_pieza));
      if (dif > Math.max(piezas, 1)) q("promo_grupo_no_cuadra", "precio_promo_grupo, piezas_requeridas, precio_promo_pieza");
    }
    if (r.fecha_inicio > r.fecha_fin) q("fecha_inicio_posterior_a_fin", "fecha_inicio, fecha_fin");
    if (r.es_combo !== "1" && !vacio(r.precio_promo_pieza) && !vacio(r.precio_regular_al_inicio)
        && centavos(r.precio_promo_pieza) >= centavos(r.precio_regular_al_inicio)) {
      q("promo_pieza_mayor_o_igual_al_regular", "precio_promo_pieza, precio_regular_al_inicio, es_combo");
    }
    if (!claves.has(r.clave)) q("promocion_sin_articulo", "clave");

    promociones.push({
      origen: r.origen,
      id_promocion: oNulo(r.id_promocion),
      categoria_promo_id: oNulo(r.categoria_promo_id),
      categoria_promo: oNulo(r.categoria_promo),
      descripcion_promo: oNulo(r.descripcion_promo),
      regiones: oNulo(r.regiones),
      fecha_inicio: r.fecha_inicio,
      fecha_fin: r.fecha_fin,
      activa: boolONulo(r.activa),
      vigente_al_corte: boolONulo(r.vigente_al_corte),
      es_combo: bool(r.es_combo),
      num_grupos: oNulo(r.num_grupos),
      id_grupo: oNulo(r.id_grupo),
      clave: r.clave, // TEXTO tal cual
      piezas_requeridas: oNulo(r.piezas_requeridas),
      precio_promo_pieza: oNulo(r.precio_promo_pieza),
      precio_promo_grupo: oNulo(r.precio_promo_grupo),
      precio_promo_total: oNulo(r.precio_promo_total),
      precio_regular_al_inicio: oNulo(r.precio_regular_al_inicio),
    });
  }

  // ---- Una sola fecha de corte en todo el paquete ----
  let fechaCorte: string | null = null;
  if (fechas.size > 1) {
    errores.push({ tipo: "fecha_corte_distinta", archivo: AMBOS, renglon: null, clave: "", llavePromocion: "",
      columnas: "fecha_corte", detalle: `fechas_distintas=${fechas.size}` });
  } else if (fechas.size === 1) {
    fechaCorte = [...fechas][0];
  }

  return resultado(fechaCorte);
}

/** Conteo por tipo (lo único que se muestra en pantalla). */
export function contarPorTipo(lista: { tipo: string }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of lista) m.set(x.tipo, (m.get(x.tipo) ?? 0) + 1);
  return m;
}
