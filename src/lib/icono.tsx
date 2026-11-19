// Dibujo del ícono de la app: un "$" blanco sobre el rojo de marca.
// Lo usan src/app/icon.tsx (pestaña del navegador) y src/app/apple-icon.tsx
// (pantalla de inicio del iPhone). next/og lo convierte en PNG al construir.

import { ImageResponse } from "next/og";
import { COLOR_MARCA, COLOR_SOBRE_MARCA } from "./colores";

export function dibujarIcono(lado: number, redondeado: boolean) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: COLOR_MARCA,
          color: COLOR_SOBRE_MARCA,
          fontSize: lado * 0.72,
          fontWeight: 700,
          // iPhone redondea las esquinas solo; la pestaña se ve mejor redondeada.
          borderRadius: redondeado ? lado * 0.22 : 0,
        }}
      >
        $
      </div>
    ),
    { width: lado, height: lado },
  );
}
