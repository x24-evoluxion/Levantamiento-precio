"use client";

// Zona para elegir fotos de la galería y subirlas, una por una, a la carpeta de
// la visita en Storage (visitas/<visita_id>/<uuid>.jpg). Por cada foto subida se
// crea una fila en la tabla "fotos", con la hora en que se tomó (si el archivo la trae).
//
// Si una foto falla, las demás se siguen subiendo, y esa se puede reintentar sola.
// Cada foto que queda guardada se avisa con "alSubir" para que aparezca en la galería.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { BUCKET_FOTOS, type Foto } from "@/lib/tipos";
import { IconoAlerta } from "@/components/TituloError";
import { ErrorFoto, mensajeErrorSubida, prepararFoto, rutaFoto, type FotoPreparada } from "@/lib/fotos";
import { leerHoraCaptura, type HoraCaptura } from "@/lib/exif";

type EstadoFoto = "esperando" | "preparando" | "subiendo" | "guardando" | "listo" | "error";

type ItemFoto = {
  clave: string;
  nombre: string;
  estado: EstadoFoto;
  mensaje?: string;
  /** false si reintentar no sirve (por ejemplo, un formato que el navegador no abre). */
  reintentable?: boolean;
};

/** Lo que se va logrando con cada foto, para que un reintento siga donde se quedó. */
type Avance = {
  archivo: File;
  /** Hora en que se tomó la foto, leída ANTES de comprimir (al comprimir se pierde). */
  hora?: HoraCaptura;
  preparada?: FotoPreparada;
  ruta?: string;
  archivoSubido: boolean;
};

const TEXTO_ESTADO: Record<EstadoFoto, string> = {
  esperando: "En espera",
  preparando: "Reduciendo…",
  subiendo: "Subiendo…",
  guardando: "Guardando…",
  listo: "✅ Subida",
  error: "Error",
};

let contador = 0;

type Props = {
  visitaId: string;
  /** Se llama con la fila nueva de "fotos", o con null si hay que volver a leer la lista. */
  alSubir: (foto: Foto | null) => void;
};

