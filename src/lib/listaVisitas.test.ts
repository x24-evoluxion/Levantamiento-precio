// Pruebas de la lógica de la lista de visitas (src/lib/listaVisitas.ts).
// Datos INVENTADOS. No usa Supabase: una "base" en memoria imita los filtros, el orden y
// el corte de filas de la API. Correr: npm run test:lista
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DIAS_POR_TRAMO,
  FILAS_POR_PAGINA,
  agruparPorDia,
  cargarTramo,
  claveDia,
  compararVisitas,
  inicioDelDia,
  normalizarFila,
  primerTramo,
  sumarDias,
  textoArticulos,
  textoFotos,
  textoTotales,
  textoVisitas,
  tituloDia,
  unirVisitas,
  horaVisita,
  type ApiLista,
  type FilaCruda,
  type PeticionPagina,
  type Tramo,
  type VisitaLista,
} from "./listaVisitas.ts";
import type { Falla } from "./errores.ts";

const HOY = "2026-11-25"; // miércoles

function visita(id: string, created_at: string, cambios: Partial<VisitaLista> = {}): VisitaLista {
  return {
    id,
    created_at,
    usuario_id: "u1",
    descartada_at: null,
    tienda: "Tienda A",
    fotos: 0,
    articulos: 0,
    ...cambios,
  };
}

// --- Días en hora de México -------------------------------------------------------

test("23:30 de México sigue siendo ese día (en UTC ya es el siguiente)", () => {
  // 23:30 del 23 en México = 05:30 del 24 en UTC.
  assert.equal(claveDia("2026-11-24T05:30:00+00:00"), "2026-11-23");
});

test("00:30 de México ya es el día siguiente (en UTC todavía es 06:30 del mismo)", () => {
  assert.equal(claveDia("2026-11-24T06:30:00+00:00"), "2026-11-24");
});

test("una visita de las 8 pm no cae en el día siguiente", () => {
  assert.equal(claveDia("2026-11-24T02:00:00Z"), "2026-11-23");
  assert.equal(horaVisita("2026-11-24T02:00:00Z"), "8:00 p.m.");
});

test("medianoche de México en UTC (sin horario de verano: UTC−6)", () => {
  assert.equal(inicioDelDia("2026-11-23"), "2026-11-23T06:00:00.000Z");
  assert.equal(inicioDelDia("2026-07-01"), "2026-07-01T06:00:00.000Z");
  assert.equal(claveDia(inicioDelDia("2026-11-23")), "2026-11-23");
  assert.equal(claveDia(new Date(new Date(inicioDelDia("2026-11-23")).getTime() - 1)), "2026-11-22");
});

test("sumarDias cruza meses y años", () => {
  assert.equal(sumarDias("2026-12-31", 1), "2027-01-01");
  assert.equal(sumarDias("2026-03-01", -1), "2026-02-28");
  assert.equal(sumarDias("2026-11-25", -13), "2026-11-12");
});

test('títulos: "Hoy", "Ayer", fecha completa en español y año si no es el actual', () => {
  assert.equal(tituloDia(HOY, HOY), "Hoy");
  assert.equal(tituloDia("2026-11-24", HOY), "Ayer");
  assert.equal(tituloDia("2026-11-23", HOY), "lunes 23 de noviembre");
  assert.equal(tituloDia("2025-12-31", HOY), "miércoles 31 de diciembre de 2025");
  assert.equal(tituloDia("2026-01-01", "2026-01-02"), "Ayer");
  assert.equal(tituloDia("2025-12-31", "2026-01-01"), "Ayer");
});

// --- Singular y plural ---------------------------------------------------------------

test("singular y plural", () => {
  assert.equal(textoVisitas(1), "1 visita");
  assert.equal(textoVisitas(3), "3 visitas");
  assert.equal(textoFotos(1), "1 foto");
  assert.equal(textoFotos(0), "0 fotos");
  assert.equal(textoArticulos(1), "1 artículo");
  assert.equal(textoArticulos(41), "41 artículos");
  assert.equal(
    textoTotales({ visitas: 1, fotos: 1, articulos: 1, borradas: 0 }),
    "1 visita · 1 foto · 1 artículo",
  );
  assert.equal(
    textoTotales({ visitas: 3, fotos: 24, articulos: 41, borradas: 0 }),
    "3 visitas · 24 fotos · 41 artículos",
  );
});

// --- Agrupar y totales ---------------------------------------------------------------

