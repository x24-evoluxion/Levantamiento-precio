// Preparar y nombrar fotos antes de subirlas a Supabase Storage.
//
// Cada foto (JPEG, PNG, WebP, HEIC si el navegador la abre…) se "pinta" en un
// <canvas> del navegador con lado mayor de 2200 px y se exporta como JPEG de
// calidad 0.92. Si aun así pesa más de 5 MB (el límite del bucket), se vuelve a
// exportar con un poco menos de calidad, por pasos, hasta que quepa. Nunca se
// achica la foto para que quepa: solo baja la calidad. Si el navegador no sabe
// abrir el formato, se lanza ErrorFoto con un mensaje en español para el usuario.

import { supabase } from "./supabase";
import { BUCKET_FOTOS } from "./tipos";

// Tamaño pensado para que Claude lea las etiquetas (Etapa 2, PLAN_ETAPA2 sección 3).
// Documentación de visión revisada el 2026-11-23 (sin cambios desde el 2026-11-20):
// los modelos de alta resolución aprovechan hasta 2576 px de lado mayor Y hasta 4784
// "tokens visuales" por imagen (1 token = cuadro de 28 × 28 px → ⌈ancho/28⌉ × ⌈alto/28⌉).
// Si la foto pasa cualquiera de los dos topes, la API la vuelve a reducir.
// Las fotos de celular son casi siempre 4:3. En 4:3, el tope real es el de tokens:
//   2200 × 1650 → 79 × 59 = 4661 tokens  ✅ no se vuelve a reducir
//   2240 × 1680 → 80 × 60 = 4800 tokens  ❌ la API la reduciría otra vez
// 2200 px es lo más grande (en número redondo) que se aprovecha sin una segunda
// reducción. Aplica solo a las fotos que se suban desde ahora.
export const LADO_MAXIMO_PX = 2200;
/** Calidad JPEG inicial (0 a 1). La compresión fuerte borra letras pequeñas. */
export const CALIDAD_JPEG = 0.92;
/** Límite del bucket "fotos" (5 MB, ver supabase/001_esquema.sql). */
export const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024;
/**
 * Si la foto pasa de 5 MB, se prueba con estas calidades, en orden, hasta que
 * quepa. A 2200 px casi nunca hace falta: una foto de ese tamaño a 0.92 suele
 * pesar bastante menos de 5 MB.
 */
const CALIDADES_DE_RESPALDO = [0.88, 0.84, 0.8, 0.76, 0.72, 0.68, 0.64, 0.6];

/** Error con un mensaje listo para mostrarle al usuario. */
export class ErrorFoto extends Error {}

export type FotoPreparada = { blob: Blob; extension: string; tipo: string };

/** Reduce y convierte una foto a JPEG para subirla. Lanza ErrorFoto si no se puede. */
export async function prepararFoto(archivo: File): Promise<FotoPreparada> {
  const canvas = await pintarReducida(archivo);
  try {
    for (const calidad of [CALIDAD_JPEG, ...CALIDADES_DE_RESPALDO]) {
      const blob = await exportarJpeg(canvas, calidad);
      if (blob.size <= TAMANO_MAXIMO_BYTES) {
        return { blob, extension: "jpg", tipo: "image/jpeg" };
      }
    }
    throw new ErrorFoto("La foto pesa más de 5 MB aun después de reducirla. Intenta con otra foto.");
  } finally {
    // Libera la memoria del canvas (importante en iPhone).
    canvas.width = 0;
    canvas.height = 0;
  }
}

/** Abre la foto con lo que trae el navegador y la pinta en un canvas de 2200 px de lado mayor. */
async function pintarReducida(archivo: File): Promise<HTMLCanvasElement> {
  const imagen = await abrirImagen(archivo);
  try {
    const escala = Math.min(1, LADO_MAXIMO_PX / Math.max(imagen.ancho, imagen.alto));
    const ancho = Math.max(1, Math.round(imagen.ancho * escala));
    const alto = Math.max(1, Math.round(imagen.alto * escala));

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ErrorFoto("El navegador no pudo procesar la foto. Cierra otras apps e intenta de nuevo.");

    // Fondo blanco: JPEG no tiene transparencia y sin esto quedaría negro.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ancho, alto);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(imagen.fuente, 0, 0, ancho, alto);
    return canvas;
  } finally {
    imagen.cerrar();
  }
}

