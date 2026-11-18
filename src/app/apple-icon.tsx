// Ícono para "Agregar a pantalla de inicio" en iPhone (180 × 180 es el tamaño que pide Apple).
import { dibujarIcono } from "@/lib/icono";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return dibujarIcono(size.width, false);
}
