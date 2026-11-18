// Ícono de la pestaña del navegador. El dibujo está en src/lib/icono.tsx.
import { dibujarIcono } from "@/lib/icono";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return dibujarIcono(size.width, true);
}
