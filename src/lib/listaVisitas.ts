// Lógica de la pantalla principal (lista de visitas), sin Supabase ni React, para poder
// probarla con datos inventados (npm run test:lista).
//
// Qué resuelve:
//   1. Día de cada visita en hora de México (America/Mexico_City), NO en UTC: una visita
//      guardada a las 8 pm de México ya es "mañana" en UTC y caería en el día equivocado.
//   2. Agrupar por día (más reciente primero), con títulos "Hoy", "Ayer" o
//      "lunes 23 de noviembre" (con el año si no es el actual) y totales por día.
//   3. Cargar por TRAMOS de días. La API de Supabase corta cada respuesta (1,000 filas por
//      defecto), así que nunca se pide "todo": se piden 14 días completos a la vez y, dentro
//      del tramo, páginas de 500 filas. Los tramos van de medianoche a medianoche (hora de
//      México), así un día nunca queda partido entre dos tramos.
//   4. FILTRO POR FECHA DE INGRESO ("Desde" / "Hasta"): valida las fechas, convierte el
//      rango de días de México a instantes UTC (con Intl, sin fijar el desfase a mano),
//      lo pide al servidor por páginas (sin repetir ni saltar) y resume el periodo.
//
// Conteos: llegan de Supabase como "fotos(count)" y "capturas_manuales(count)" (ver
// src/app/ListaVisitas.tsx). Solo cuentan filas con descartada_at nulo. Las visitas
// borradas (solo las recibe el admin) se muestran, pero NO suman a los totales del día.

import { clasificarFalla, type Falla } from "./errores.ts";

export const ZONA_MEXICO = "America/Mexico_City";
/** Días que trae cada tramo (la carga inicial y cada "Ver días anteriores"). */
export const DIAS_POR_TRAMO = 14;
/**
 * Filas por página dentro de un tramo. Es MENOR que el corte de Supabase (1,000) a
 * propósito: si una página llega con menos filas que esto, seguro ya no hay más (si
 * pidiéramos 1,000 y el servidor cortara antes, creeríamos que se acabó).
 */
export const FILAS_POR_PAGINA = 500;

// --- Fechas en hora de México ------------------------------------------------------

/** "AAAA-MM-DD" del día calendario. */
export type ClaveDia = string;

