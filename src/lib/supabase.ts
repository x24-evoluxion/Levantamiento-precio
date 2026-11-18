import { createClient } from "@supabase/supabase-js";

// Cliente de Supabase: el objeto que usa la app para leer y guardar datos.
//
// Las variables se escriben LITERALMENTE (process.env.NEXT_PUBLIC_...) porque
// Next.js las reemplaza por su valor al construir la app. Si se leen de otra
// forma (por ejemplo process.env[nombre]), en el navegador llegan vacías.
//
// Solo se usa la llave pública "anon". La protección la dan las reglas RLS de
// Supabase. NUNCA pongas aquí la llave service_role / secret.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan variables de entorno de Supabase. Revisa que .env.local tenga " +
      "NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (ver .env.example) " +
      "y reinicia `npm run dev`.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  // Sin login: no hace falta guardar sesiones en el navegador.
  auth: { persistSession: false, autoRefreshToken: false },
});
