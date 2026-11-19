"use client";

// Paso 2 de "Nueva visita": botón "Guardar mi ubicación".
// Pide la ubicación al celular y se la pasa al formulario con onUbicacion.
// Si falla, explica cómo activarla en iPhone y Android y deja reintentar.

import { useState } from "react";
import {
  enlaceMapa,
  formatearPrecision,
  pedirUbicacion,
  PRECISION_DUDOSA_METROS,
  type MotivoFallo,
  type Ubicacion,
} from "@/lib/ubicacion";
import TituloError from "@/components/TituloError";

type Props = {
  ubicacion: Ubicacion | null;
  onUbicacion: (u: Ubicacion) => void;
  desactivado?: boolean;
};

export default function BotonUbicacion({ ubicacion, onUbicacion, desactivado }: Props) {
  const [buscando, setBuscando] = useState(false);
  const [fallo, setFallo] = useState<MotivoFallo | null>(null);

  async function buscar() {
    if (buscando) return;
    setBuscando(true);
    setFallo(null);
    const r = await pedirUbicacion();
    setBuscando(false);
    if (r.ok) {
      onUbicacion(r.ubicacion);
    } else {
      setFallo(r.motivo);
    }
  }

  let textoBoton = "📍 Guardar mi ubicación";
  if (buscando) textoBoton = "Buscando tu ubicación…";
  else if (fallo) textoBoton = "Volver a intentar";
  else if (ubicacion) textoBoton = "Actualizar ubicación";

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">2. ¿Dónde estás?</h2>

      {ubicacion && (
        <div className="caja-exito">
          <p className="font-semibold">✅ Ubicación guardada ({formatearPrecision(ubicacion.precision_metros)})</p>
          <a
            href={enlaceMapa(ubicacion.latitud, ubicacion.longitud)}
            target="_blank"
            rel="noopener noreferrer"
            className="enlace mt-1 inline-block"
          >
            Ver en el mapa
          </a>
          {ubicacion.precision_metros > PRECISION_DUDOSA_METROS && (
            <p className="mt-2 text-base text-aviso-texto">
              ⚠️ La ubicación es poco exacta. Si estás dentro de la tienda, acércate a la
              entrada o a una ventana y toca &quot;Actualizar ubicación&quot;.
            </p>
          )}
        </div>
      )}

      {buscando && (
        <p className="caja-info">
          Buscando tu ubicación… Puede tardar unos segundos. Si el celular te pregunta,
          toca <strong>Permitir</strong>.
        </p>
      )}

      {fallo && <MensajeFallo motivo={fallo} />}

      <button
        type="button"
        onClick={buscar}
        disabled={buscando || desactivado}
        className={`rounded-xl px-4 py-4 text-xl font-semibold ${
          ubicacion && !fallo
            ? "boton-contorno"
            : "boton-primario"
        }`}
      >
        {textoBoton}
      </button>
    </section>
  );
}

function MensajeFallo({ motivo }: { motivo: MotivoFallo }) {
  if (motivo === "sin-https") {
    return (
      <div className="caja-error">
        <TituloError>No se puede pedir la ubicación en esta dirección</TituloError>
        <p className="mt-1 text-base">
          La ubicación solo funciona si la dirección empieza con <strong>https://</strong>.
          Abre la app con el link oficial.
        </p>
      </div>
    );
  }

  if (motivo === "no-soportado") {
    return (
      <div className="caja-error">
        <TituloError>Este navegador no puede dar la ubicación</TituloError>
        <p className="mt-1 text-base">Abre el link en Safari (iPhone) o en Chrome (Android).</p>
      </div>
    );
  }

  const titulo =
    motivo === "sin-permiso"
      ? "No diste permiso para usar tu ubicación"
      : motivo === "tardo-mucho"
        ? "El GPS tardó demasiado"
        : "No se pudo encontrar tu ubicación";

  return (
    <div className="caja-error">
      <TituloError>{titulo}</TituloError>
      {motivo !== "sin-permiso" && (
        <p className="mt-1 text-base">
          Revisa que la ubicación del celular esté encendida. Si estás dentro de la tienda,
          acércate a la entrada o a una ventana.
        </p>
      )}

      <details className="mt-3 text-base" open={motivo === "sin-permiso"}>
        <summary className="cursor-pointer font-semibold">Cómo activar la ubicación en iPhone</summary>
        <ol className="mt-2 ml-5 list-decimal flex flex-col gap-1">
          <li>
            Abre <strong>Ajustes → Privacidad y seguridad → Localización</strong> y enciéndela.
          </li>
          <li>
            En esa misma lista, entra a <strong>Sitios web de Safari</strong> (o{" "}
            <strong>Chrome</strong>, si usas Chrome) y elige <strong>Al usar la app</strong>.
          </li>
          <li>
            En Safari, toca <strong>aA</strong> (o el ícono junto a la dirección) →{" "}
            <strong>Configuración del sitio web → Ubicación → Permitir</strong>.
          </li>
          <li>Regresa aquí y toca &quot;Volver a intentar&quot;.</li>
        </ol>
      </details>

      <details className="mt-3 text-base" open={motivo === "sin-permiso"}>
        <summary className="cursor-pointer font-semibold">Cómo activar la ubicación en Android</summary>
        <ol className="mt-2 ml-5 list-decimal flex flex-col gap-1">
          <li>
            Desliza desde arriba de la pantalla y enciende <strong>Ubicación</strong>.
          </li>
          <li>
            En Chrome, toca el ícono a la izquierda de la dirección →{" "}
            <strong>Permisos → Ubicación → Permitir</strong>.
          </li>
          <li>
            Si no aparece, ve a <strong>Ajustes → Apps → Chrome → Permisos → Ubicación</strong> y
            elige <strong>Permitir solo mientras se usa la app</strong>.
          </li>
          <li>Regresa aquí y toca &quot;Volver a intentar&quot;.</li>
        </ol>
      </details>
    </div>
  );
}