export default function SubirFotos({ visitaId, alSubir }: Props) {
  const [items, setItems] = useState<ItemFoto[]>([]);
  const [progreso, setProgreso] = useState<{ actual: number; total: number } | null>(null);
  const avances = useRef(new Map<string, Avance>());
  const ocupado = progreso !== null;

  // Si cierra o recarga la página mientras sube, el navegador pregunta antes.
  useEffect(() => {
    if (!ocupado) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [ocupado]);

  function actualizar(clave: string, cambios: Partial<ItemFoto>) {
    setItems((lista) => lista.map((it) => (it.clave === clave ? { ...it, ...cambios } : it)));
  }

  async function subirUna(clave: string) {
    const av = avances.current.get(clave);
    if (!av) return;

    // 1) Leer la hora de captura del archivo original y luego reducir / convertir
    //    a JPEG (solo la primera vez). El orden importa: la hora se pierde al comprimir.
    if (!av.preparada) {
      actualizar(clave, { estado: "preparando", mensaje: undefined });
      av.hora ??= await leerHoraCaptura(av.archivo);
      av.preparada = await prepararFoto(av.archivo);
    }

    // 2) Subir el archivo a Storage (si un intento anterior no lo logró).
    if (!av.archivoSubido) {
      actualizar(clave, { estado: "subiendo", mensaje: undefined });
      av.ruta ??= rutaFoto(visitaId, av.preparada.extension);
      const { error } = await supabase.storage.from(BUCKET_FOTOS).upload(av.ruta, av.preparada.blob, {
        contentType: av.preparada.tipo,
        upsert: false, // "anon" no puede reemplazar archivos
        cacheControl: "31536000", // la foto nunca cambia: el celular la puede guardar en caché
      });
      // "Ya existe": un intento anterior sí la subió, aunque no llegó la respuesta.
      const yaExiste = error && /already exists|duplicate/i.test(error.message);
      if (error && !yaExiste) throw error;
      av.archivoSubido = true;
    }

    // 3) Registrar la foto en la tabla "fotos".
    actualizar(clave, { estado: "guardando", mensaje: undefined });
    const { data, error } = await supabase
      .from("fotos")
      .insert({
        visita_id: visitaId,
        ruta: av.ruta!,
        nombre_original: av.archivo.name || null,
        tamano_bytes: av.preparada.blob.size,
        capturada_at: av.hora?.capturada_at ?? null,
        capturada_origen: av.hora?.capturada_origen ?? "sin_dato",
      })
      .select()
      .single();
    // 23505 = ruta repetida: un intento anterior ya la registró.
    if (error && error.code !== "23505") throw error;

    actualizar(clave, { estado: "listo", mensaje: undefined });
    alSubir(data ?? null);
  }

  async function procesar(claves: string[]) {
    for (let i = 0; i < claves.length; i++) {
      setProgreso({ actual: i + 1, total: claves.length });
      try {
        await subirUna(claves[i]);
      } catch (e) {
        if (e instanceof ErrorFoto) {
          actualizar(claves[i], { estado: "error", mensaje: e.message, reintentable: false });
        } else {
          const err = e as { message?: string; statusCode?: string | number };
          actualizar(claves[i], { estado: "error", mensaje: mensajeErrorSubida(err), reintentable: true });
        }
      }
    }
    setProgreso(null);
  }

  function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    // Se limpia para poder volver a elegir las mismas fotos si hace falta.
    e.target.value = "";
    if (archivos.length === 0 || ocupado) return;

    const nuevos: ItemFoto[] = archivos.map((archivo) => {
      const clave = `foto-${++contador}`;
      avances.current.set(clave, { archivo, archivoSubido: false });
      return { clave, nombre: archivo.name || "Foto sin nombre", estado: "esperando" };
    });
    setItems((lista) => [...nuevos, ...lista]);
    procesar(nuevos.map((n) => n.clave));
  }

  const listos = items.filter((it) => it.estado === "listo").length;
  const fallidos = items.filter((it) => it.estado === "error").length;

  return (
    <div className="flex flex-col gap-3">
      <label
        className={`flex flex-col items-center justify-center gap-1 rounded-2xl border-4 border-dashed px-4 py-10 text-center ${
          ocupado
            ? "cursor-not-allowed border-borde bg-desactivado text-texto-desactivado"
            : "cursor-pointer border-marca bg-tarjeta text-texto active:bg-tarjeta-presionada"
        }`}
      >
        <span className="text-5xl" aria-hidden>
          🖼️
        </span>
        <span className="text-xl font-bold">{ocupado ? "Espera a que terminen…" : "Toca para elegir fotos"}</span>
        <span className="text-base text-texto-suave">Se abre tu galería. Puedes elegir varias.</span>
        {/* Sin "capture": no queremos abrir la cámara, solo la galería. */}
        <input type="file" accept="image/*" multiple disabled={ocupado} onChange={alElegir} className="sr-only" />
      </label>

      {progreso && (
        <p role="status" className="caja-info font-semibold text-texto">
          ⏳ Subiendo {progreso.actual} de {progreso.total}… No cierres esta pantalla.
        </p>
      )}

      {!progreso && items.length > 0 && (
        <p
          role="status"
          className={`flex items-start gap-2 font-semibold ${fallidos > 0 ? "caja-error" : "caja-exito"}`}
        >
          {fallidos > 0 && <IconoAlerta className="mt-0.5" />}
          {fallidos === 0
            ? `✅ Listo: ${listos} ${listos === 1 ? "foto subida" : "fotos subidas"}.`
            : `${listos} ${listos === 1 ? "foto subida" : "fotos subidas"}. ${fallidos} con error (revisa abajo).`}
        </p>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((it) => (
            <li
              key={it.clave}
              className={`rounded-xl border-2 p-3 ${
                it.estado === "error" ? "border-error-borde bg-error-fondo" : "border-borde bg-tarjeta"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-base text-texto-suave">{it.nombre}</span>
                <span
                  className={`flex shrink-0 items-center gap-1 text-base font-semibold ${
                    it.estado === "error" ? "text-error-texto" : "text-texto"
                  }`}
                >
                  {it.estado === "error" && <IconoAlerta className="h-5 w-5" />}
                  {TEXTO_ESTADO[it.estado]}
                </span>
              </div>
              {it.mensaje && <p className="mt-1 text-base text-error-texto">{it.mensaje}</p>}
              {it.estado === "error" && it.reintentable && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => procesar([it.clave])}
                  className="boton-gris mt-2 w-full rounded-xl px-4 py-3 text-lg font-semibold"
                >
                  Reintentar esta foto
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