test("agrupa por día de México (23:30 y 00:30), días y visitas de la más reciente a la más antigua", () => {
  const grupos = agruparPorDia(
    [
      visita("a", "2026-11-24T05:30:00Z", { fotos: 2, articulos: 3 }), // 23 nov 23:30
      visita("b", "2026-11-24T06:30:00Z", { fotos: 1, articulos: 0 }), // 24 nov 00:30
      visita("c", "2026-11-25T18:00:00Z", { fotos: 5, articulos: 10 }), // 25 nov 12:00
      visita("d", "2026-11-24T20:00:00Z", { fotos: 4, articulos: 1 }), // 24 nov 14:00
      visita("e", "2026-11-23T15:00:00Z"), // 23 nov 09:00
    ],
    HOY,
  );
  assert.deepEqual(
    grupos.map((g) => [g.titulo, g.visitas.map((v) => v.id)]),
    [
      ["Hoy", ["c"]],
      ["Ayer", ["d", "b"]],
      ["lunes 23 de noviembre", ["a", "e"]],
    ],
  );
  assert.deepEqual(grupos[1].totales, { visitas: 2, fotos: 5, articulos: 1, borradas: 0 });
  assert.equal(textoTotales(grupos[2].totales), "2 visitas · 2 fotos · 3 artículos");
});

test("las visitas borradas se muestran pero no suman a los totales del día", () => {
  const [dia] = agruparPorDia(
    [
      visita("a", "2026-11-25T18:00:00Z", { fotos: 3, articulos: 2 }),
      visita("b", "2026-11-25T17:00:00Z", { fotos: 7, articulos: 9, descartada_at: "2026-11-25T19:00:00Z" }),
    ],
    HOY,
  );
  assert.equal(dia.visitas.length, 2);
  assert.deepEqual(dia.totales, { visitas: 1, fotos: 3, articulos: 2, borradas: 1 });
});

test("un día con solo visitas borradas: 0 visitas a la vista", () => {
  const [dia] = agruparPorDia(
    [visita("b", "2026-11-25T17:00:00Z", { fotos: 7, descartada_at: "2026-11-25T19:00:00Z" })],
    HOY,
  );
  assert.equal(textoTotales(dia.totales), "0 visitas · 0 fotos · 0 artículos");
  assert.equal(dia.totales.borradas, 1);
});

test("visitas con 0 fotos y 0 artículos cuentan como visitas con 0", () => {
  const [dia] = agruparPorDia([visita("a", "2026-11-25T18:00:00Z"), visita("b", "2026-11-25T17:00:00Z")], HOY);
  assert.equal(textoTotales(dia.totales), "2 visitas · 0 fotos · 0 artículos");
});

test("si los artículos no se contaron, el total del día no los menciona", () => {
  const [dia] = agruparPorDia([visita("a", "2026-11-25T18:00:00Z", { fotos: 2, articulos: null })], HOY);
  assert.equal(dia.totales.articulos, null);
  assert.equal(textoTotales(dia.totales), "1 visita · 2 fotos");
});

// --- Conteos que llegan de Supabase --------------------------------------------------

test("normalizarFila: conteos anidados, 0 si no hay, null si no se pidieron artículos", () => {
  const fila: FilaCruda = {
    id: "a",
    created_at: "2026-11-25T18:00:00Z",
    usuario_id: null,
    descartada_at: null,
    competidores: { nombre: "Neto" },
    fotos: [{ count: 4 }],
    capturas_manuales: [{ count: 0 }],
  };
  assert.deepEqual(normalizarFila(fila, true), {
    id: "a",
    created_at: "2026-11-25T18:00:00Z",
    usuario_id: null,
    descartada_at: null,
    tienda: "Neto",
    fotos: 4,
    articulos: 0,
  });
  assert.equal(normalizarFila({ ...fila, fotos: [] }, true).fotos, 0);
  assert.equal(normalizarFila({ ...fila, fotos: undefined }, false).articulos, null);
});

// --- Base inventada para probar la carga por tramos ----------------------------------

type FotoFalsa = { descartada: boolean };
type FilaFalsa = { id: string; created_at: string; descartada_at: string | null; fotos: FotoFalsa[]; articulos: FotoFalsa[] };

/**
 * Imita a PostgREST: filtra por fechas y por "después de", ordena created_at desc, id desc,
 * corta en min(limite, corteServidor) y cuenta SOLO las filas anidadas no descartadas
 * (el filtro anidado no quita visitas). Si `sinTablaArticulos`, pedir artículos falla.
 */
