// Importa un corte de nuestra lista de precios (paquete del SCA) a Supabase.
// SOLO SERVIDOR (tu computadora). No es parte de la app publicada.
// NO llama a la API de Anthropic.
//
// Uso:
//   npm run catalogo:importar -- datos-privados/<carpeta>               → SIMULACIÓN (no escribe)
//   npm run catalogo:importar -- datos-privados/<carpeta> --confirmar   → escribe (todo o nada)
//   node scripts/etapa2/importar-catalogo.ts datos-privados/<carpeta> --sin-conexion
//                                     → solo revisa el archivo; no se conecta a Supabase
//
// Las variables llegan con `node --env-file=.env.local` (el comando de npm ya lo
// hace). La llave secreta NUNCA se imprime ni se escribe en ningún archivo.
//
// En pantalla: SOLO conteos (sin claves, descripciones ni precios). El detalle
// por fila va a datos-privados/reporte_calidad_<fecha>.csv y
// datos-privados/revision_contenido_<fecha>.csv (ignorados por git).

import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { leerCsv, ErrorCsv } from "../../src/lib/etapa2/csv.ts";
import {
  validarPaquete,
  contarPorTipo,
  ARCHIVO_ARTICULOS,
  ARCHIVO_PROMOCIONES,
  type Hallazgo,
  type Resultado,
} from "../../src/lib/etapa2/catalogo.ts";

const RAIZ = path.resolve(import.meta.dirname, "../..");
const DATOS_PRIVADOS = path.join(RAIZ, "datos-privados");
/** Tamaño máximo de una sola llamada (ver PLAN_ETAPA2 5.6.5: qué hacer si no cabe). */
const MAX_BYTES_LLAMADA = 5 * 1024 * 1024;

const TABLAS_CERRADAS = [
  "catalogo_propio",
  "catalogo_propio_cortes",
  "promociones_propias",
  "catalogo_propio_actual",
];

// ---------------------------------------------------------------------------
function salir(mensaje: string, codigo = 1): never {
  console.error(`\n✖ ${mensaje}`);
  process.exit(codigo);
}

function titulo(t: string) {
  console.log(`\n=== ${t} ===`);
}

function imprimirConteos(etiqueta: string, conteos: Map<string, number>) {
  if (conteos.size === 0) {
    console.log(`  ${etiqueta}: ninguno`);
    return;
  }
  console.log(`  ${etiqueta}:`);
  for (const [tipo, n] of [...conteos].sort()) console.log(`    - ${tipo}: ${n}`);
}

/** Mensaje de error de Supabase sin datos: nunca details ni hint (pueden traer valores). */
function errorSeguro(e: { code?: string; message?: string } | null): string {
  if (!e) return "sin error";
  if (e.code?.startsWith("22")) return `código ${e.code} (dato inválido; detalle omitido)`;
  return `código ${e.code ?? "?"}: ${e.message ?? ""}`;
}

