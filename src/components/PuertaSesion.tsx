"use client";

// "Puerta" de la app: ninguna pantalla se muestra sin sesión.
// Envuelve TODAS las rutas desde src/app/layout.tsx.
//
//   1. Al abrir la app → "Revisando tu sesión…" mientras la librería lee la sesión
//      guardada en el celular (y la renueva si hace falta).
//   2. Sin sesión → pantalla "Entrar" (correo y contraseña). Las pantallas de la app
//      ni siquiera se crean, así que no se consulta nada sin sesión.
//   3. Con sesión → arriba, el correo y "Cerrar sesión"; abajo, la pantalla pedida.
//
// SESIÓN CADUCADA: si la sesión termina mientras se usa la app (la cuenta se
// desactivó, se cerró en otra pestaña o ya no se pudo renovar), la librería avisa con
// SIGNED_OUT. Entonces se muestra "Entrar" con el aviso "Tu sesión terminó" y la
// pantalla de antes se ESCONDE sin borrarse (por ejemplo, la lista de fotos que se
// estaban subiendo). Si vuelve a entrar la MISMA persona, reaparece tal como estaba.
// Si entra OTRA cuenta, se recarga la página entera para no mezclar datos de dos
// personas.
//
// Nota sobre Next.js (cacheComponents): este componente lee la sesión solo en el
// navegador (en un efecto). Al construir la app, Next.js guarda la versión
// "Revisando tu sesión…" como pantalla inicial; nunca guarda datos de nadie.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SesionContexto, usuarioDeSesion, type Usuario } from "@/lib/sesion";
import PantallaEntrar from "./PantallaEntrar";

function mismoUsuario(a: Usuario | null, b: Usuario): boolean {
  return !!a && a.id === b.id && a.correo === b.correo && a.esAdmin === b.esAdmin;
}

export default function PuertaSesion({ children }: { children: React.ReactNode }) {
  /** null = todavía se está revisando; true / false = hay o no hay sesión. */
  const [conSesion, setConSesion] = useState<boolean | null>(null);
  /** Persona para la que se crearon las pantallas (sigue aunque la sesión caduque). */
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [errorSalir, setErrorSalir] = useState(false);

  // Copias para leer dentro del aviso de la librería (que no ve el estado nuevo).
  const idActual = useRef<string | null>(null);
  const saliendo = useRef(false);

  useEffect(() => {
    // Avisa al empezar (INITIAL_SESSION) y cada vez que cambia la sesión: al entrar,
    // al renovarse el pase (TOKEN_REFRESHED, cada hora), al cerrar sesión o caducar.
    // Ojo: aquí dentro no se debe esperar (await) otra llamada a Supabase.
    const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      if (sesion) {
        const nuevo = usuarioDeSesion(sesion);
        if (idActual.current !== null && idActual.current !== nuevo.id) {
          window.location.reload();
          return;
        }
        idActual.current = nuevo.id;
        setUsuario((antes) => (mismoUsuario(antes, nuevo) ? antes : nuevo));
        setConSesion(true);
      } else if (!saliendo.current) {
        setConSesion(false);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function cerrarSesion() {
    saliendo.current = true;
    setErrorSalir(false);
    // scope "local": cierra solo en este celular. La librería borra la sesión guardada
    // ANTES de avisar al servidor, así que funciona aunque no haya internet.
    const { error } = await supabase.auth.signOut({ scope: "local" });
    const { data } = await supabase.auth.getSession();
    if (error && data.session) {
      saliendo.current = false;
      setErrorSalir(true);
      return;
    }
    // Se recarga la app desde cero: no queda en memoria nada de la persona que salió.
    window.location.replace("/");
  }

  if (conSesion === null) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
        <p role="status" className="caja-info">
          Revisando tu sesión…
        </p>
      </main>
    );
  }

  return (
    <>
      {usuario && (
        <div hidden={!conSesion} className="flex flex-1 flex-col">
          <SesionContexto value={{ usuario, cerrarSesion }}>
            <header className="mx-auto w-full max-w-md px-4 pt-4">
              <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-borde bg-tarjeta px-3 py-2">
                <p className="min-w-0 text-base text-texto-suave">
                  <span className="block truncate">{usuario.correo}</span>
                  {usuario.esAdmin && <span className="block font-semibold text-texto">Administrador</span>}
                </p>
                <button
                  type="button"
                  onClick={cerrarSesion}
                  className="boton-gris shrink-0 rounded-xl px-4 py-3 text-base font-semibold"
                >
                  Cerrar sesión
                </button>
              </div>
              {errorSalir && (
                <p role="alert" className="caja-error mt-2">
                  No se pudo cerrar la sesión. Revisa tu conexión a internet e inténtalo otra vez.
                </p>
              )}
            </header>
            {children}
          </SesionContexto>
        </div>
      )}
      {!conSesion && <PantallaEntrar sesionTerminada={usuario !== null} />}
    </>
  );
}
