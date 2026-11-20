// Lee la hora en que se TOMÓ una foto (dato EXIF "DateTimeOriginal") directamente
// del archivo, ANTES de comprimirlo: al comprimir, esos datos se pierden.
//
// EXIF = datos que la cámara guarda dentro del archivo (fecha, modelo, etc.).
// Van en una estructura llamada TIFF: un encabezado y listas de "etiquetas"
// (IFD). La fecha está en la sub-lista "Exif IFD":
//   0x9003 DateTimeOriginal    → "2026:11:20 14:05:33" (hora local de la cámara)
//   0x9011 OffsetTimeOriginal  → "-06:00" (zona horaria; los celulares viejos no la traen)
//
// No usamos File.lastModified: en iPhone suele ser la hora en que se eligió la
// foto y en Android la hora en que se copió. No es confiable.
//
// Esta función NUNCA lanza error: si algo falla, devuelve "sin_dato".

export type OrigenCaptura = "exif" | "exif_zona_celular" | "sin_dato";
export type HoraCaptura = { capturada_at: string | null; capturada_origen: OrigenCaptura };

const SIN_DATO: HoraCaptura = { capturada_at: null, capturada_origen: "sin_dato" };

/** Cuánto del inicio de un JPEG se lee: el bloque EXIF siempre va al principio (≤ 64 KB). */
const BYTES_INICIO_JPEG = 256 * 1024;
/** Tope para buscar EXIF en otros formatos (HEIC/HEIF), donde puede ir más adentro. */
const BYTES_MAXIMO_OTROS = 32 * 1024 * 1024;

export async function leerHoraCaptura(archivo: File): Promise<HoraCaptura> {
  try {
    const inicio = new DataView(await archivo.slice(0, 2).arrayBuffer());
    const esJpeg = inicio.byteLength === 2 && inicio.getUint16(0) === 0xffd8;

    const datos = new DataView(
      await archivo.slice(0, esJpeg ? BYTES_INICIO_JPEG : BYTES_MAXIMO_OTROS).arrayBuffer(),
    );
    const tiff = esJpeg ? buscarTiffEnJpeg(datos) : buscarTiffPorFirma(datos);
    if (tiff === null) return SIN_DATO;

    const valores = leerFechaTiff(datos, tiff);
    if (!valores) return SIN_DATO;
    return convertir(valores.fecha, valores.zona);
  } catch {
    return SIN_DATO;
  }
}

/** JPEG: recorre los bloques del inicio hasta el APP1 que empieza con "Exif\0\0". */
function buscarTiffEnJpeg(d: DataView): number | null {
  let p = 2;
  while (p + 4 <= d.byteLength) {
    if (d.getUint8(p) !== 0xff) return null;
    const marcador = d.getUint8(p + 1);
    if (marcador === 0xda || marcador === 0xd9) return null; // empieza la imagen: ya no hay EXIF
    const largo = d.getUint16(p + 2);
    if (marcador === 0xe1 && largo >= 8 && esTextoExif(d, p + 4)) return p + 10;
    p += 2 + largo;
  }
  return null;
}

/**
 * Otros formatos (por ejemplo HEIC de iPhone): busca la firma "Exif\0\0" seguida
 * de un encabezado TIFF ("II*\0" o "MM\0*"). Es una búsqueda simple, no un lector
 * completo de HEIC: si no la encuentra, la foto queda "sin_dato".
 */
function buscarTiffPorFirma(d: DataView): number | null {
  for (let p = 0; p + 10 <= d.byteLength; p++) {
    if (d.getUint8(p) !== 0x45 || !esTextoExif(d, p)) continue; // 0x45 = "E"
    const orden = d.getUint16(p + 6);
    if ((orden === 0x4949 && d.getUint16(p + 8, true) === 42) || (orden === 0x4d4d && d.getUint16(p + 8) === 42)) {
      return p + 6;
    }
  }
  return null;
}

function esTextoExif(d: DataView, p: number): boolean {
  // "Exif\0\0"
  return (
    p + 6 <= d.byteLength &&
    d.getUint32(p) === 0x45786966 &&
    d.getUint16(p + 4) === 0x0000
  );
}

/** Lee DateTimeOriginal y OffsetTimeOriginal desde el encabezado TIFF en "base". */
function leerFechaTiff(d: DataView, base: number): { fecha: string; zona: string | null } | null {
  const orden = d.getUint16(base);
  const le = orden === 0x4949; // "II" = little-endian; "MM" = big-endian
  if (!le && orden !== 0x4d4d) return null;
  if (d.getUint16(base + 2, le) !== 42) return null;

  // IFD0 → buscar el puntero al Exif IFD (etiqueta 0x8769).
  const ifd0 = base + d.getUint32(base + 4, le);
  const punteroExif = buscarEtiqueta(d, ifd0, le, 0x8769);
  if (punteroExif === null) return null;

  const exifIfd = base + d.getUint32(punteroExif + 8, le);
  const fecha = leerTexto(d, base, exifIfd, le, 0x9003);
  if (!fecha) return null;
  const zona = leerTexto(d, base, exifIfd, le, 0x9011);
  return { fecha, zona };
}

/** Devuelve la posición de la entrada (12 bytes) con esa etiqueta, o null. */
function buscarEtiqueta(d: DataView, ifd: number, le: boolean, etiqueta: number): number | null {
  if (ifd + 2 > d.byteLength) return null;
  const n = d.getUint16(ifd, le);
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > d.byteLength) return null;
    if (d.getUint16(e, le) === etiqueta) return e;
  }
  return null;
}

/** Lee una etiqueta de texto (tipo ASCII = 2). */
function leerTexto(d: DataView, base: number, ifd: number, le: boolean, etiqueta: number): string | null {
  const e = buscarEtiqueta(d, ifd, le, etiqueta);
  if (e === null || d.getUint16(e + 2, le) !== 2) return null;
  const cuenta = d.getUint32(e + 4, le);
  // Hasta 4 bytes van dentro de la entrada; si son más, la entrada guarda dónde están.
  const inicio = cuenta <= 4 ? e + 8 : base + d.getUint32(e + 8, le);
  if (cuenta === 0 || inicio + cuenta > d.byteLength) return null;
  let texto = "";
  for (let i = 0; i < cuenta; i++) {
    const c = d.getUint8(inicio + i);
    if (c === 0) break;
    texto += String.fromCharCode(c);
  }
  return texto.trim() || null;
}

/**
 * "2026:11:20 14:05:33" + "-06:00" → "2026-11-20T14:05:33-06:00" (origen "exif").
 * Sin zona: se interpreta como hora del celular (origen "exif_zona_celular").
 */
function convertir(fecha: string, zona: string | null): HoraCaptura {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(fecha);
  if (!m) return SIN_DATO;
  const [, an, me, di, ho, mi, se] = m;
  if (Number(an) < 2000) return SIN_DATO; // "0000:00:00 00:00:00" y fechas absurdas

  const z = zona && /^[+-]\d{2}:\d{2}$/.test(zona) ? zona : null;
  const fechaHora = z
    ? new Date(`${an}-${me}-${di}T${ho}:${mi}:${se}${z}`)
    : new Date(Number(an), Number(me) - 1, Number(di), Number(ho), Number(mi), Number(se));
  if (Number.isNaN(fechaHora.getTime())) return SIN_DATO;

  return { capturada_at: fechaHora.toISOString(), capturada_origen: z ? "exif" : "exif_zona_celular" };
}
