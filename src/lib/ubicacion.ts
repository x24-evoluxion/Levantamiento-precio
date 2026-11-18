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