function baseFalsa(
  filas: FilaFalsa[],
  opciones: { corteServidor?: number; sinTablaArticulos?: boolean; antesDeCadaPagina?: (n: number) => void } = {},
) {
  const corte = opciones.corteServidor ?? 1000;
  const peticiones: PeticionPagina[] = [];
  const t = (iso: string) => new Date(iso).getTime();
  const api: ApiLista = {
    async leerPagina(p) {
      opciones.antesDeCadaPagina?.(peticiones.length);
      peticiones.push(p);
      if (p.conArticulos && opciones.sinTablaArticulos) {
        return { data: null, error: { code: "PGRST200", message: "Could not find a relationship" }, status: 400 };
      }
      const resultado = filas
        .filter((f) => t(f.created_at) >= t(p.desde))
        .filter((f) => p.antesDe === null || t(f.created_at) < t(p.antesDe))
        .filter(
          (f) =>
            p.despuesDe === null ||
            t(f.created_at) < t(p.despuesDe.created_at) ||
            (t(f.created_at) === t(p.despuesDe.created_at) && f.id < p.despuesDe.id),
        )
        .sort(compararVisitas)
        .slice(0, Math.min(p.limite, corte))
        .map(
          (f): FilaCruda => ({
            id: f.id,
            created_at: f.created_at,
            usuario_id: "u1",
            descartada_at: f.descartada_at,
            competidores: { nombre: "Tienda" },
            fotos: [{ count: f.fotos.filter((x) => !x.descartada).length }],
            ...(p.conArticulos ? { capturas_manuales: [{ count: f.articulos.filter((x) => !x.descartada).length }] } : {}),
          }),
        );
      return { data: resultado, error: null, status: 200 };
    },
    async leerMasReciente(antesDe) {
      const mas = filas.filter((f) => t(f.created_at) < t(antesDe)).sort(compararVisitas)[0];
      return { data: mas ? [{ created_at: mas.created_at }] : [], error: null, status: 200 };
    },
  };
  return { api, peticiones };
}

function fila(id: string, created_at: string, fotos = 0, articulos = 0): FilaFalsa {
  return {
    id,
    created_at,
    descartada_at: null,
    fotos: Array.from({ length: fotos }, () => ({ descartada: false })),
    articulos: Array.from({ length: articulos }, () => ({ descartada: false })),
  };
}

/** Carga todos los tramos (como si se tocara "Ver días anteriores" hasta el final). */
async function cargarTodo(api: ApiLista, hoy = HOY) {
  let tramo: Tramo | null = primerTramo(hoy);
  let conArticulos = true;
  let visitas: VisitaLista[] = [];
  const tramos: VisitaLista[][] = [];
  while (tramo) {
    const r = await cargarTramo(api, tramo, conArticulos);
    assert.equal(r.tipo, "ok");
    if (r.tipo !== "ok") break;
    tramos.push(r.visitas);
    visitas = unirVisitas(visitas, r.visitas);
    conArticulos = r.conArticulos;
    tramo = r.siguiente;
  }
  return { visitas, tramos };
}

test("los conteos no suman fotos ni artículos descartados, y las visitas sin nada salen con 0", async () => {
  const f = fila("a", "2026-11-25T18:00:00Z", 3, 2);
  f.fotos.push({ descartada: true });
  f.articulos.push({ descartada: true }, { descartada: true });
  const { api } = baseFalsa([f, fila("b", "2026-11-25T17:00:00Z")]);
  const r = await cargarTramo(api, primerTramo(HOY), true);
  assert.equal(r.tipo, "ok");
  if (r.tipo !== "ok") return;
  assert.deepEqual(
    r.visitas.map((v) => [v.id, v.fotos, v.articulos]),
    [
      ["a", 3, 2],
      ["b", 0, 0],
    ],
  );
  assert.equal(r.siguiente, null);
});