async function exportarJpeg(canvas: HTMLCanvasElement, calidad: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", calidad));
  if (!blob || blob.type !== "image/jpeg") {
    throw new ErrorFoto("El navegador no pudo convertir la foto a JPEG. Intenta con otra foto.");
  }
  return blob;
}

type ImagenAbierta = {
  fuente: CanvasImageSource;
  ancho: number;
  alto: number;
  cerrar: () => void;
};

async function abrirImagen(archivo: File): Promise<ImagenAbierta> {
  // 1) createImageBitmap: rápido y respeta la orientación de la foto (EXIF).
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(archivo, { imageOrientation: "from-image" });
      return { fuente: bmp, ancho: bmp.width, alto: bmp.height, cerrar: () => bmp.close() };
    } catch {
      // Algunos navegadores (Safari viejo) no lo soportan con este formato: se prueba con <img>.
    }
  }

  // 2) <img>: el método más compatible.
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return {
      fuente: img,
      ancho: img.naturalWidth,
      alto: img.naturalHeight,
      cerrar: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new ErrorFoto(mensajeNoSeAbre(archivo));
  }
}

function esHeic(archivo: File): boolean {
  return /image\/hei[cf]/i.test(archivo.type) || /\.(heic|heif)$/i.test(archivo.name);
}

function mensajeNoSeAbre(archivo: File): string {
  if (esHeic(archivo)) {
    return (
      "Este navegador no puede abrir fotos HEIC (formato de iPhone). Qué hacer: " +
      "en Android, abre la foto en Google Fotos, compártela o guárdala como JPG y súbela de nuevo. " +
      "En iPhone, súbela desde Safari, o cambia en Ajustes → Cámara → Formatos a «Más compatible» " +
      "para que las fotos nuevas se guarden en JPG."
    );
  }
  return "No se pudo abrir este archivo como imagen. Revisa que sea una foto (JPG, PNG o HEIC) y elige otra.";
}

/**
 * UUID nuevo para el nombre del archivo. crypto.randomUUID solo existe en https o
 * localhost; si la app se abre por http (por ejemplo con la IP de la computadora),
 * se arma uno con crypto.getRandomValues, que sí funciona ahí.
 */
export function nuevoUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // versión 4
  b[8] = (b[8] & 0x3f) | 0x80; // variante
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Ruta dentro del bucket: visitas/<visita_id>/<uuid-nuevo>.<ext> */
export function rutaFoto(visitaId: string, extension: string): string {
  return `visitas/${visitaId}/${nuevoUuid()}.${extension}`;
}

/**
 * Dirección pública (URL) de una foto del bucket. El bucket es público para leer,
 * así que no hace falta pedir permiso: la URL se arma sin consultar al servidor.
 */
export function urlFoto(ruta: string): string {
  return supabase.storage.from(BUCKET_FOTOS).getPublicUrl(ruta).data.publicUrl;
}

/** Convierte un error de Supabase (Storage o tabla) en un mensaje en español. */
export function mensajeErrorSubida(error: { message?: string; statusCode?: string | number } | null): string {
  const texto = (error?.message ?? "").toLowerCase();
  const codigo = String(error?.statusCode ?? "");
  if (texto.includes("failed to fetch") || texto.includes("network") || texto.includes("load failed")) {
    return "No hay conexión a internet o es muy débil. Revisa tu señal y toca «Reintentar».";
  }
  if (codigo === "413" || texto.includes("exceeded the maximum") || texto.includes("too large")) {
    return "La foto pesa más de 5 MB. Intenta con otra foto.";
  }
  if (texto.includes("mime") || texto.includes("not supported")) {
    return "El servidor no aceptó el formato de la foto. Intenta con otra foto.";
  }
  if (texto.includes("row-level security") || texto.includes("policy") || codigo === "403") {
    return "El servidor no permitió guardar la foto. Avisa al responsable de la app.";
  }
  return `No se pudo subir la foto. Toca «Reintentar». (Detalle: ${error?.message || "desconocido"})`;
}
