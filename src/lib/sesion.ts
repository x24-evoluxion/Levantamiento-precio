"use client";

// Quién está usando la app. Lo llena <PuertaSesion> (src/components/PuertaSesion.tsx)
// y cualquier pantalla lo lee con useSesion().
//
// esAdmin sale de app_metadata.rol, que SOLO puede cambiar el dueño en el panel de
// Supabase. Aquí solo sirve para mostrar u ocultar botones: la seguridad de verdad
// la pone la base de datos (es_admin() en supabase/008_autenticacion.sql), que lee
// lo mismo del JWT. NUNCA se usa user_metadata, porque cada persona lo puede editar.

import { createContext, use } from "react";
import type { Session } from "@supabase/supabase-js";

export type Usuario = {
  id: string;
  correo: string;
  esAdmin: boolean;
};

export type ContextoSesion = {
  usuario: Usuario;
  /** Cierra la sesión en este celular y vuelve a la pantalla de entrar. */
  cerrarSesion: () => Promise<void>;
};

export const SesionContexto = createContext<ContextoSesion | null>(null);

export function usuarioDeSesion(sesion: Session): Usuario {
  return {
    id: sesion.user.id,
    correo: sesion.user.email ?? "(sin correo)",
    esAdmin: sesion.user.app_metadata?.rol === "admin",
  };
}

/** Datos de la persona que entró. Solo funciona dentro de <PuertaSesion>. */
export function useSesion(): ContextoSesion {
  const contexto = use(SesionContexto);
  if (!contexto) throw new Error("useSesion se usó fuera de <PuertaSesion>");
  return contexto;
}
