"use client";

// SOLO ADMIN: fotos quitadas de una visita, con el botón "Restaurar".
// Restaurar llama a la función de la base admin_restaurar_foto
// (supabase/008_autenticacion.sql), que revisa que quien la llama sea admin.
// Va cerrada (<details>) para no estorbar: se abre tocando el título.
/* eslint-disable @next/next/no-img-element */

import { formatearFecha } from "@/lib/fechas";
import type { Foto } from "@/lib/tipos";
import type { UrlsFirmadas } from "@/lib/urlsFirmadas";
import { SinImagen } from "./GaleriaFotos";

type Props = {
  fotos: Foto[];
  /** Fotos que se están restaurando (su botón queda desactivado). */
  restaurando: ReadonlySet<string>;
  alRestaurar: (foto: Foto) => void;
  urls: UrlsFirmadas;
};

export default function FotosQuitadas({ fotos, restaurando, alRestaurar, urls }: Props) {
  if (fotos.length === 0) return null;

  return (
    <details className="rounded-xl border-2 border-borde bg-tarjeta p-3">
      <summary className="cursor-pointer text-lg font-semibold">
        Fotos quitadas ({fotos.length}) — admin
      </summary>
      <p className="mt-2 text-base text-texto-suave">
        No se ven en la visita ni se mandan a leer. Puedes volver a ponerlas a la vista.
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-3">
        {fotos.map((f) => (
          <li key={f.id} className="flex flex-col gap-2">
            <div className="aspect-square w-full overflow-hidden rounded-lg border-2 border-borde bg-fondo">
              {urls.urlDe(f.ruta) ? (
                <img
                  src={urls.urlDe(f.ruta)!}
                  alt="Foto quitada"
                  loading="lazy"
                  decoding="async"
                  onError={() => urls.alFallarImagen(f.ruta)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <SinImagen url={urls.urlDe(f.ruta)} />
              )}
            </div>
            {f.descartada_at && (
              <p className="text-sm text-texto-suave">Quitada {formatearFecha(f.descartada_at)}</p>
            )}
            <button
              type="button"
              onClick={() => alRestaurar(f)}
              disabled={restaurando.has(f.id)}
              className="boton-gris rounded-xl px-3 py-3 text-base font-semibold"
            >
              {restaurando.has(f.id) ? "Restaurando…" : "Restaurar"}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
