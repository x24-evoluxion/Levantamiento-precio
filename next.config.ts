import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // App de uso interno: le pide a los buscadores que no indexen nada (páginas,
  // íconos, etc.). Va junto con `robots` en src/app/layout.tsx.
  // No se usa "Disallow" en robots.txt a propósito: si el buscador no puede
  // entrar, no ve este aviso y podría listar el link de todos modos.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
