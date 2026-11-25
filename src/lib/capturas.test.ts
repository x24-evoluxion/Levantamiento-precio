// Pruebas de la lógica de la captura manual (src/lib/capturas.ts).
// No usa Supabase ni el navegador. Correr: npm run test:capturas
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  avisosFila,
  filaParaGuardar,
  filaTieneDatos,
  filaVacia,
  filtrarSugerencias,
  leerNumero,
  validarFila,
  type FilaBorrador,
} from "./capturas.ts";

const AREAS = ["ABARROTES", "BEBIDAS", "CERVEZA Y BEBIDAS ALCOHÓLICAS", "LÁCTEOS", "BEBÉS", "DULCERÍA"];

function fila(cambios: Partial<FilaBorrador>): FilaBorrador {
  return {
    ...filaVacia(),
    articulo: "Refresco cola",
    cantidad: "600",
    unidad: "ml",
    precio_regular: "18.50",
    ...cambios,
  };
}

test('sugerencias: "BE" sugiere primero las que empiezan y luego las que contienen', () => {
  assert.deepEqual(filtrarSugerencias(AREAS, "BE"), ["BEBÉS", "BEBIDAS", "CERVEZA Y BEBIDAS ALCOHÓLICAS"]);
});

test("sugerencias: sin distinguir mayúsculas ni acentos", () => {
  assert.deepEqual(filtrarSugerencias(AREAS, "lacteos"), ["LÁCTEOS"]);
  assert.deepEqual(filtrarSugerencias(AREAS, "bebe"), ["BEBÉS"]);
  assert.deepEqual(filtrarSugerencias(AREAS, "dulceria"), ["DULCERÍA"]);
});

test("sugerencias: máximo 5, nada si está vacío o si ya es igual a una opción", () => {
  assert.equal(filtrarSugerencias(AREAS, "A").length, 5);
  assert.deepEqual(filtrarSugerencias(AREAS, "  "), []);
  assert.deepEqual(filtrarSugerencias(AREAS, "BEBIDAS"), []);
  // Igual salvo mayúsculas: sí se sugiere la forma de la lista.
  assert.deepEqual(filtrarSugerencias(AREAS, "bebidas"), ["BEBIDAS", "CERVEZA Y BEBIDAS ALCOHÓLICAS"]);
  assert.deepEqual(filtrarSugerencias(AREAS, "zzz"), []);
});

test("números: coma o punto decimal; sin signos ni miles", () => {
  assert.deepEqual(leerNumero("12,50"), { ok: true, valor: 12.5, decimales: 2 });
  assert.deepEqual(leerNumero(" 12.5 "), { ok: true, valor: 12.5, decimales: 1 });
  assert.deepEqual(leerNumero("7"), { ok: true, valor: 7, decimales: 0 });
  assert.equal(leerNumero("$12").ok, false);
  assert.equal(leerNumero("-3").ok, false);
  assert.equal(leerNumero("1,234.50").ok, false);
  assert.equal(leerNumero("").ok, false);
});

test("validación: una fila completa no tiene errores", () => {
  assert.deepEqual(validarFila(fila({})), {});
});

test("validación: obligatorios y límites en español", () => {
  const e = validarFila(fila({ articulo: " ", cantidad: "0", unidad: "", piezas: "0", precio_regular: "" }));
  assert.ok(e.articulo && e.cantidad && e.unidad && e.piezas && e.precio_regular);
  assert.ok(validarFila(fila({ precio_regular: "10,555" })).precio_regular?.includes("2 decimales"));
  assert.ok(validarFila(fila({ cantidad: "1.2345" })).cantidad?.includes("3 decimales"));
  assert.ok(validarFila(fila({ piezas: "1.5" })).piezas);
});

test("precio 0: se permite, pero avisa", () => {
  const f = fila({ precio_regular: "0" });
  assert.deepEqual(validarFila(f), {});
  assert.ok(avisosFila(f).precio_regular);
});

test("promoción: reglas por tipo", () => {
  assert.ok(validarFila(fila({ tiene_promo: true })).promo_tipo);
  assert.ok(validarFila(fila({ tiene_promo: true, promo_tipo: "precio_rebajado" })).promo_precio_total);
  assert.ok(
    validarFila(fila({ tiene_promo: true, promo_tipo: "n_por_precio", promo_piezas: "1", promo_precio_total: "30" }))
      .promo_piezas,
  );
  assert.ok(
    validarFila(fila({ tiene_promo: true, promo_tipo: "nxm", promo_piezas: "3", promo_paga_piezas: "3" }))
      .promo_paga_piezas,
  );
  assert.deepEqual(validarFila(fila({ tiene_promo: true, promo_tipo: "otro" })), {});
});

test("para guardar: números convertidos, vacíos como null y de_lista solo con valor", () => {
  const datos = filaParaGuardar(
    "v1",
    fila({
      cantidad: "1,5",
      unidad: "l",
      piezas: "6",
      precio_regular: "99,9",
      marca: "  ",
      marca_de_lista: true,
      area: "BEBIDAS",
      area_de_lista: true,
      tiene_promo: true,
      promo_tipo: "n_por_precio",
      promo_piezas: "2",
      promo_precio_total: "180",
      promo_paga_piezas: "9",
      promo_condicion: "tarjeta",
    }),
  );
  assert.deepEqual(datos, {
    visita_id: "v1",
    articulo: "Refresco cola",
    cantidad: 1.5,
    unidad: "l",
    piezas: 6,
    precio_regular: 99.9,
    marca: null,
    marca_de_lista: false,
    area: "BEBIDAS",
    area_de_lista: true,
    promo_tipo: "n_por_precio",
    promo_piezas: 2,
    promo_precio_total: 180,
    promo_paga_piezas: null,
    promo_condicion: "tarjeta",
    observaciones: null,
  });
});

test('para guardar: sin "Tiene promoción" no manda datos de promoción', () => {
  const datos = filaParaGuardar(
    "v1",
    fila({ tiene_promo: false, promo_tipo: "nxm", promo_piezas: "3", promo_paga_piezas: "2", promo_condicion: "app" }),
  );
  assert.equal(datos.promo_tipo, "ninguna");
  assert.equal(datos.promo_piezas, null);
  assert.equal(datos.promo_paga_piezas, null);
  assert.equal(datos.promo_condicion, "ninguna");
});

test("precio rebajado: promo_piezas siempre 1 (como lo exige la base)", () => {
  const datos = filaParaGuardar(
    "v1",
    fila({ tiene_promo: true, promo_tipo: "precio_rebajado", promo_piezas: "4", promo_precio_total: "15" }),
  );
  assert.equal(datos.promo_piezas, 1);
  assert.equal(datos.promo_precio_total, 15);
});

test("una fila recién agregada no cuenta como datos sin guardar", () => {
  assert.equal(filaTieneDatos(filaVacia()), false);
  assert.equal(filaTieneDatos({ ...filaVacia(), articulo: "x" }), true);
});