test("tramos de 14 días pegados: sin repetir ni saltar, y un día nunca queda partido", async () => {
  // Una visita cada 7 horas durante ~60 días, incluyendo horas cerca de la medianoche.
  const filas: FilaFalsa[] = [];
  const fin = new Date("2026-11-25T20:00:00Z").getTime();
  for (let i = 0; i < 210; i++) filas.push(fila(`v${String(i).padStart(3, "0")}`, new Date(fin - i * 7 * 3600000).toISOString()));
  const { api } = baseFalsa(filas);
  const { visitas, tramos } = await cargarTodo(api);

  assert.equal(visitas.length, filas.length);
  assert.equal(tramos.flat().length, filas.length, "ninguna visita se repite entre tramos");
  assert.deepEqual(new Set(visitas.map((v) => v.id)), new Set(filas.map((f) => f.id)));
  // Cada día aparece en un solo tramo.
  const diaEnTramo = new Map<string, number>();
  tramos.forEach((lista, n) =>
    lista.forEach((v) => {
      const d = claveDia(v.created_at);
      assert.ok(!diaEnTramo.has(d) || diaEnTramo.get(d) === n, `el día ${d} quedó partido`);
      diaEnTramo.set(d, n);
    }),
  );
  // El primer tramo cubre exactamente hoy y los 13 días anteriores.
  const diasPrimero = new Set(tramos[0].map((v) => claveDia(v.created_at)));
  assert.equal(diasPrimero.size, DIAS_POR_TRAMO);
  assert.ok(diasPrimero.has(HOY) && diasPrimero.has(sumarDias(HOY, -13)));
});

test("dentro de un tramo con más filas que el corte del servidor, se piden más páginas sin perder ninguna", async () => {
  // 1,300 visitas en un solo día (más que una página y más que el corte de 1,000), algunas con la misma hora.
  const filas: FilaFalsa[] = [];
  for (let i = 0; i < 1300; i++) {
    const segundo = Math.floor(i / 3); // de 3 en 3 con la misma hora: se desempata por id
    filas.push(fila(`x${String(i).padStart(4, "0")}`, new Date(Date.parse("2026-11-25T12:00:00Z") + segundo * 1000).toISOString()));
  }
  const { api, peticiones } = baseFalsa(filas, { corteServidor: 1000 });
  const r = await cargarTramo(api, primerTramo(HOY), true);
  assert.equal(r.tipo, "ok");
  if (r.tipo !== "ok") return;
  assert.equal(r.visitas.length, 1300);
  assert.equal(new Set(r.visitas.map((v) => v.id)).size, 1300);
  assert.equal(peticiones.length, Math.ceil(1300 / FILAS_POR_PAGINA));
});

test("si se guarda una visita nueva mientras se cargan las páginas, nada se repite ni se salta", async () => {
  const filas: FilaFalsa[] = [];
  for (let i = 0; i < 700; i++) filas.push(fila(`y${String(i).padStart(4, "0")}`, new Date(Date.parse("2026-11-25T17:00:00Z") - i * 60000).toISOString()));
  const { api } = baseFalsa(filas, {
    antesDeCadaPagina: (n) => {
      if (n === 1) filas.push(fila("nueva", "2026-11-25T17:30:00Z"));
    },
  });
  const r = await cargarTramo(api, primerTramo(HOY), true);
  assert.equal(r.tipo, "ok");
  if (r.tipo !== "ok") return;
  assert.equal(r.visitas.length, 700, "la nueva se ve al volver a cargar; las 700 de antes, todas y una vez");
  assert.equal(new Set(r.visitas.map((v) => v.id)).size, 700);
});

test("semanas sin visitas: el siguiente tramo salta al día de la visita más antigua (sin tramos vacíos)", async () => {
  const { api } = baseFalsa([
    fila("hoy", "2026-11-25T18:00:00Z"),
    fila("vieja1", "2026-08-10T18:00:00Z"),
    fila("vieja2", "2026-08-01T18:00:00Z"),
    fila("muy-vieja", "2025-01-05T18:00:00Z"),
  ]);
  const r1 = await cargarTramo(api, primerTramo(HOY), true);
  assert.ok(r1.tipo === "ok" && r1.siguiente);
  if (r1.tipo !== "ok" || !r1.siguiente) return;
  assert.deepEqual(r1.visitas.map((v) => v.id), ["hoy"]);
  assert.equal(r1.siguiente.diaSuperior, "2026-08-10");
  assert.equal(r1.siguiente.antesDe, inicioDelDia(sumarDias(HOY, -13)));

  const r2 = await cargarTramo(api, r1.siguiente, true);
  assert.ok(r2.tipo === "ok" && r2.siguiente);
  if (r2.tipo !== "ok" || !r2.siguiente) return;
  assert.deepEqual(r2.visitas.map((v) => v.id), ["vieja1", "vieja2"]);

  const r3 = await cargarTramo(api, r2.siguiente, true);
  assert.ok(r3.tipo === "ok");
  if (r3.tipo !== "ok") return;
  assert.deepEqual(r3.visitas.map((v) => v.id), ["muy-vieja"]);
  assert.equal(r3.siguiente, null, "ya no hay más: el botón desaparece");
});

