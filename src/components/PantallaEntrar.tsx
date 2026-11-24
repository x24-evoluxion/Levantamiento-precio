"use client";

// Pantalla "Entrar": correo y contraseña (Supabase Auth).
// No hay registro: las cuentas las crea el responsable en el panel de Supabase.
// Al entrar bien, <PuertaSesion> recibe el aviso de la librería y muestra la app;
// esta pantalla no tiene que hacer nada más.

import { useState } from "react";
import { isAuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
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
      return "Correo o contraseña incorrectos. Revisa que estén bien escritos.";
    case "email_not_confirmed":
      return "Tu cuenta todavía no está confirmada. Avisa al responsable.";
    case "user_banned":
      return "Tu cuenta está desactivada. Avisa al responsable.";
    case "over_request_rate_limit":
      return "Hubo demasiados intentos. Espera unos minutos y vuelve a intentar.";
    case "validation_failed":
      return "Escribe tu correo y tu contraseña.";
  }
  if (error.status === 429) {
    return "Hubo demasiados intentos. Espera unos minutos y vuelve a intentar.";
  }
  return `No se pudo entrar. Vuelve a intentar. (Detalle: ${error.message || "desconocido"})`;
}

const CLASE_CAMPO =
  "w-full rounded-xl border-2 border-borde bg-fondo px-4 py-3 text-xl text-texto outline-offset-2 focus-visible:outline-3 focus-visible:outline-marca";

export default function PantallaEntrar({ sesionTerminada }: { sesionTerminada: boolean }) {
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [verContrasena, setVerContrasena] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function entrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (entrando) return;
    if (!correo.trim() || !contrasena) {
      setError("Escribe tu correo y tu contraseña.");
      return;
    }
    setEntrando(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: correo.trim(),
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
          <span className="text-lg font-semibold">Correo</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
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
