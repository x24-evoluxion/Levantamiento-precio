"use client";

// Correo de quien creó cada visita (SOLO para el admin).
// La app no puede leer la lista de cuentas de Supabase. La función de la base
// admin_correos_usuarios (supabase/008_autenticacion.sql) sí, pero solo responde
// si quien la llama es admin.

import { supabase } from "./supabase";
import type { Usuario } from "./sesion";

/** null = no se pudieron leer (se muestra un texto genérico). */
export type Correos = ReadonlyMap<string, string> | null;

export async function leerCorreos(): Promise<Correos> {
  const { data, error } = await supabase.rpc("admin_correos_usuarios");
  if (error) return null;
  return new Map(data.map((u) => [u.usuario_id, u.correo]));
}

/** Texto "creada por" de una visita. */
export function textoCreador(usuarioId: string | null, correos: Correos, yo: Usuario): string {
  if (!usuarioId) return "Sin usuario (visita de antes del login)";
  if (usuarioId === yo.id) return `Tú (${yo.correo})`;
  if (!correos) return "Otra persona (no se pudo leer su correo)";
  return correos.get(usuarioId) ?? "Cuenta borrada o desconocida";
}
