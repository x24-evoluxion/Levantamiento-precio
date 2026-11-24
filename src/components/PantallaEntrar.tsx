"use client";

// Pantalla "Entrar": usuario (o correo) y contraseña (Supabase Auth).
// No hay registro: las cuentas las crea el responsable en el panel de Supabase.
// Usuario sin "@" → se arma <usuario>@<dominio interno> (ver src/lib/usuarios.ts).
//
// Gestor de contraseñas del celular: es un <form> real con botón de envío, y los
// campos usan name/autoComplete "username" y "current-password". Así iPhone y Android
// ofrecen guardar la contraseña y la rellenan la próxima vez.
//
// En este celular se recuerda SOLO el último usuario escrito (nunca la contraseña).
// Al entrar bien, <PuertaSesion> recibe el aviso de la librería y muestra la app;
// esta pantalla no tiene que hacer nada más.

import { useState } from "react";
import { isAuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { correoParaEntrar } from "@/lib/usuarios";
import TituloError from "./TituloError";

/** Convierte un error de Supabase Auth en un mensaje en español. */
function mensajeErrorEntrar(error: AuthError): string {
  const texto = error.message.toLowerCase();
  if (
    isAuthRetryableFetchError(error) ||
    texto.includes("failed to fetch") ||
    texto.includes("network") ||
    texto.includes("load failed")
  ) {
    return "No hay conexión a internet o es muy débil. Revisa tu señal y vuelve a intentar.";
  }
  switch (error.code) {
    case "invalid_credentials":
      // Genérico a propósito: no dice si falló el usuario o la contraseña.
      return "Usuario o contraseña incorrectos.";
    case "email_not_confirmed":
      return "Tu cuenta todavía no está confirmada. Avisa al responsable.";
    case "user_banned":
      return "Tu cuenta está desactivada. Avisa al responsable.";
    case "over_request_rate_limit":
      return "Hubo demasiados intentos. Espera unos minutos y vuelve a intentar.";
    case "validation_failed":
      return "Escribe tu usuario y tu contraseña.";
  }
  if (error.status === 429) {
    return "Hubo demasiados intentos. Espera unos minutos y vuelve a intentar.";
  }
  return `No se pudo entrar. Vuelve a intentar. (Detalle: ${error.message || "desconocido"})`;
}

const CLAVE_ULTIMO_USUARIO = "levantamiento:ultimo-usuario";

function leerUltimoUsuario(): string {
  try {
    return window.localStorage.getItem(CLAVE_ULTIMO_USUARIO) ?? "";
  } catch {
    return ""; // modo privado o almacenamiento bloqueado: se empieza vacío
  }
}

function guardarUltimoUsuario(usuario: string) {
  try {
    window.localStorage.setItem(CLAVE_ULTIMO_USUARIO, usuario);
  } catch {
    // Si no se puede guardar, no pasa nada: solo no se precarga la próxima vez.
  }
}

const CLASE_CAMPO =
  "w-full rounded-xl border-2 border-borde bg-fondo px-4 py-3 text-xl text-texto outline-offset-2 focus-visible:outline-3 focus-visible:outline-marca";

export default function PantallaEntrar({ sesionTerminada }: { sesionTerminada: boolean }) {
  // Esta pantalla solo se crea en el navegador (PuertaSesion la muestra después de
  // revisar la sesión), así que aquí ya se puede leer localStorage.
  const [usuario, setUsuario] = useState(leerUltimoUsuario);
  const [contrasena, setContrasena] = useState("");
  const [verContrasena, setVerContrasena] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function entrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (entrando) return;
    const resultado = correoParaEntrar(usuario);
    if (!resultado.ok) {
      setError(resultado.mensaje);
      return;
    }
    if (!contrasena) {
      setError("Escribe tu usuario y tu contraseña.");
      return;
    }
    setUsuario(resultado.usuario);
    guardarUltimoUsuario(resultado.usuario);
    setEntrando(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: resultado.correo,
      password: contrasena,
    });
    if (error) {
      setError(mensajeErrorEntrar(error));
      setEntrando(false);
    }
    // Si entró bien, se deja "entrando" en true: el botón sigue desactivado mientras
    // aparece la app.
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl font-bold">Levantamiento de precios</h1>

      {sesionTerminada && (
        <div role="alert" className="caja-aviso">
          <p className="font-semibold">Tu sesión terminó.</p>
          <p className="mt-1 text-base">Vuelve a entrar para seguir donde te quedaste.</p>
        </div>
      )}

      <form onSubmit={entrar} noValidate className="flex flex-col gap-5">
        <h2 className="text-2xl font-bold">Entrar</h2>

        <label className="flex flex-col gap-2">
          <span className="text-lg font-semibold">Usuario o correo</span>
          <input
            type="text"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            disabled={entrando}
            className={CLASE_CAMPO}
          />
        </label>

        <div className="flex flex-col gap-2">
          <label htmlFor="contrasena" className="text-lg font-semibold">
            Contraseña
          </label>
          <div className="flex gap-2">
            <input
              id="contrasena"
              name="password"
              type={verContrasena ? "text" : "password"}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              disabled={entrando}
              className={`${CLASE_CAMPO} min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={() => setVerContrasena((v) => !v)}
              aria-pressed={verContrasena}
              className="boton-gris shrink-0 rounded-xl px-4 py-3 text-base font-semibold"
            >
              {verContrasena ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="caja-error">
            <TituloError>{error}</TituloError>
          </div>
        )}

        <button
          type="submit"
          disabled={entrando}
          className="boton-primario rounded-2xl px-6 py-5 text-2xl font-bold"
        >
          {entrando ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="text-center text-base text-texto-suave">
        ¿No tienes cuenta? Pide tu acceso al responsable.
      </p>
    </main>
  );
}
