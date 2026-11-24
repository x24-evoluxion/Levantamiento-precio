import { createClient } from "@supabase/supabase-js";
import type { Database } from "./tipos";

// Cliente de Supabase: el objeto que usa la app para leer y guardar datos.
//
// Las variables se escriben LITERALMENTE (process.env.NEXT_PUBLIC_...) porque
// Next.js las reemplaza por su valor al construir la app. Si se leen de otra
// forma (por ejemplo process.env[nombre]), en el navegador llegan vacías.
//
// Solo se usa la llave pública "publishable". La protección la dan las reglas RLS de
// Supabase (cada persona solo ve lo suyo; ver supabase/008_autenticacion.sql).
// NUNCA pongas aquí la llave service_role / secret.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Faltan variables de entorno de Supabase. Revisa que .env.local tenga " +
      "NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ver .env.example) " +
      "y reinicia `npm run dev`.",
  );
}

// <Database> le dice a TypeScript cómo son las tablas (ver src/lib/tipos.ts).
//
// Sesión (login con correo y contraseña, 2026-11-24):
//   persistSession   → la sesión se guarda en el navegador (localStorage), así no hay
//                      que entrar cada vez que se abre el link.
//   autoRefreshToken → el "pase" (JWT) dura 1 hora; la librería lo renueva sola antes
//                      de que caduque, y también al volver a la pestaña. Si ya no se
//                      puede renovar (cuenta desactivada, sesión cerrada en otro lado),
//                      avisa con el evento SIGNED_OUT y la app pide entrar otra vez
//                      (src/components/PuertaSesion.tsx).
//   detectSessionInUrl: false → no usamos links mágicos ni Google: la sesión nunca
//                      llega en la dirección de la página.
// Todo esto pasa solo en el navegador: el servidor de Next.js no ve la sesión. Por eso
// todos los datos se leen desde el navegador (como antes) y la seguridad la dan las
// reglas de Supabase, no las páginas.
export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
