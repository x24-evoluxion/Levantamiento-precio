"use client";

// Lista de visitas de la pantalla principal, AGRUPADA POR DÍA (hora de México): "Hoy",
// "Ayer", "lunes 23 de noviembre"… Cada día dice cuántas visitas, fotos y artículos tiene,
// y cada visita, su tienda, su hora y sus fotos y artículos ("Sin fotos" / "Sin artículos"
// resaltado, para ver rápido qué visitas quedaron incompletas).
//
// Se lee desde el navegador al abrir la pantalla. Al volver de una visita, la lista se lee
// de nuevo (ReiniciarAlSalir en page.tsx; la app usa cacheComponents), así los conteos ya
// traen las fotos y los artículos que se acaban de subir o borrar.
//
// Quién ve qué lo decide la base (008, 012): cada persona solo sus visitas; el admin todas,
// con quién creó cada una, y también las BORRADAS (marcadas y atenuadas, sin sumar).
//
// Conteos: "fotos(count)" y "capturas_manuales(count)" le piden a Supabase el número de
// fotos y de artículos de cada visita en la misma consulta. Los filtros
// "fotos.descartada_at is null" y "capturas_manuales.descartada_at is null" solo cambian QUÉ
// SE CUENTA (no quitan visitas): una visita sin fotos ni artículos sale con 0.
// Si el conteo de artículos falla (por ejemplo, la tabla de la captura manual aún no existe
// en esa base), la lista se vuelve a pedir solo con fotos y se avisa.
//
// Carga por tramos de 14 días (la API corta cada respuesta en 1,000 filas): la lógica está
// en src/lib/listaVisitas.ts, con sus pruebas.
//
// FILTRO POR FECHA DE INGRESO (created_at): "Desde" y "Hasta" (<input type="date">) y
// atajos Hoy / Ayer / Últimos 7 días / Este mes. Consulta al SERVIDOR por ese rango (días
// completos de México convertidos a UTC), por páginas, y resume el periodo ("12 visitas ·
// 80 fotos · 130 artículos", sin lo descartado). El filtro vive en la URL
// (?desde=2026-11-20&hasta=2026-11-24): se conserva al abrir una visita y volver, y el
// enlace se puede compartir. Sin localStorage. Por cacheComponents, leer la URL
// (useSearchParams) exige un <Suspense> arriba (page.tsx). Cada persona de campo sigue
// viendo solo sus visitas: el filtro solo acota fechas; las reglas de la base no cambian.

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSesion } from "@/lib/sesion";
import { leerCorreos, textoCreador, type Correos } from "@/lib/correos";
import { formatearFecha } from "@/lib/fechas";
import type { Falla } from "@/lib/errores";
import {
  DIAS_POR_TRAMO,
  agruparPorDia,
  atajosFiltro,
  calcularTotales,
  cargarRango,
  cargarTramo,
  claveDia,
  consultaFiltro,
  textoPeriodo,
  validarFiltro,
  horaVisita,
  mensajeFallaCarga,
  primerTramo,
  textoArticulos,
  textoFotos,
  textoTotales,
  unirVisitas,
  type ApiLista,
  type ClaveDia,
  type FilaCruda,
  type FiltroFechas,
  type PeticionPagina,
  type Tramo,
  type VisitaLista,
} from "@/lib/listaVisitas";
import TituloError from "@/components/TituloError";
import BotonEntrarOtraVez from "@/components/BotonEntrarOtraVez";

/** Título de la sección: "Mis visitas" o, para el admin, "Todas las visitas". */
export function TituloVisitas() {
  const { usuario } = useSesion();
  return (
    <h2 className="text-xl font-semibold">{usuario.esAdmin ? "Todas las visitas" : "Mis visitas"}</h2>
  );
}

const COLUMNAS_CON_ARTICULOS =
  "id, created_at, usuario_id, descartada_at, competidores(nombre), fotos(count), capturas_manuales(count)";
const COLUMNAS_SIN_ARTICULOS = "id, created_at, usuario_id, descartada_at, competidores(nombre), fotos(count)";