test("sin ninguna visita: lista vacía y sin siguiente tramo", async () => {
  const { api } = baseFalsa([]);
  const r = await cargarTramo(api, primerTramo(HOY), true);
  assert.deepEqual(r, { tipo: "ok", visitas: [], conArticulos: true, fallaArticulos: null, siguiente: null });
});

// --- Si falla el conteo de artículos -------------------------------------------------

test("si falla el conteo de artículos, la lista sale con fotos y sin artículos, y se avisa", async () => {
  const { api, peticiones } = baseFalsa([fila("a", "2026-11-25T18:00:00Z", 2, 5), fila("b", "2026-11-25T17:00:00Z")], {
    sinTablaArticulos: true,
  });
  const r = await cargarTramo(api, primerTramo(HOY), true);
  assert.equal(r.tipo, "ok");
  if (r.tipo !== "ok") return;
  assert.equal(r.conArticulos, false);
  assert.deepEqual(r.fallaArticulos, { tipo: "supabase", codigo: "PGRST200" });
  assert.deepEqual(
    r.visitas.map((v) => [v.id, v.fotos, v.articulos]),
    [
      ["a", 2, null],
      ["b", 0, null],
    ],
  );
  assert.deepEqual(peticiones.map((p) => p.conArticulos), [true, false]);
  const [dia] = agruparPorDia(r.visitas, HOY);
  assert.equal(textoTotales(dia.totales), "2 visitas · 2 fotos");
});

test("después de fallar los artículos, el siguiente tramo ya no los pide", async () => {
  const { api, peticiones } = baseFalsa([fila("a", "2026-11-25T18:00:00Z"), fila("b", "2026-10-01T18:00:00Z")], {
    sinTablaArticulos: true,
  });
  const { visitas } = await cargarTodo(api);
  assert.deepEqual(visitas.map((v) => v.id), ["a", "b"]);
  assert.deepEqual(peticiones.map((p) => p.conArticulos), [true, false, false]);
});

test("una falla de red o de sesión NO se toma como 'faltan artículos': se reporta", async () => {
  const red: ApiLista = {
    async leerPagina() {
      return { data: null, error: { code: "", message: "TypeError: Failed to fetch" }, status: 0 };
    },
    async leerMasReciente() {
      return { data: [], error: null };
    },
  };
  assert.deepEqual(await cargarTramo(red, primerTramo(HOY), true), { tipo: "falla", falla: { tipo: "red", codigo: "" } });

  const sesion: ApiLista = {
    async leerPagina() {
      return { data: null, error: { code: "PGRST303", message: "JWT expired" }, status: 401 };
    },
    async leerMasReciente() {
      return { data: [], error: null };
    },
  };
  const r = await cargarTramo(sesion, primerTramo(HOY), true);
  assert.deepEqual(r, { tipo: "falla", falla: { tipo: "sesion", codigo: "" } satisfies Falla });
});

test("si también falla sin artículos, es un error de verdad (con su código)", async () => {
  const api: ApiLista = {
    async leerPagina() {
      return { data: null, error: { code: "42501", message: "permission denied" }, status: 403 };
    },
    async leerMasReciente() {
      return { data: [], error: null };
    },
  };
  assert.deepEqual(await cargarTramo(api, primerTramo(HOY), true), {
    tipo: "falla",
    falla: { tipo: "supabase", codigo: "42501" },
  });
});

test("si la consulta lanza una excepción, se clasifica igual (no se rompe la pantalla)", async () => {
  const api: ApiLista = {
    async leerPagina() {
      throw new TypeError("Failed to fetch");
    },
    async leerMasReciente() {
      return { data: [], error: null };
    },
  };
  const r = await cargarTramo(api, primerTramo(HOY), true);
  assert.deepEqual(r, { tipo: "falla", falla: { tipo: "red", codigo: "" } });
});

test("unirVisitas no repite y deja todo de la más reciente a la más antigua", () => {
  const a = visita("a", "2026-11-25T18:00:00Z");
  const b = visita("b", "2026-11-20T18:00:00Z");
  const c = visita("c", "2026-11-01T18:00:00Z");
  assert.deepEqual(unirVisitas([a, b], [b, c]).map((v) => v.id), ["a", "b", "c"]);
});