const formatoClave = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_MEXICO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const formatoPartes = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA_MEXICO,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const formatoTitulo = new Intl.DateTimeFormat("es-MX", {
  timeZone: ZONA_MEXICO,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const formatoHora = new Intl.DateTimeFormat("es-MX", {
  timeZone: ZONA_MEXICO,
  hour: "numeric",
  minute: "2-digit",
});

function aFecha(valor: Date | string): Date {
  return typeof valor === "string" ? new Date(valor) : valor;
}

function parte(partes: Intl.DateTimeFormatPart[], tipo: Intl.DateTimeFormatPartTypes): string {
  return partes.find((p) => p.type === tipo)?.value ?? "";
}

/** Día (en México) de un instante. "2026-11-24T02:30:00Z" → "2026-11-23" (8:30 pm del 23). */
export function claveDia(valor: Date | string): ClaveDia {
  const partes = formatoClave.formatToParts(aFecha(valor));
  return `${parte(partes, "year")}-${parte(partes, "month")}-${parte(partes, "day")}`;
}

/** Suma (o resta) días a una clave. Es aritmética de calendario, no depende de la zona. */
export function sumarDias(clave: ClaveDia, dias: number): ClaveDia {
  const [a, m, d] = clave.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Minutos que México va detrás de (o delante de) UTC en ese instante. */
function desfaseMinutos(instante: Date): number {
  const p = formatoPartes.formatToParts(instante);
  const comoUtc = Date.UTC(
    Number(parte(p, "year")),
    Number(parte(p, "month")) - 1,
    Number(parte(p, "day")),
    Number(parte(p, "hour")),
    Number(parte(p, "minute")),
    Number(parte(p, "second")),
  );
  return Math.round((comoUtc - instante.getTime()) / 60000);
}

/** Medianoche (hora de México) de ese día, como texto ISO en UTC. "2026-11-23" → "2026-11-23T06:00:00.000Z". */
export function inicioDelDia(clave: ClaveDia): string {
  const [a, m, d] = clave.split("-").map(Number);
  const base = Date.UTC(a, m - 1, d);
  // Dos pasadas por si el desfase cambia ese día (México ya no tiene horario de verano,
  // pero así no depende de eso).
  let instante = base - desfaseMinutos(new Date(base)) * 60000;
  instante = base - desfaseMinutos(new Date(instante)) * 60000;
  return new Date(instante).toISOString();
}

/** "Hoy", "Ayer", "lunes 23 de noviembre" o, si no es de este año, "lunes 23 de noviembre de 2025". */
export function tituloDia(clave: ClaveDia, hoy: ClaveDia): string {
  if (clave === hoy) return "Hoy";
  if (clave === sumarDias(hoy, -1)) return "Ayer";
  // Mediodía de ese día en México: lejos de la medianoche, sin duda es ese día.
  const mediodia = new Date(new Date(inicioDelDia(clave)).getTime() + 12 * 3600000);
  const p = formatoTitulo.formatToParts(mediodia);
  const texto = `${parte(p, "weekday")} ${parte(p, "day")} de ${parte(p, "month")}`;
  return clave.slice(0, 4) === hoy.slice(0, 4) ? texto : `${texto} de ${parte(p, "year")}`;
}

/** Hora de la visita en México: "8:30 p.m.". */
export function horaVisita(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "—";
  return formatoHora.format(fecha).replace(/\s/g, " ");
}

// --- Textos con singular y plural ----------------------------------------------------

/** "1 foto", "0 fotos", "3 fotos". */
export function cantidad(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export const textoVisitas = (n: number) => cantidad(n, "visita", "visitas");
export const textoFotos = (n: number) => cantidad(n, "foto", "fotos");
export const textoArticulos = (n: number) => cantidad(n, "artículo", "artículos");

// --- Visitas y grupos por día --------------------------------------------------------

/** Una visita tal como la usa la lista. */
export type VisitaLista = {
  id: string;
  created_at: string;
  usuario_id: string | null;
  descartada_at: string | null;
  tienda: string | null;
  /** Fotos a la vista (sin las quitadas). */
  fotos: number;
  /** Artículos manuales vigentes. null = no se pudieron contar. */
  articulos: number | null;
};

/** Una fila como llega de Supabase. */
export type FilaCruda = {
  id: string;
  created_at: string;
  usuario_id: string | null;
  descartada_at: string | null;
  competidores: { nombre: string } | null;
  fotos?: { count: number }[] | null;
  capturas_manuales?: { count: number }[] | null;
};

function contar(lista: { count: number }[] | null | undefined): number {
  const n = lista?.[0]?.count;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

export function normalizarFila(fila: FilaCruda, conArticulos: boolean): VisitaLista {
  return {
    id: fila.id,
    created_at: fila.created_at,
    usuario_id: fila.usuario_id,
    descartada_at: fila.descartada_at,
    tienda: fila.competidores?.nombre ?? null,
    fotos: contar(fila.fotos),
    articulos: conArticulos ? contar(fila.capturas_manuales) : null,
  };
}

export type TotalesDia = {
  /** Visitas a la vista (sin las borradas). */
  visitas: number;
  fotos: number;
  /** null = no se pudieron contar los artículos. */
  articulos: number | null;
  /** Visitas borradas del día (solo le llegan al admin). No suman a lo demás. */
  borradas: number;
};

export type GrupoDia = {
  clave: ClaveDia;
  titulo: string;
  visitas: VisitaLista[];
  totales: TotalesDia;
};

/** Más reciente primero; si empatan en hora, por id (así el orden siempre es el mismo). */
export function compararVisitas(a: { created_at: string; id: string }, b: { created_at: string; id: string }): number {
  const ta = new Date(a.created_at).getTime();
  const tb = new Date(b.created_at).getTime();
  if (ta !== tb) return tb - ta;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/** Agrupa por día de México, días y visitas de la más reciente a la más antigua. */
export function agruparPorDia(visitas: readonly VisitaLista[], hoy: ClaveDia): GrupoDia[] {
  const grupos = new Map<ClaveDia, VisitaLista[]>();
  for (const v of visitas) {
    const clave = claveDia(v.created_at);
    const lista = grupos.get(clave);
    if (lista) lista.push(v);
    else grupos.set(clave, [v]);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([clave, lista]) => {
      lista.sort(compararVisitas);
      return { clave, titulo: tituloDia(clave, hoy), visitas: lista, totales: calcularTotales(lista) };
    });
}

/**
 * Totales de un grupo de visitas (un día o todo un periodo). Las borradas no suman;
 * fotos y artículos ya llegan contados sin las filas descartadas.
 */
export function calcularTotales(lista: readonly VisitaLista[]): TotalesDia {
  const vigentes = lista.filter((v) => !v.descartada_at);
  const sinArticulos = lista.some((v) => v.articulos === null);
  return {
    visitas: vigentes.length,
    fotos: vigentes.reduce((s, v) => s + v.fotos, 0),
    articulos: sinArticulos ? null : vigentes.reduce((s, v) => s + (v.articulos ?? 0), 0),
    borradas: lista.length - vigentes.length,
  };
}

/** "3 visitas · 24 fotos · 41 artículos" (sin artículos si no se pudieron contar). */
export function textoTotales(t: TotalesDia): string {
  const partes = [textoVisitas(t.visitas), textoFotos(t.fotos)];
  if (t.articulos !== null) partes.push(textoArticulos(t.articulos));
  return partes.join(" · ");
}

/** Une lo ya cargado con un tramo nuevo, sin repetir visitas (por id). */
export function unirVisitas(antes: readonly VisitaLista[], nuevas: readonly VisitaLista[]): VisitaLista[] {
  const porId = new Map<string, VisitaLista>();
  for (const v of antes) porId.set(v.id, v);
  for (const v of nuevas) porId.set(v.id, v);
  return [...porId.values()].sort(compararVisitas);
}

// --- Carga por tramos -----------------------------------------------------------------

/**
 * Un tramo por cargar: los DIAS_POR_TRAMO días que terminan en `diaSuperior` (incluido).
 * `antesDe`: tope de arriba (exclusivo, ISO). null = sin tope (la primera carga: así no se
 * pierde una visita aunque el reloj del celular vaya atrasado).
 */
export type Tramo = { diaSuperior: ClaveDia; antesDe: string | null };

export function primerTramo(hoy: ClaveDia): Tramo {
  return { diaSuperior: hoy, antesDe: null };
}

/** Desde qué instante (incluido) trae visitas el tramo: medianoche del día más antiguo. */
export function inicioDelTramo(tramo: Tramo): string {
  return inicioDelDia(sumarDias(tramo.diaSuperior, -(DIAS_POR_TRAMO - 1)));
}

export type PeticionPagina = {
  /** created_at >= desde */
  desde: string;
  /** created_at < antesDe (si no es null) */
  antesDe: string | null;
  /** Para seguir dentro del tramo: filas que van DESPUÉS de esta en el orden (created_at desc, id desc). */
  despuesDe: { created_at: string; id: string } | null;
  limite: number;
  /** true = pedir también el conteo de artículos manuales. */
  conArticulos: boolean;
};

export type RespuestaApi<T> = { data: T | null; error: unknown; status?: number };

/** Lo que la lista le pide a Supabase. En la app lo arma ListaVisitas.tsx; en las pruebas, datos inventados. */
export type ApiLista = {
  leerPagina(p: PeticionPagina): Promise<RespuestaApi<FilaCruda[]>>;
  /** La visita más reciente con created_at < antesDe (una sola fila, o ninguna). */
  leerMasReciente(antesDe: string): Promise<RespuestaApi<{ created_at: string }[]>>;
};

export type ResultadoTramo =
  | {
      tipo: "ok";
      visitas: VisitaLista[];
      /** false = los artículos no se contaron (los siguientes tramos tampoco los piden). */
      conArticulos: boolean;
      /** Por qué falló el conteo de artículos (si falló en este tramo). */
      fallaArticulos: Falla | null;
      /** El siguiente tramo, o null si ya no hay visitas más antiguas. */
      siguiente: Tramo | null;
    }
  | { tipo: "falla"; falla: Falla };

async function llamar<T>(fn: () => Promise<RespuestaApi<T>>): Promise<RespuestaApi<T>> {
  try {
    return await fn();
  } catch (e) {
    return { data: null, error: e };
  }
}

/** Máximo de páginas por tramo (freno de seguridad; 200 × 500 = 100,000 visitas en 14 días). */
const MAX_PAGINAS = 200;

type Cursor = PeticionPagina["despuesDe"];

type ResultadoPaginas =
  | { tipo: "ok"; filas: FilaCruda[]; conArticulos: boolean; fallaArticulos: Falla | null; cursor: Cursor; lleno: boolean }
  | { tipo: "falla"; falla: Falla };

/**
 * Lee páginas de [desde, antesDe) a partir de `inicio` (o desde la más reciente).
 * - Avanza con "después de la última fila" (created_at, id), no con números de fila:
 *   si alguien guarda una visita mientras se carga, nada se recorre.
 * - Para cuando una página llega incompleta (ya no hay más) o al llegar a `maxPaginas`
 *   (`lleno` = true; `cursor` = dónde seguir).
 * - Si falla SOLO el conteo de artículos (error de Supabase), vuelve a empezar sin
 *   artículos y lo reporta. Fallas de red o de sesión se devuelven tal cual.
 */
async function leerPaginas(
  api: ApiLista,
  desde: string,
  antesDe: string | null,
  inicio: Cursor,
  conArticulos: boolean,
  maxPaginas: number,
  clasificar: (error: unknown, estado?: number) => Falla,
): Promise<ResultadoPaginas> {
  let usarArticulos = conArticulos;
  let fallaArticulos: Falla | null = null;
  let filas: FilaCruda[] = [];
  let despuesDe: Cursor = inicio;
  let lleno = false;

  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    const r = await llamar(() =>
      api.leerPagina({ desde, antesDe, despuesDe, limite: FILAS_POR_PAGINA, conArticulos: usarArticulos }),
    );
    if (r.error) {
      const falla = clasificar(r.error, r.status);
      if (usarArticulos && falla.tipo === "supabase") {
        // Se vuelve a empezar, ahora sin el conteo de artículos.
        usarArticulos = false;
        fallaArticulos = falla;
        filas = [];
        despuesDe = inicio;
        pagina = -1;
        continue;
      }
      return { tipo: "falla", falla };
    }
    const datos = r.data ?? [];
    filas = filas.concat(datos);
    if (datos.length < FILAS_POR_PAGINA) break;
    const ultima = datos[datos.length - 1];
    if (despuesDe && ultima.id === despuesDe.id) break; // el servidor no avanzó: no repetir
    despuesDe = { created_at: ultima.created_at, id: ultima.id };
    if (pagina === maxPaginas - 1) lleno = true;
  }
  return { tipo: "ok", filas, conArticulos: usarArticulos, fallaArticulos, cursor: despuesDe, lleno };
}

/** Quita repetidas (por id), normaliza y ordena de la más reciente a la más antigua. */
function aVisitas(filas: readonly FilaCruda[], conArticulos: boolean): VisitaLista[] {
  const vistas = new Set<string>();
  return filas
    .filter((f) => (vistas.has(f.id) ? false : (vistas.add(f.id), true)))
    .map((f) => normalizarFila(f, conArticulos))
    .sort(compararVisitas);
}

/**
 * Carga un tramo completo (todas sus páginas) y averigua si hay visitas más antiguas.
 *
 * - Sin repetir ni saltar: los tramos son intervalos [desde, antesDe) pegados uno al otro
 *   (el `desde` de uno es el `antesDe` del siguiente). Dentro del tramo se avanza con
 *   "después de la última fila" (leerPaginas).
 * - Si no hay visitas en las semanas de en medio, el siguiente tramo empieza en el día de
 *   la visita más antigua que sí existe (no se muestran tramos vacíos).
 * - Si falla SOLO el conteo de artículos (error de Supabase, por ejemplo porque la tabla
 *   de la captura manual no existe en esa base), se repite sin artículos y se avisa.
 *   Fallas de red o de sesión no se "arreglan" así: se devuelven tal cual.
 */
export async function cargarTramo(
  api: ApiLista,
  tramo: Tramo,
  conArticulos: boolean,
  clasificar: (error: unknown, estado?: number) => Falla = clasificarFalla,
): Promise<ResultadoTramo> {
  const desde = inicioDelTramo(tramo);
  const r = await leerPaginas(api, desde, tramo.antesDe, null, conArticulos, MAX_PAGINAS, clasificar);
  if (r.tipo === "falla") return r;

  const masAntigua = await llamar(() => api.leerMasReciente(desde));
  if (masAntigua.error) return { tipo: "falla", falla: clasificar(masAntigua.error, masAntigua.status) };
  const fila = masAntigua.data?.[0];
  const siguiente: Tramo | null = fila ? { diaSuperior: claveDia(fila.created_at), antesDe: desde } : null;

  return {
    tipo: "ok",
    visitas: aVisitas(r.filas, r.conArticulos),
    conArticulos: r.conArticulos,
    fallaArticulos: r.fallaArticulos,
    siguiente,
  };
}

// --- Filtro por fecha de ingreso ---------------------------------------------------------
// "Desde" y "Hasta" son días de México (AAAA-MM-DD, como los da <input type="date">). El
// rango incluye TODO el día "Hasta": va de la medianoche de "Desde" a la medianoche del
// día siguiente a "Hasta" (sin incluir esa), ambas en hora de México y convertidas a UTC
// con inicioDelDia (Intl.DateTimeFormat; el desfase no se escribe a mano).

export type FiltroFechas = { desde: ClaveDia; hasta: ClaveDia };

export type FiltroLeido =
  | { tipo: "sin-filtro" }
  | { tipo: "ok"; filtro: FiltroFechas }
  /** Fechas que no se pueden usar: se avisa y NO se consulta. */
  | { tipo: "error"; mensaje: string };

const FORMA_CLAVE = /^\d{4}-\d{2}-\d{2}$/;

/** true si es "AAAA-MM-DD" y la fecha existe (no "2026-02-30"). */
export function esClaveValida(texto: string): boolean {
  return FORMA_CLAVE.test(texto) && sumarDias(texto, 0) === texto && Number(texto.slice(0, 4)) >= 2000;
}

/** Revisa "Desde" y "Hasta" (de los campos o de la URL). `hoy` = día de hoy en México. */
export function validarFiltro(desde: string | null, hasta: string | null, hoy: ClaveDia): FiltroLeido {
  const d = (desde ?? "").trim();
  const h = (hasta ?? "").trim();
  if (!d && !h) return { tipo: "sin-filtro" };
  if (!d || !h) return { tipo: "error", mensaje: "Elige las dos fechas: “Desde” y “Hasta”." };
  if (!esClaveValida(d)) return { tipo: "error", mensaje: "La fecha “Desde” no es válida." };
  if (!esClaveValida(h)) return { tipo: "error", mensaje: "La fecha “Hasta” no es válida." };
  if (d > hoy || h > hoy) {
    return { tipo: "error", mensaje: "No se pueden elegir fechas futuras. Elige hoy o un día anterior." };
  }
  if (d > h) {
    return { tipo: "error", mensaje: "La fecha “Desde” es posterior a “Hasta”. Cámbiala para ver las visitas." };
  }
  return { tipo: "ok", filtro: { desde: d, hasta: h } };
}

/** Instantes UTC del rango: created_at >= desde y created_at < antesDe. */
export function rangoDelFiltro(f: FiltroFechas): { desde: string; antesDe: string } {
  return { desde: inicioDelDia(f.desde), antesDe: inicioDelDia(sumarDias(f.hasta, 1)) };
}

/** Atajos de un toque. "Este mes" va del día 1 a hoy. */
export function atajosFiltro(hoy: ClaveDia): { etiqueta: string; filtro: FiltroFechas }[] {
  const ayer = sumarDias(hoy, -1);
  return [
    { etiqueta: "Hoy", filtro: { desde: hoy, hasta: hoy } },
    { etiqueta: "Ayer", filtro: { desde: ayer, hasta: ayer } },
    { etiqueta: "Últimos 7 días", filtro: { desde: sumarDias(hoy, -6), hasta: hoy } },
    { etiqueta: "Este mes", filtro: { desde: `${hoy.slice(0, 8)}01`, hasta: hoy } },
  ];
}

/** "?desde=2026-11-20&hasta=2026-11-24" (o "" sin filtro). Para la URL y los enlaces. */
export function consultaFiltro(f: FiltroFechas | null): string {
  if (!f) return "";
  return `?${new URLSearchParams({ desde: f.desde, hasta: f.hasta }).toString()}`;
}

const formatoPeriodo = new Intl.DateTimeFormat("es-MX", {
  timeZone: ZONA_MEXICO,
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "20 nov 2026 – 24 nov 2026" o, si es un solo día, "24 nov 2026". */
export function textoPeriodo(f: FiltroFechas): string {
  const dia = (c: ClaveDia) => formatoPeriodo.format(new Date(new Date(inicioDelDia(c)).getTime() + 12 * 3600000));
  return f.desde === f.hasta ? dia(f.desde) : `${dia(f.desde)} – ${dia(f.hasta)}`;
}

/**
 * Visitas que se piden de una vez con el filtro (4 páginas de 500). Si el periodo trae
 * más, se avisa y se ofrece "Cargar más visitas del periodo" (sigue donde se quedó).
 */
export const MAX_VISITAS_POR_CARGA = 2000;

export type ResultadoRango =
  | {
      tipo: "ok";
      visitas: VisitaLista[];
      conArticulos: boolean;
      fallaArticulos: Falla | null;
      /** Dónde seguir si quedan visitas del periodo por cargar; null = ya están todas. */
      pendiente: Cursor;
    }
  | { tipo: "falla"; falla: Falla };

/**
 * Carga las visitas del filtro (consulta al SERVIDOR por rango; no filtra lo ya cargado).
 * `desdeCursor`: para "Cargar más" (sigue después de la última que ya se tiene).
 * Sin repetir ni saltar: mismas páginas por "después de la última fila" que los tramos.
 */
export async function cargarRango(
  api: ApiLista,
  filtro: FiltroFechas,
  conArticulos: boolean,
  desdeCursor: Cursor = null,
  maxVisitas = MAX_VISITAS_POR_CARGA,
  clasificar: (error: unknown, estado?: number) => Falla = clasificarFalla,
): Promise<ResultadoRango> {
  const rango = rangoDelFiltro(filtro);
  const paginas = Math.max(1, Math.floor(maxVisitas / FILAS_POR_PAGINA));
  const r = await leerPaginas(api, rango.desde, rango.antesDe, desdeCursor, conArticulos, paginas, clasificar);
  if (r.tipo === "falla") return r;

  let pendiente: Cursor = null;
  if (r.lleno && r.cursor) {
    // ¿De verdad queda algo? Se pregunta por UNA fila más (así no se avisa de más).
    const cursor = r.cursor;
    const prueba = await llamar(() =>
      api.leerPagina({ desde: rango.desde, antesDe: rango.antesDe, despuesDe: cursor, limite: 1, conArticulos: false }),
    );
    if (prueba.error) return { tipo: "falla", falla: clasificar(prueba.error, prueba.status) };
    if ((prueba.data ?? []).length > 0) pendiente = cursor;
  }

  return {
    tipo: "ok",
    visitas: aVisitas(r.filas, r.conArticulos),
    conArticulos: r.conArticulos,
    fallaArticulos: r.fallaArticulos,
    pendiente,
  };
}

/** Mensaje para la persona cuando falla CARGAR (no guardar). */
export function mensajeFallaCarga(falla: Falla): string {
  if (falla.tipo === "red") {
    return "No hay conexión a internet o tardó demasiado en responder. Revisa tu señal e inténtalo otra vez.";
  }
  if (falla.tipo === "sesion") return "Tu sesión caducó. Inicia sesión otra vez para ver tus visitas.";
  return `Avisa al responsable e indica este código: ${falla.codigo}`;
}
