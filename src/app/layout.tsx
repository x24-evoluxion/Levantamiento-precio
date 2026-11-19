import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { COLOR_FONDO } from "@/lib/colores";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Levantamiento de precios",
  description: "Registro de visitas y fotos de precios de la competencia",
  // App de uso interno: que los buscadores no la muestren ni sigan sus enlaces.
  // Además, next.config.ts manda el encabezado X-Robots-Tag en todas las respuestas.
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  // Nombre corto si alguien la agrega a la pantalla de inicio del iPhone.
  appleWebApp: { title: "Precios" },
};

// Barra del navegador en el celular: del mismo negro que el fondo.
// colorScheme "dark": la app siempre es oscura, aunque el celular esté en modo claro.
export const viewport: Viewport = {
  themeColor: COLOR_FONDO,
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-fondo text-texto">{children}</body>
    </html>
  );
}
