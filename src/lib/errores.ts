// Qué decirle a la persona cuando guardar algo en Supabase falla.
//
// Hay tres tipos de falla y cada una pide algo distinto:
//   "red"     → el celular no llegó a Supabase (sin internet, señal débil, tardó
//               demasiado). Supabase nunca respondió. Qué hacer: revisar la señal y
//               volver a intentar.
//   "sesion"  → Supabase respondió que el pase de la sesión (JWT) caducó o no sirve.
//               Qué hacer: iniciar sesión otra vez.
//   "supabase"→ Supabase respondió con un error (por ejemplo, una regla de permisos,
//               código 42501). Volver a intentar no sirve: hay que avisar al
//               responsable con el CÓDIGO, que basta para buscar el problema.
//
// Cómo se reconoce cada una (librerías @supabase 2.119):
//   - Tablas y funciones (postgrest-js): si fetch falla, NO lanza; devuelve un error
//     con code "" y un mensaje "TypeError: Failed to fetch" / "AbortError: …"
//     / "TimeoutError: …". Un error de verdad de Supabase trae code ("42501", "PGRST303"…).
//   - Storage (storage-js): si fetch falla devuelve StorageUnknownError (con el error
//     original); si Supabase respondió, StorageApiError con status y code.
//   - Sesión caducada: PostgREST da PGRST301/PGRST303 ("JWT expired"); Storage da
//     code "InvalidJWT" o un mensaje sobre "jwt" / "exp" claim.

export type TipoFalla = "red" | "sesion" | "supabase";

export type Falla = {
  tipo: TipoFalla;
  /** Código corto para el responsable (solo cuando tipo es "supabase"). */
  codigo: string;
};

type ErrorSuelto = {
  name?: unknown;
  message?: unknown;
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
  originalError?: unknown;
  __isStorageError?: unknown;
};

const MENSAJES_DE_RED =
  /failed to fetch|load failed|networkerror|network request failed|network error|err_internet|err_network|timed? ?out|the internet connection appears to be offline/i;

const NOMBRES_DE_RED = new Set(["TypeError", "AbortError", "TimeoutError", "FetchError"]);

const CODIGOS_DE_SESION = new Set(["PGRST301", "PGRST302", "PGRST303", "InvalidJWT"]);

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : typeof valor === "number" ? String(valor) : "";
}

function esFallaDeRed(e: ErrorSuelto): boolean {
  const nombre = texto(e.name);
  const mensaje = texto(e.message);
  // Error lanzado por fetch tal cual (TypeError, AbortError…).
  if (NOMBRES_DE_RED.has(nombre)) return true;
  // Storage: no hubo respuesta de Supabase; se mira el error original.
  if (nombre === "StorageUnknownError") {
    const original = (e.originalError ?? {}) as ErrorSuelto;
    return NOMBRES_DE_RED.has(texto(original.name)) || MENSAJES_DE_RED.test(texto(original.message) || mensaje);
  }
  // PostgREST: sin código y con el mensaje de fetch ("TypeError: Failed to fetch").
  if (!e.__isStorageError && texto(e.code) === "") {
    const prefijo = mensaje.split(":")[0];
    if (NOMBRES_DE_RED.has(prefijo) || MENSAJES_DE_RED.test(mensaje)) return true;
  }
  return false;
}

function esSesionCaducada(e: ErrorSuelto): boolean {
  if (CODIGOS_DE_SESION.has(texto(e.code))) return true;
  return /jwt expired|invalid jwt|"exp" claim|jwt.*(expired|invalid|malformed)/i.test(texto(e.message));
}

function codigoDe(e: ErrorSuelto): string {
  const code = texto(e.code);
  if (e.__isStorageError) {
    // Storage: "S" + estado HTTP (+ código de Storage si lo trae). Ej.: S403-Unauthorized.
    const estado = texto(e.status) || texto(e.statusCode);
    const partes = [estado && `S${estado}`, code && code !== estado ? code : ""].filter(Boolean);
    return partes.length > 0 ? partes.join("-") : "S-SIN-CODIGO";
  }
  if (code) return code;
  return "SIN-CODIGO";
}

/**
 * Decide qué tipo de falla es un error de Supabase (o lanzado al llamarlo).
 * `estado` es el status HTTP que devuelve la consulta, si se tiene: 0 = no hubo respuesta.
 */
export function clasificarFalla(error: unknown, estado?: number): Falla {
  const sinInternet = typeof navigator !== "undefined" && navigator.onLine === false;
  if (error === null || typeof error !== "object") {
    return sinInternet ? { tipo: "red", codigo: "" } : { tipo: "supabase", codigo: "DESCONOCIDO" };
  }
  const e = error as ErrorSuelto;
  if (sinInternet || estado === 0 || esFallaDeRed(e)) return { tipo: "red", codigo: "" };
  if (esSesionCaducada(e)) return { tipo: "sesion", codigo: "" };
  // Error de la app (no de Supabase) sin código: se marca para el responsable.
  if (!e.__isStorageError && error instanceof Error && texto(e.code) === "") {
    return { tipo: "supabase", codigo: "APP" };
  }
  const codigo = codigoDe(e);
  // Respuesta sin código (por ejemplo, un 502 del servidor): se usa el status HTTP.
  if (codigo === "SIN-CODIGO" && estado) return { tipo: "supabase", codigo: `HTTP-${estado}` };
  return { tipo: "supabase", codigo };
}

/** Falla de Supabase con un código propio de la app (por ejemplo, "SIN-CAMBIO"). */
export function fallaConCodigo(codigo: string): Falla {
  return { tipo: "supabase", codigo };
}

export const MENSAJE_RED =
  "No hay conexión a internet o tardó demasiado en responder. Revisa tu señal e inténtalo otra vez.";

export const MENSAJE_SESION = "Tu sesión caducó. Inicia sesión otra vez y vuelve a intentarlo.";

/** El mensaje para la persona. Nunca incluye texto técnico, solo el código. */
export function mensajeDeFalla(falla: Falla): string {
  if (falla.tipo === "red") return MENSAJE_RED;
  if (falla.tipo === "sesion") return MENSAJE_SESION;
  return `No se pudo guardar. Avisa al responsable e indica este código: ${falla.codigo}`;
}