/** Las consultas a Supabase que usa la lista (la lógica de tramos vive en listaVisitas.ts). */
const api: ApiLista = {
  async leerPagina(p) {
    let consulta = supabase
      .from("visitas")
      .select(p.conArticulos ? COLUMNAS_CON_ARTICULOS : COLUMNAS_SIN_ARTICULOS)
      .is("fotos.descartada_at", null);
    if (p.conArticulos) consulta = consulta.is("capturas_manuales.descartada_at", null);
    consulta = consulta.gte("created_at", p.desde);
    if (p.antesDe) consulta = consulta.lt("created_at", p.antesDe);
    if (p.despuesDe) {
      // Fecha entre comillas: trae ":" y "." (caracteres especiales del filtro "or").
      const f = `"${p.despuesDe.created_at}"`;
      consulta = consulta.or(`created_at.lt.${f},and(created_at.eq.${f},id.lt.${p.despuesDe.id})`);
    }
    const { data, error, status } = await consulta
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(p.limite);
    return { data: data as unknown as FilaCruda[] | null, error, status };
  },
  async leerMasReciente(antesDe) {
    const { data, error, status } = await supabase
      .from("visitas")
      .select("created_at")
      .lt("created_at", antesDe)
      .order("created_at", { ascending: false })
      .limit(1);
    return { data, error, status };
  },
};

type Estado =
  | { tipo: "cargando" }
  | { tipo: "error"; falla: Falla }
  | {
      tipo: "ok";
      hoy: ClaveDia;
      visitas: VisitaLista[];
      correos: Correos;
      conArticulos: boolean;
      /** Por qué no se contaron los artículos (si pasó en algún tramo). */
      fallaArticulos: Falla | null;
      /** Sin filtro: el siguiente tramo de días ("Ver días anteriores"). */
      siguiente: Tramo | null;
      /** Con filtro: dónde seguir si quedan visitas del periodo por cargar. */
      pendiente: PeticionPagina["despuesDe"];
      cargandoMas: boolean;
      fallaMas: Falla | null;
    };

