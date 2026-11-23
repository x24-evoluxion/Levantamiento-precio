"use client";

// Hace que una pantalla empiece "limpia" cada vez que se vuelve a abrir.
//
// Por qué hace falta: la app usa `cacheComponents: true` (next.config.ts). Con eso,
// Next.js NO desmonta la pantalla anterior al navegar: la esconde con <Activity> de
// React y conserva todo su estado (lo elegido, la ubicación, la lista ya cargada…).
// Al regresar, la pantalla aparece tal como se dejó.
// (Doc: node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md)
//
// Cómo funciona: cuando Next esconde la pantalla, React corre la "limpieza" de los
// efectos. Aquí esa limpieza cambia la `key` de lo que está adentro, y React lo
// vuelve a crear desde cero. Al regresar, todo empieza vacío y vuelve a leer los
// datos de Supabase. Si quedaba algo en camino (por ejemplo, la ubicación), su
// respuesta llega a la copia vieja, que ya no existe, y se ignora.
//
// Se usa useLayoutEffect (y no useEffect) para que el reinicio pase antes de que la
// pantalla se esconda, sin mostrar por un instante lo de antes.

import { Fragment, useLayoutEffect, useState } from "react";

export default function ReiniciarAlSalir({ children }: { children: React.ReactNode }) {
  const [vuelta, setVuelta] = useState(0);

  useLayoutEffect(() => {
    return () => setVuelta((n) => n + 1);
  }, []);

  return <Fragment key={vuelta}>{children}</Fragment>;
}
