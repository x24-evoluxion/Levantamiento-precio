// Preparar y nombrar fotos antes de subirlas a Supabase Storage.
//
// Cada foto se reduce (lado mayor de ~2000 px) y se guarda como JPEG:
//   - JPEG, PNG y WebP → los comprime la librería browser-image-compression.
//   - Cualquier otro formato (por ejemplo HEIC/HEIF de iPhone) → se convierte con
//     <canvas>, que ya trae el navegador: se "pinta" la foto y se exporta como JPEG.
//     Si el navegador no sabe abrir ese formato, se lanza ErrorFoto con un mensaje
//     en español que se le muestra al usuario.

export const LADO_MAXIMO_PX = 2000;
export const CALIDAD_JPEG = 0.8;
/** Límite del bucket "fotos" (ver supabase/001_esquema.sql). */
export const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024;

/** Formatos que acepta el bucket. Lo demás se convierte a JPEG antes de subir. */
const TIPOS_ACEPTADOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Error con un mensaje listo para mostrarle al usuario. */
export class ErrorFoto extends Error {}

export type FotoPreparada = { blob: Blob; extension: string; tipo: string };

/** Comprime o convierte una foto para subirla. Lanza ErrorFoto si no se puede. */
export async function prepararFoto(archivo: File): Promise<FotoPreparada> {
  const resultado = TIPOS_ACEPTADOS[archivo.type]
    ? await comprimirConLibreria(archivo)
    : await convertirConCanvas(archivo);

  const extension = TIPOS_ACEPTADOS[resultado.type];
  if (!extension) {
    throw new ErrorFoto("No se pudo convertir la foto a JPEG. Intenta con otra foto.");
  }
  if (resultado.size > TAMANO_MAXIMO_BYTES) {
    throw new ErrorFoto("La foto pesa más de 5 MB aun después de reducirla. Intenta con otra foto.");
  }
  return { blob: resultado, extension, tipo: resultado.type };
}

async function comprimirConLibreria(archivo: File): Promise<Blob> {
  // Se importa aquí (y no arriba) para que solo se cargue en el navegador.
  const { default: imageCompression } = await import("browser-image-compression");
  try {
    return await imageCompression(archivo, {
      maxWidthOrHeight: LADO_MAXIMO_PX,
      maxSizeMB: 1,
      fileType: "image/jpeg",
      initialQuality: CALIDAD_JPEG,
      // Sin "web worker": con él, la librería descarga código de un sitio externo
      // (cdn.jsdelivr.net). Así todo sale de nuestra app.
      useWebWorker: false,
    });
  } catch {
    // Si la librería falla, se intenta con el método del navegador.
    return convertirConCanvas(archivo);
  }
}

/** Abre la foto con lo que trae el navegador, la reduce y la exporta como JPEG. */
async function convertirConCanvas(archivo: File): Promise<Blob> {
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
    ctx.drawImage(imagen.fuente, 0, 0, ancho, alto);

    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", CALIDAD_JPEG));
    if (!blob) throw new ErrorFoto("El navegador no pudo convertir la foto a JPEG. Intenta con otra foto.");
    return blob;
  } finally {
    imagen.cerrar();
  }
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