export default function ListaVisitas() {
  const { usuario } = useSesion();
  const esAdmin = usuario.esAdmin;
  const router = useRouter();
  const ruta = usePathname();
  const parametros = useSearchParams();
  const hoyAhora = claveDia(new Date());
  const desdeUrl = parametros.get("desde");
  const hastaUrl = parametros.get("hasta");
  const leido = validarFiltro(desdeUrl, hastaUrl, hoyAhora);
  const filtro: FiltroFechas | null = leido.tipo === "ok" ? leido.filtro : null;
  /** Cambia solo si cambia el filtro válido (así el efecto no se repite de más). */
  const claveFiltro = filtro ? `${filtro.desde}|${filtro.hasta}` : "";
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [intento, setIntento] = useState(0);
  // Para no escribir en una lista que ya se cerró (por ejemplo, al salir a una visita).
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      const hoy = claveDia(new Date());
      const [desde, hasta] = claveFiltro ? claveFiltro.split("|") : [];
      // Con filtro: el rango pedido al servidor. Sin filtro: los últimos 14 días.
      const r = desde
        ? await cargarRango(api, { desde, hasta }, true)
        : await cargarTramo(api, primerTramo(hoy), true);
      // Solo el admin pide los correos (a cualquier otra cuenta la base se los niega).
      const correos = r.tipo === "ok" && esAdmin ? await leerCorreos() : null;
      if (cancelado) return;
      if (r.tipo === "falla") {
        setEstado({ tipo: "error", falla: r.falla });
        return;
      }
      setEstado({
        tipo: "ok",
        hoy,
        visitas: r.visitas,
        correos,
        conArticulos: r.conArticulos,
        fallaArticulos: r.fallaArticulos,
        siguiente: "siguiente" in r ? r.siguiente : null,
        pendiente: "pendiente" in r ? r.pendiente : null,
        cargandoMas: false,
        fallaMas: null,
      });
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [intento, esAdmin, claveFiltro]);

  /** Aplica (o quita) el filtro: va a la URL; la lista se vuelve a pedir al servidor. */
  function aplicarFiltro(f: FiltroFechas | null) {
    setEstado({ tipo: "cargando" });
    // Mismo filtro (por ejemplo, volver a tocar "Hoy"): la URL no cambia, así que se
    // vuelve a pedir a mano (también sirve para ver lo más nuevo).
    if ((f ? `${f.desde}|${f.hasta}` : "") === claveFiltro) setIntento((n) => n + 1);
    router.replace(`${ruta}${consultaFiltro(f)}`, { scroll: false });
  }

  function reintentar() {
    setEstado({ tipo: "cargando" });
    setIntento((n) => n + 1);
  }

  /** Con filtro: trae las visitas del periodo que faltaron (sigue donde se quedó). */
  async function cargarMasDelPeriodo() {
    if (estado.tipo !== "ok" || !filtro || !estado.pendiente || estado.cargandoMas) return;
    const { pendiente, conArticulos } = estado;
    setEstado({ ...estado, cargandoMas: true, fallaMas: null });
    const r = await cargarRango(api, filtro, conArticulos, pendiente);
    if (!vivo.current) return;
    setEstado((antes) => {
      if (antes.tipo !== "ok") return antes;
      if (r.tipo === "falla") return { ...antes, cargandoMas: false, fallaMas: r.falla };
      return {
        ...antes,
        visitas: unirVisitas(antes.visitas, r.visitas),
        conArticulos: r.conArticulos,
        fallaArticulos: antes.fallaArticulos ?? r.fallaArticulos,
        pendiente: r.pendiente,
        cargandoMas: false,
        fallaMas: null,
      };
    });
  }

  async function verDiasAnteriores() {
    if (estado.tipo !== "ok" || !estado.siguiente || estado.cargandoMas) return;
    const { siguiente, conArticulos } = estado;
    setEstado({ ...estado, cargandoMas: true, fallaMas: null });
    const r = await cargarTramo(api, siguiente, conArticulos);
    if (!vivo.current) return;
    setEstado((antes) => {
      if (antes.tipo !== "ok") return antes;
      if (r.tipo === "falla") return { ...antes, cargandoMas: false, fallaMas: r.falla };
      return {
        ...antes,
        visitas: unirVisitas(antes.visitas, r.visitas),
        conArticulos: r.conArticulos,
        fallaArticulos: antes.fallaArticulos ?? r.fallaArticulos,
        siguiente: r.siguiente,
        cargandoMas: false,
        fallaMas: null,
      };
    });
  }

  const panel = (
    <PanelFiltro
      // Al cambiar la URL, los campos vuelven a mostrar lo que dice la URL.
      key={`${desdeUrl ?? ""}|${hastaUrl ?? ""}`}
      hoy={hoyAhora}
      desdeInicial={desdeUrl ?? ""}
      hastaInicial={hastaUrl ?? ""}
      aplicado={filtro}
      errorUrl={leido.tipo === "error" ? leido.mensaje : null}
      alAplicar={aplicarFiltro}
    />
  );

  if (estado.tipo === "cargando") {
    return (
      <div className="flex flex-col gap-4">
        {panel}
        <p className="caja-info">{filtro ? "Buscando visitas en esas fechas…" : "Cargando visitas…"}</p>
      </div>
    );
  }

  if (estado.tipo === "error") {
    return (
      <div className="flex flex-col gap-4">
        {panel}
        <div className="caja-error">
          <TituloError>No se pudieron cargar las visitas</TituloError>
          <p className="mt-1 text-base break-words">{mensajeFallaCarga(estado.falla)}</p>
          {estado.falla.tipo === "sesion" && <BotonEntrarOtraVez />}
          <button
            type="button"
            onClick={reintentar}
            className="boton-gris mt-3 min-h-12 w-full rounded-xl px-4 py-3 text-lg font-semibold"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const grupos = agruparPorDia(estado.visitas, estado.hoy);
  const enlaceExtra = consultaFiltro(filtro);

  if (!filtro && grupos.length === 0 && !estado.siguiente) {
    return (
      <div className="flex flex-col gap-4">
        {panel}
        <p className="caja-info">
          {esAdmin
            ? "Todavía no hay visitas."
            : "Todavía no tienes visitas. Toca “Nueva visita” para registrar la primera."}
        </p>
      </div>
    );
  }

  const totalesPeriodo = filtro ? calcularTotales(estado.visitas) : null;

  return (
    <div className="flex flex-col gap-6">
      {panel}

      {filtro && totalesPeriodo && (
        <div role="status" className="rounded-xl border-2 border-texto bg-fondo px-4 py-3">
          <p className="text-base text-texto-suave">{textoPeriodo(filtro)}</p>
          {estado.visitas.length === 0 ? (
            <p className="text-lg font-bold">No hay visitas en esas fechas.</p>
          ) : (
            <p className="text-lg font-bold">
              {textoTotales(totalesPeriodo)}
              {totalesPeriodo.borradas > 0 &&
                ` · ${totalesPeriodo.borradas} ${totalesPeriodo.borradas === 1 ? "borrada" : "borradas"}`}
            </p>
          )}
          {estado.pendiente && (
            <p className="mt-1 text-base font-semibold text-aviso-texto">
              Faltan visitas de este periodo por cargar: el resumen cuenta solo las cargadas.
            </p>
          )}
        </div>
      )}

      {estado.fallaArticulos && (
        <p className="caja-aviso text-base">
          No se pudieron contar los artículos; se muestran solo las fotos. Si sigue pasando, avisa
          al responsable con el código {estado.fallaArticulos.codigo}.
        </p>
      )}

      {!filtro && grupos.length === 0 && (
        <p className="caja-info">No hay visitas en los últimos {DIAS_POR_TRAMO} días.</p>
      )}

      {grupos.map((g) => (
        <section key={g.clave} aria-labelledby={`dia-${g.clave}`} className="flex flex-col gap-2">
          {/* Encabezado del día: se queda arriba al bajar por la lista. */}
          <header className="sticky top-0 z-10 -mx-4 border-b-2 border-texto bg-fondo px-4 pt-2 pb-1.5">
            <h3 id={`dia-${g.clave}`} className="text-xl leading-tight font-bold">
              {g.titulo}
            </h3>
            <p className="text-base font-semibold text-texto-suave">
              {textoTotales(g.totales)}
              {g.totales.borradas > 0 &&
                ` · ${g.totales.borradas} ${g.totales.borradas === 1 ? "borrada" : "borradas"}`}
            </p>
          </header>

          <ul className="flex flex-col gap-2">
            {g.visitas.map((v) => (
              <li key={v.id}>
                <TarjetaVisita visita={v} correos={estado.correos} enlaceExtra={enlaceExtra} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {estado.fallaMas && (
        <div className="caja-error">
          <TituloError>
            {filtro ? "No se pudieron cargar más visitas del periodo" : "No se pudieron cargar los días anteriores"}
          </TituloError>
          <p className="mt-1 text-base break-words">{mensajeFallaCarga(estado.fallaMas)}</p>
          {estado.fallaMas.tipo === "sesion" && <BotonEntrarOtraVez />}
        </div>
      )}

      {/* Con el filtro activo, "Ver días anteriores" no aplica: en su lugar, si el periodo
          trae más visitas de las que se piden de una vez, "Cargar más visitas del periodo". */}
      {filtro ? (
        estado.pendiente && (
          <button
            type="button"
            onClick={cargarMasDelPeriodo}
            disabled={estado.cargandoMas}
            className="boton-gris min-h-12 w-full rounded-xl px-4 py-3 text-lg font-semibold"
          >
            {estado.cargandoMas
              ? "Cargando más visitas…"
              : estado.fallaMas
                ? "Reintentar: cargar más visitas del periodo"
                : "Cargar más visitas del periodo"}
          </button>
        )
      ) : estado.siguiente ? (
        <button
          type="button"
          onClick={verDiasAnteriores}
          disabled={estado.cargandoMas}
          className="boton-gris min-h-12 w-full rounded-xl px-4 py-3 text-lg font-semibold"
        >
          {estado.cargandoMas
            ? "Cargando días anteriores…"
            : estado.fallaMas
              ? "Reintentar: ver días anteriores"
              : "Ver días anteriores"}
        </button>
      ) : (
        <p className="py-2 text-center text-base text-texto-suave">No hay más visitas</p>
      )}
    </div>
  );
}

/**
 * Filtro por fecha de ingreso: "Desde" y "Hasta" (en el celular abre el selector nativo; en
 * la compu se teclean los números), atajos de un toque y "Limpiar filtro". Valida antes de
 * consultar: si algo está mal, avisa y NO cambia la URL (no se manda la consulta).
 */
function PanelFiltro({
  hoy,
  desdeInicial,
  hastaInicial,
  aplicado,
  errorUrl,
  alAplicar,
}: {
  hoy: ClaveDia;
  desdeInicial: string;
  hastaInicial: string;
  aplicado: FiltroFechas | null;
  /** El enlace trae fechas que no se pueden usar (se muestra la lista normal). */
  errorUrl: string | null;
  alAplicar: (f: FiltroFechas | null) => void;
}) {
  const [desde, setDesde] = useState(desdeInicial);
  const [hasta, setHasta] = useState(hastaInicial);
  const [error, setError] = useState<string | null>(errorUrl);

  function ver() {
    const r = validarFiltro(desde, hasta, hoy);
    if (r.tipo === "error") {
      setError(r.mensaje);
      return;
    }
    if (r.tipo === "sin-filtro") {
      setError("Elige las dos fechas: “Desde” y “Hasta”.");
      return;
    }
    setError(null);
    alAplicar(r.filtro);
  }

  const claseFecha =
    "min-h-12 w-full rounded-xl border-2 border-borde bg-fondo px-3 py-2 text-lg text-texto outline-offset-2 focus-visible:outline-3 focus-visible:outline-marca";

  return (
    <section
      aria-labelledby="titulo-filtro"
      className="flex flex-col gap-3 rounded-xl border-2 border-borde bg-tarjeta p-3"
    >
      <h3 id="titulo-filtro" className="text-lg font-semibold">
        Filtrar por fecha de ingreso
      </h3>

      <div className="grid grid-cols-2 gap-2">
        {atajosFiltro(hoy).map((a) => {
          const activo = aplicado?.desde === a.filtro.desde && aplicado?.hasta === a.filtro.hasta;
          return (
            <button
              key={a.etiqueta}
              type="button"
              aria-pressed={activo}
              onClick={() => {
                setError(null);
                alAplicar(a.filtro);
              }}
              className={`min-h-12 rounded-xl border-2 px-3 py-2 text-lg font-semibold ${
                activo
                  ? "border-marca bg-marca text-sobre-marca"
                  : "border-borde bg-fondo text-texto active:bg-tarjeta-presionada"
              }`}
            >
              {a.etiqueta}
            </button>
          );
        })}
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          ver();
        }}
        className="flex flex-col gap-3"
      >
        <div className="grid grid-cols-2 gap-2">
          <label className="flex min-w-0 flex-col gap-1 text-base font-semibold">
            Desde
            <input
              type="date"
              value={desde}
              max={hoy}
              onChange={(e) => {
                setDesde(e.target.value);
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "error-filtro" : undefined}
              className={claseFecha}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-base font-semibold">
            Hasta
            <input
              type="date"
              value={hasta}
              max={hoy}
              onChange={(e) => {
                setHasta(e.target.value);
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "error-filtro" : undefined}
              className={claseFecha}
            />
          </label>
        </div>

        {error && (
          <p id="error-filtro" role="alert" className="text-base font-semibold text-error-texto">
            {error}
          </p>
        )}

        <div className={`grid gap-2 ${aplicado || errorUrl ? "grid-cols-2" : "grid-cols-1"}`}>
          <button type="submit" className="boton-primario min-h-12 rounded-xl px-3 py-2 text-lg font-bold">
            Ver esas fechas
          </button>
          {(aplicado || errorUrl) && (
            <button
              type="button"
              onClick={() => {
                setDesde("");
                setHasta("");
                setError(null);
                alAplicar(null);
              }}
              className="boton-gris min-h-12 rounded-xl px-3 py-2 text-lg font-semibold"
            >
              Limpiar filtro
            </button>
          )}
        </div>
      </form>
    </section>
  );
}


/** Una visita: tienda, hora, fotos y artículos (y, para el admin, quién la creó). Toda la tarjeta abre la visita. */
function TarjetaVisita({
  visita: v,
  correos,
  enlaceExtra,
}: {
  visita: VisitaLista;
  correos: Correos;
  /** "?desde=…&hasta=…": la visita lo pasa a "Volver a la lista" (se conserva el filtro). */
  enlaceExtra: string;
}) {
  const { usuario } = useSesion();
  const esAdmin = usuario.esAdmin;
  const borrada = Boolean(v.descartada_at);
  return (
    <Link
      href={`/visitas/${v.id}${enlaceExtra}`}
      className={`flex min-h-11 flex-col gap-1 rounded-xl border-2 px-4 py-3 text-texto active:bg-tarjeta-presionada ${
        borrada ? "border-dashed border-aviso-borde bg-aviso-fondo opacity-75" : "border-borde bg-tarjeta"
      }`}
    >
      {borrada && (
        <p className="text-base font-bold text-aviso-texto">
          Borrada {formatearFecha(v.descartada_at)} · toca para restaurar
        </p>
      )}
      <div className="flex items-baseline justify-between gap-3">
        <p className={`min-w-0 text-lg font-semibold break-words ${borrada ? "line-through" : ""}`}>
          {v.tienda ?? "Competidor desconocido"}
        </p>
        <p className="shrink-0 text-base font-semibold text-texto-suave">{horaVisita(v.created_at)}</p>
      </div>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-base">
        <Conteo n={v.fotos} conDatos={`📷 ${textoFotos(v.fotos)}`} sinDatos="Sin fotos" />
        {v.articulos !== null && (
          <Conteo n={v.articulos} conDatos={`📝 ${textoArticulos(v.articulos)}`} sinDatos="Sin artículos" />
        )}
      </p>
      {esAdmin && (
        <p className="text-base break-words text-texto-suave">👤 {textoCreador(v.usuario_id, correos, usuario)}</p>
      )}
    </Link>
  );
}

/** "📷 3 fotos", o "Sin fotos" resaltado en amarillo (visita incompleta). */
function Conteo({ n, conDatos, sinDatos }: { n: number; conDatos: string; sinDatos: string }) {
  if (n > 0) return <span className="font-semibold">{conDatos}</span>;
  return (
    <span className="rounded-md border border-aviso-borde bg-aviso-fondo px-1.5 font-semibold text-aviso-texto">
      {sinDatos}
    </span>
  );
}
