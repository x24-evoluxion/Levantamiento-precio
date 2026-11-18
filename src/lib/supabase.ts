import { createClient } from "@supabase/supabase-js";
import type { Database } from "./tipos";

// Cliente de Supabase: el objeto que usa la app para leer y guardar datos.
//
// Las variables se escriben LITERALMENTE (process.env.NEXT_PUBLIC_...) porque
// Next.js las reemplaza por su valor al construir la app. Si se leen de otra
// forma (por ejemplo process.env[nombre]), en el navegador llegan vacías.
//
// Solo se usa la llave pública "publishable". La protección la dan las reglas RLS de
// Supabase. NUNCA pongas aquí la llave service_role / secret.
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
export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  // Sin login: no hace falta guardar sesiones en el navegador.
  auth: { persistSession: false, autoRefreshToken: false },
});
