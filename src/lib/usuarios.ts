// Convención de usuarios (2026-11-24).
//
// Supabase Auth solo sabe entrar con correo. Para que el personal de campo escriba un
// usuario corto ("juan.perez") en vez de un correo, la app arma el correo así:
//
//     <usuario>@<DOMINIO_INTERNO>      ej. "juan.perez" → "juan.perez@x24.com.mx"
//
// Las cuentas se crean en el panel de Supabase con ESE correo. Si lo escrito lleva "@",
// se usa tal cual (así entran el admin y las cuentas que ya existían).
//
// El dominio vive SOLO aquí. Si TI lo cambia, se cambia en esta línea y nada más.
export const DOMINIO_INTERNO = "x24.com.mx";

const SUFIJO = `@${DOMINIO_INTERNO}`;
const FORMATO_USUARIO = /^[a-z0-9._-]{3,30}$/;

export type ResultadoUsuario =
  | { ok: true; correo: string; usuario: string }
  | { ok: false; mensaje: string };

/**
 * Convierte lo escrito en "Usuario o correo" en el correo para Supabase.
 * No llama a Supabase: si el formato no sirve, regresa el mensaje para la pantalla.
 */
export function correoParaEntrar(texto: string): ResultadoUsuario {
  if (texto.includes("@")) {
    const correo = texto.trim();
    return { ok: true, correo, usuario: correo };
  }
  const usuario = texto.replace(/\s+/g, "").toLowerCase();
  if (!usuario) {
    return { ok: false, mensaje: "Escribe tu usuario y tu contraseña." };
  }
  if (!FORMATO_USUARIO.test(usuario)) {
    return {
      ok: false,
      mensaje:
        "El usuario no es válido. Debe tener de 3 a 30 caracteres y solo letras sin acentos, números, punto (.), guion (-) o guion bajo (_).",
    };
  }
  return { ok: true, correo: `${usuario}${SUFIJO}`, usuario };
}

/** Lo que se muestra de una cuenta: el usuario si es del dominio interno; si no, el correo completo. */
export function nombreVisible(correo: string): string {
  if (correo.length > SUFIJO.length && correo.toLowerCase().endsWith(SUFIJO)) {
    return correo.slice(0, -SUFIJO.length);
  }
  return correo;
}
