// Ayudas para obtener la ubicación del celular con la función del navegador
// (navigator.geolocation). Solo funciona en https o en localhost.

export type Ubicacion = {
  latitud: number;
  longitud: number;
  precision_metros: number;
  ubicacion_at: string; // ISO en UTC, reloj del celular
};

// Por qué falló, para mostrar el mensaje correcto.
export type MotivoFallo =
  | "sin-permiso" // el usuario (o el celular) negó el permiso
  | "no-disponible" // el GPS no pudo encontrar la posición
  | "tardo-mucho" // se acabó el tiempo de espera
  | "sin-https" // la página no está en https (ni en localhost)
  | "no-soportado"; // el navegador no tiene geolocalización

export type ResultadoUbicacion =
  | { ok: true; ubicacion: Ubicacion }
  | { ok: false; motivo: MotivoFallo };

// Cuánto esperar al GPS antes de rendirse (milisegundos).
const ESPERA_MAXIMA_MS = 20_000;

export function pedirUbicacion(): Promise<ResultadoUbicacion> {
  return new Promise((resolver) => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      resolver({ ok: false, motivo: "sin-https" });
      return;
    }
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      resolver({ ok: false, motivo: "no-soportado" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolver({
          ok: true,
          ubicacion: {
            latitud: pos.coords.latitude,
            longitud: pos.coords.longitude,
            precision_metros: pos.coords.accuracy,
            // Momento en que llegó la ubicación (no pos.timestamp: en algunos
            // celulares viene en otra unidad o desfasado).
            ubicacion_at: new Date().toISOString(),
          },
        });
      },
      (err) => {
        const motivo: MotivoFallo =
          err.code === err.PERMISSION_DENIED
            ? "sin-permiso"
            : err.code === err.TIMEOUT
              ? "tardo-mucho"
              : "no-disponible";
        resolver({ ok: false, motivo });
      },
      {
        enableHighAccuracy: true, // usar el GPS, no solo la red
        timeout: ESPERA_MAXIMA_MS,
        maximumAge: 0, // no reutilizar una ubicación vieja guardada
      },
    );
  });
}

// Enlace que abre Google Maps (app o web) con un pin en esas coordenadas.
export function enlaceMapa(latitud: number, longitud: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitud},${longitud}`;
}

// "± 15 m"
export function formatearPrecision(metros: number): string {
  return `± ${Math.round(metros)} m`;
}

// A partir de esta precisión avisamos que la ubicación es poco exacta.
export const PRECISION_DUDOSA_METROS = 100;

/**
 * Lee coordenadas escritas o pegadas por el admin para corregir una ubicación (013):
 *   "19.4326, -99.1332" · "19.4326 -99.1332" · enlaces de Google Maps con
 *   "@19.4326,-99.1332", "?q=19.4326,-99.1332" o "query=19.4326,-99.1332".
 * Devuelve null si no se entiende o si está fuera de rango (latitud ±90, longitud ±180).
 */
export function leerCoordenadas(texto: string): { latitud: number; longitud: number } | null {
  const limpio = decodeURIComponent(texto.trim().replace(/%(?![0-9a-f]{2})/gi, "%25"));
  const numero = String.raw`[-+]?\d{1,3}(?:\.\d+)?`;
  const patrones = [
    new RegExp(String.raw`@(${numero}),\s*(${numero})`),
    new RegExp(String.raw`[?&](?:q|query|ll|center)=(${numero}),\s*(${numero})`),
    new RegExp(String.raw`^(${numero})\s*[,;\s]\s*(${numero})$`),
  ];
  for (const p of patrones) {
    const m = limpio.match(p);
    if (!m) continue;
    const latitud = Number(m[1]);
    const longitud = Number(m[2]);
    if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) return null;
    if (Math.abs(latitud) > 90 || Math.abs(longitud) > 180) return null;
    return { latitud, longitud };
  }
  return null;
}