function csvCampo(v: string | number | null): string {
  const s = v === null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function escribirCsv(ruta: string, encabezados: string[], filas: (string | number | null)[][]) {
  const lineas = [encabezados, ...filas].map((f) => f.map(csvCampo).join(","));
  writeFileSync(ruta, "﻿" + lineas.join("\r\n") + "\r\n", "utf8");
}

// ---------------------------------------------------------------------------
// Reportes privados (dentro de datos-privados/, nunca en pantalla)
// ---------------------------------------------------------------------------
function escribirReportes(res: Resultado, sufijo: string): { calidad: string; contenido: string } {
  const rutaCalidad = path.join(DATOS_PRIVADOS, `reporte_calidad_${sufijo}.csv`);
  const rutaContenido = path.join(DATOS_PRIVADOS, `revision_contenido_${sufijo}.csv`);

  const fila = (seccion: string, h: Hallazgo) =>
    [seccion, h.tipo, h.archivo, h.renglon, h.clave, h.llavePromocion, h.columnas, h.detalle, null];

  const errores = contarPorTipo(res.errores);
  const calidad = contarPorTipo(res.calidad);
  const conteoDe = (clase: string, tipo: string) =>
    clase === "formato" ? (errores.get(tipo) ?? 0)
    : clase === "calidad" ? (calidad.get(tipo) ?? 0)
    : res.sinContenido.length;

  escribirCsv(
    rutaCalidad,
    ["seccion", "tipo", "archivo", "renglon", "clave", "llave_promocion", "columnas_del_archivo", "detalle", "conteo"],
    [
      ...res.errores.map((h) => fila("error_formato", h)),
      ...res.calidad.map((h) => fila("problema_calidad", h)),
      // Al final: TODAS las revisiones que se corrieron, desde qué columnas y cuántos.
      ...res.revisiones.map((r) => [
        `revision_${r.clase}`, r.tipo, r.archivo, null, null, null, r.columnas, r.descripcion, conteoDe(r.clase, r.tipo),
      ]),
    ],
  );

  escribirCsv(
    rutaContenido,
    ["renglon", "clave", "descripcion", "pista"],
    res.sinContenido.map((s) => [s.renglon, s.clave, s.descripcion, s.pista]),
  );

  return { calidad: rutaCalidad, contenido: rutaContenido };
}

// ---------------------------------------------------------------------------
// Comprobación con la llave PÚBLICA: anon no puede leer nada del catálogo
// ---------------------------------------------------------------------------
async function comprobarAnonCerrado(publica: SupabaseClient): Promise<boolean> {
  titulo("Comprobación con la llave pública (anon)");
  let todoBien = true;
  const informar = (que: string, error: { code?: string; message?: string } | null) => {
    // Solo "permiso denegado" (42501) cuenta como cerrado. Sin error = ABIERTO.
    const cerrado = error?.code === "42501";
    if (!cerrado) todoBien = false;
    console.log(`  ${cerrado ? "✔" : "✖"} ${que}: ${cerrado ? "bloqueado (permiso denegado)" : `NO bloqueado → ${errorSeguro(error)}`}`);
  };

  for (const t of TABLAS_CERRADAS) {
    const { error } = await publica.from(t).select("*").limit(1);
    informar(`leer ${t}`, error);
  }
  {
    const { error } = await publica.rpc("precio_propio_vigente", { p_clave: "X", p_fecha: "2000-01-01" });
    informar("ejecutar precio_propio_vigente", error);
  }
  {
    // Siempre en simulación: aunque estuviera abierta, no escribiría nada.
    const { error } = await publica.rpc("importar_corte", {
      p_fecha_corte: "2000-01-01", p_articulos: [], p_promociones: [], p_simular: true,
    });
    informar("ejecutar importar_corte", error);
  }
  return todoBien;
}

function imprimirResumenBase(c: Record<string, unknown>) {
  const n = (k: string) => String(c[k] ?? "?");
  console.log(`  Último corte ya cargado en la base: ${c.ultimo_corte_en_base ?? "ninguno"}`);
  console.log(`  catalogo_propio:        insertar ${n("articulos_insertar")}, actualizar ${n("articulos_actualizar")}, ` +
    `sin tocar por corte viejo ${n("articulos_no_tocar_corte_viejo")}, borrar 0 (nunca se borran)`);
  console.log(`                          contenido 'manual' respetado: ${n("articulos_contenido_manual_respetado")}`);
  console.log(`  catalogo_propio_cortes: insertar ${n("cortes_insertar")}, borrar ${n("cortes_borrar")} (mismo corte), actualizar 0`);
  console.log(`  promociones_propias:    insertar ${n("promociones_insertar")}, borrar ${n("promociones_borrar")} (mismo corte), actualizar 0`);
  console.log(`  Precio vs corte anterior: cambió ${n("precio_cambiado_vs_corte_anterior")}, igual ${n("precio_igual_vs_corte_anterior")}, ` +
    `sin corte anterior ${n("sin_corte_anterior")}`);

  if (c.corte_mas_viejo_que_el_ultimo) {
    console.log("\n  ⚠️  Este corte es MÁS VIEJO que el último cargado. Qué hará y qué no:");
    console.log("     - SÍ guarda sus precios y promociones con su propia fecha de corte.");
    console.log("     - SÍ inserta los artículos que no existían.");
    console.log("     - NO cambia los datos de los artículos existentes (descripción, categoría,");
    console.log("       baja, obsoleto, contenido): esos quedan como en el corte más reciente.");
  }
  if (c.reimporta_corte_existente) {
    console.log("\n  ℹ️  Este corte ya estaba cargado: sus precios y promociones se reemplazan completos.");
  }
}

// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const confirmar = args.includes("--confirmar");
  const sinConexion = args.includes("--sin-conexion");
  const desconocidos = args.filter((a) => a.startsWith("--") && a !== "--confirmar" && a !== "--sin-conexion");
  const posicionales = args.filter((a) => !a.startsWith("--"));

  if (desconocidos.length > 0) salir(`Opción desconocida: ${desconocidos.join(" ")}`);
  if (posicionales.length !== 1) {
    salir("Uso: npm run catalogo:importar -- datos-privados/<carpeta> [--confirmar]");
  }
  if (confirmar && sinConexion) salir("--confirmar y --sin-conexion no van juntos.");

  const carpeta = path.resolve(posicionales[0]);
  if (!carpeta.startsWith(DATOS_PRIVADOS + path.sep)) {
    salir("La carpeta del paquete debe estar dentro de datos-privados/.");
  }
  if (!existsSync(carpeta) || !statSync(carpeta).isDirectory()) salir("No existe la carpeta del paquete.");

  console.log(confirmar ? "MODO: IMPORTACIÓN REAL (--confirmar)" : sinConexion
    ? "MODO: SOLO ARCHIVO (--sin-conexion): no se conecta a Supabase"
    : "MODO: SIMULACIÓN (no se escribe nada en Supabase)");

  // ---- 1. Leer y validar el paquete (los originales solo se LEEN) ----
  titulo("Revisión del paquete");
  let res: Resultado;
  try {
    const leer = (nombre: string) => leerCsv(readFileSync(path.join(carpeta, nombre), "utf8"));
    res = validarPaquete(leer(ARCHIVO_ARTICULOS), leer(ARCHIVO_PROMOCIONES), leer("diccionario.csv"));
  } catch (e) {
    if (e instanceof ErrorCsv) salir(`El CSV no se pudo leer en el renglón ${e.renglon} (formato).`);
    salir(`No se pudo leer el paquete: ${(e as Error).message}`);
  }

  const sufijo = res.fechaCorte ?? `sin_fecha_${path.basename(carpeta)}`;
  const rutas = escribirReportes(res, sufijo);

  console.log(`  Fecha de corte: ${res.fechaCorte ?? "(no se pudo determinar)"}`);
  console.log(`  Renglones en ${ARCHIVO_ARTICULOS}: ${res.filasArticulos} → listos para cargar: ${res.articulos.length}`);
  console.log(`  Renglones en ${ARCHIVO_PROMOCIONES}: ${res.filasPromociones} → listos para cargar: ${res.promociones.length}`);
  console.log(`  Artículos sin contenido (se cargan como sin_dato): ${res.sinContenido.length}`);
  imprimirConteos("Errores de formato (detienen la importación)", contarPorTipo(res.errores));
  imprimirConteos("Problemas de calidad (se cargan tal cual, NO se corrigen)", contarPorTipo(res.calidad));
  console.log(`  Revisiones corridas: ${res.revisiones.length} (lista y columnas usadas al final del reporte)`);
  console.log(`  Reporte privado:  ${path.relative(RAIZ, rutas.calidad)}`);
  console.log(`  Sin contenido:    ${path.relative(RAIZ, rutas.contenido)}`);

  if (res.errores.length > 0 || !res.fechaCorte) {
    salir("Hay errores de formato: NO se importa nada. Revisa el reporte privado (filas y tipo de error).");
  }

  // ---- Tamaño de la llamada (una sola llamada = una sola transacción) ----
  const parametros = {
    p_fecha_corte: res.fechaCorte,
    p_articulos: res.articulos,
    p_promociones: res.promociones,
  };
  const bytes = Buffer.byteLength(JSON.stringify(parametros), "utf8");
  console.log(`  Tamaño de los datos a enviar: ${(bytes / 1024 / 1024).toFixed(2)} MB (máximo ${MAX_BYTES_LLAMADA / 1024 / 1024} MB)`);
  if (bytes > MAX_BYTES_LLAMADA) {
    salir("El corte no cabe en una sola llamada. Hace falta la carga por partes con tabla de " +
      "preparación (PLAN_ETAPA2 5.6.5). No se escribió nada.");
  }

  if (sinConexion) {
    console.log("\n✔ Revisión del archivo terminada (sin conexión). No se tocó Supabase.");
    return;
  }

  // ---- 2. Variables (solo nombres; nunca se imprimen los valores) ----
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const llavePublica = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const llaveSecreta = process.env.SUPABASE_SECRET_KEY;
  if (!url || !llavePublica || !llaveSecreta) {
    salir("Faltan variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY y SUPABASE_SECRET_KEY " +
      "(córrelo con: npm run catalogo:importar -- ...).");
  }
  if (llaveSecreta === llavePublica) salir("SUPABASE_SECRET_KEY es igual a la llave pública. Revisa .env.local.");
  if (!llaveSecreta.startsWith("sb_secret_")) {
    console.log("  ⚠️  SUPABASE_SECRET_KEY no empieza con sb_secret_ (¿llave antigua service_role?).");
  }

  let projectRef: string;
  try {
    projectRef = new URL(url).hostname.split(".")[0];
  } catch {
    salir("NEXT_PUBLIC_SUPABASE_URL no es una dirección válida.");
  }
  titulo("Proyecto de Supabase");
  console.log(`  Project ref: ${projectRef}`);

  const opciones = { auth: { persistSession: false, autoRefreshToken: false } };
  const publica = createClient(url, llavePublica, opciones);
  const secreta = createClient(url, llaveSecreta, opciones);

  // ---- 3. anon no debe poder leer nada del catálogo ----
  if (!(await comprobarAnonCerrado(publica))) {
    salir("La llave pública NO está bloqueada en todo el catálogo (o falta ejecutar 005). No se continúa.");
  }

  // ---- 4. Simulación en la base (no escribe) ----
  titulo("Qué haría la importación (simulación en la base, no escribe)");
  const sim = await secreta.rpc("importar_corte", { ...parametros, p_simular: true });
  if (sim.error) salir(`La simulación falló: ${errorSeguro(sim.error)}`);
  imprimirResumenBase(sim.data as Record<string, unknown>);

  if (!confirmar) {
    console.log("\n✔ SIMULACIÓN terminada: no se escribió nada en Supabase.");
    console.log("  Para importar de verdad, agrega --confirmar.");
    return;
  }

  // ---- 5. Importación real: una sola llamada = una sola transacción ----
  titulo("Importando (todo o nada)");
  const real = await secreta.rpc("importar_corte", { ...parametros, p_simular: false });
  if (real.error) {
    salir(`La importación falló y NO quedó nada a medias (se deshizo completa): ${errorSeguro(real.error)}`);
  }
  imprimirResumenBase(real.data as Record<string, unknown>);

  // ---- 6. Comprobación independiente (solo conteos) ----
  titulo("Comprobación después de importar");
  const contar = async (tabla: string) => {
    const { count, error } = await secreta.from(tabla)
      .select("*", { count: "exact", head: true })
      .eq("fecha_corte", res.fechaCorte!);
    if (error) salir(`No se pudo contar ${tabla}: ${errorSeguro(error)}`);
    return count ?? -1;
  };
  const nCortes = await contar("catalogo_propio_cortes");
  const nPromos = await contar("promociones_propias");
  const okC = nCortes === res.articulos.length;
  const okP = nPromos === res.promociones.length;
  console.log(`  ${okC ? "✔" : "✖"} catalogo_propio_cortes del corte: ${nCortes} (archivo: ${res.articulos.length})`);
  console.log(`  ${okP ? "✔" : "✖"} promociones_propias del corte:    ${nPromos} (archivo: ${res.promociones.length})`);
  console.log(`  ${(real.data as Record<string, unknown>).comprobaciones_ok ? "✔" : "✖"} precio_propio_vigente = precio del archivo (comprobado dentro de la transacción)`);

  if (!(await comprobarAnonCerrado(publica)) || !okC || !okP) {
    salir("Alguna comprobación no cuadró. Revisa los conteos de arriba.");
  }
  console.log("\n✔ Importación terminada y comprobada.");
}

main().catch((e: unknown) => {
  salir(`Error inesperado: ${(e as Error)?.name ?? "desconocido"}`);
});
