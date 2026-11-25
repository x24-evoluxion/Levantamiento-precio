// Pruebas de la lógica de la captura rápida (src/lib/capturas.ts).
// No usa Supabase ni el navegador (localStorage se simula). Correr: npm run test:capturas
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  avisosProducto,
  faltantes,
  filtrarSugerencias,
  guardarBorrador,
  leerBorrador,
  leerPrecio,
  limpiarPrecio,
  limpiarPrecioPegado,
  productoParaGuardar,
  productoTieneDatos,
  productoVacio,
  textoFalta,
  textoPromocion,
  type ProductoBorrador,
} from "./capturas.ts";

// Descripciones INVENTADAS (no son del catálogo real).
const ARTICULOS = [
  "Refresco coca cola nr 250 ml",
  "Refresco coca cola zero 250 ml",
  "Coca cola light 600 ml",
  "Agua mineral 1 l",
  "Café soluble clásico 100 g",
  "Galletas de coco 200 g",
  "Chocolate en polvo 400 g",
  "Cocoa en polvo 200 g",
  "Leche entera 1 l",
];

function producto(cambios: Partial<ProductoBorrador>): ProductoBorrador {
  return { ...productoVacio(), articulo: "Refresco cola", precio_regular: "18.50", ...cambios };
}

// --- Sugerencias -----------------------------------------------------------------

test('sugerencias: "coca" → todas las que contienen "coca"; primero las que empiezan', () => {
  assert.deepEqual(filtrarSugerencias(ARTICULOS, "coca"), [
    "Coca cola light 600 ml",
    "Refresco coca cola nr 250 ml",
    "Refresco coca cola zero 250 ml",
  ]);
});

test('sugerencias: varias palabras en cualquier orden ("coca zero", "zero coca")', () => {
  assert.deepEqual(filtrarSugerencias(ARTICULOS, "coca zero"), ["Refresco coca cola zero 250 ml"]);
  assert.deepEqual(filtrarSugerencias(ARTICULOS, "zero coca"), ["Refresco coca cola zero 250 ml"]);
});

test("sugerencias: sin distinguir mayúsculas ni acentos", () => {
  assert.deepEqual(filtrarSugerencias(ARTICULOS, "CAFE"), ["Café soluble clásico 100 g"]);
  assert.deepEqual(filtrarSugerencias(ARTICULOS, "clasico café"), ["Café soluble clásico 100 g"]);
});

test("sugerencias: mínimo 2 letras, máximo 6, nada si ya es igual a una opción", () => {
  assert.deepEqual(filtrarSugerencias(ARTICULOS, "c"), []);
  assert.deepEqual(filtrarSugerencias(ARTICULOS, "  "), []);
  assert.equal(filtrarSugerencias(ARTICULOS, "co").length, 6);
  assert.deepEqual(filtrarSugerencias(ARTICULOS, "Agua mineral 1 l"), []);
  assert.deepEqual(filtrarSugerencias(ARTICULOS, "xyz"), []);
});

test("sugerencias: con más de 3,000 opciones responde rápido", () => {
  const muchas = Array.from({ length: 3500 }, (_, i) => `Articulo de prueba ${i} coca ${i % 7}`);
  const inicio = performance.now();
  for (let i = 0; i < 20; i++) filtrarSugerencias(muchas, "coca 3");
  assert.equal(filtrarSugerencias(muchas, "coca 3").length, 6);
  assert.ok(performance.now() - inicio < 500);
});

// --- Precios ---------------------------------------------------------------------

test("precio al escribir: descarta lo que no es número; un separador; 2 decimales", () => {
  assert.equal(limpiarPrecio("18,50"), "18,50");
  assert.equal(limpiarPrecio("18.50"), "18.50");
  assert.equal(limpiarPrecio("$ 18.5"), "18.5");
  assert.equal(limpiarPrecio("12.5.3"), "12.53");
  assert.equal(limpiarPrecio("1.999"), "1.99");
  assert.equal(limpiarPrecio("-3a"), "3");
  assert.equal(limpiarPrecio("123456789"), "1234567");
  assert.equal(limpiarPrecio(""), "");
});

test("precio al pegar: el último separador es el decimal", () => {
  assert.equal(limpiarPrecioPegado("$1,234.50"), "1234.50");
  assert.equal(limpiarPrecioPegado("1.234,5"), "1234,5");
  assert.equal(limpiarPrecioPegado(" 42 pesos "), "42");
});

test("leer precio: coma o punto; vacío o solo separador → null", () => {
  assert.equal(leerPrecio("18,50"), 18.5);
  assert.equal(leerPrecio("18."), 18);
  assert.equal(leerPrecio(",5"), 0.5);
  assert.equal(leerPrecio("0"), 0);
  assert.equal(leerPrecio(""), null);
  assert.equal(leerPrecio("."), null);
});

// --- Qué falta y avisos ------------------------------------------------------------

test("faltantes: solo artículo y precio regular son obligatorios", () => {
  assert.deepEqual(faltantes(producto({})), []);
  assert.deepEqual(faltantes(producto({ precio_regular: "" })), ["precio regular"]);
  assert.deepEqual(faltantes(producto({ articulo: "  ", precio_regular: "." })), ["artículo", "precio regular"]);
  assert.equal(textoFalta(["precio regular"]), "Falta: precio regular");
  assert.equal(textoFalta(["artículo", "precio regular"]), "Falta: artículo y precio regular");
  assert.equal(textoFalta([]), null);
});

test("promoción y observaciones NUNCA impiden agregar", () => {
  assert.deepEqual(faltantes(producto({ promo_precio_pieza: "999", observaciones: "x".repeat(600) })), []);
  assert.deepEqual(faltantes(producto({ promo_precio_pieza: "." })), []);
});

test("avisos: precio 0, promoción no menor que el regular, precios muy altos", () => {
  assert.ok(avisosProducto(producto({ precio_regular: "0" })).precio_regular);
  assert.ok(avisosProducto(producto({ precio_regular: "20", promo_precio_pieza: "20" })).promo_precio_pieza);
  assert.ok(avisosProducto(producto({ precio_regular: "20", promo_precio_pieza: "25" })).promo_precio_pieza);
  assert.equal(avisosProducto(producto({ precio_regular: "20", promo_precio_pieza: "15" })).promo_precio_pieza, undefined);
  assert.ok(avisosProducto(producto({ precio_regular: "10001" })).precio_regular);
  assert.deepEqual(avisosProducto(producto({})), {});
});

// --- Para guardar ------------------------------------------------------------------

test("para guardar: solo las columnas del formulario, números y vacíos como null", () => {
  assert.deepEqual(
    productoParaGuardar(
      "v1",
      producto({ articulo: "  Refresco coca cola zero 250 ml ", articulo_de_lista: true, precio_regular: "18,5", promo_precio_pieza: "", observaciones: "   " }),
    ),
    {
      visita_id: "v1",
      articulo: "Refresco coca cola zero 250 ml",
      articulo_de_lista: true,
      precio_regular: 18.5,
      promo_precio_pieza: null,
      observaciones: null,
    },
  );
  const conPromo = productoParaGuardar("v1", producto({ promo_precio_pieza: "21", observaciones: "2x42" }));
  assert.equal(conPromo.promo_precio_pieza, 21);
  assert.equal(conPromo.observaciones, "2x42");
});

test("formulario vacío no cuenta como datos sin guardar", () => {
  assert.equal(productoTieneDatos(productoVacio()), false);
  assert.equal(productoTieneDatos({ ...productoVacio(), observaciones: "x" }), true);
});

test("texto de promoción: filas nuevas (por pieza) y del formulario anterior", () => {
  const base = { promo_tipo: "ninguna", promo_piezas: null, promo_precio_total: null, promo_paga_piezas: null, promo_condicion: "ninguna" };
  assert.equal(textoPromocion({ ...base, promo_precio_pieza: null }), null);
  assert.match(textoPromocion({ ...base, promo_precio_pieza: 21 }) ?? "", /^promo \$21\.00$/);
  assert.match(
    textoPromocion({ ...base, promo_precio_pieza: null, promo_tipo: "n_por_precio", promo_piezas: 2, promo_precio_total: 30, promo_condicion: "tarjeta" }) ?? "",
    /^2 x \$30\.00 · solo con tarjeta$/,
  );
});

// --- Borrador ----------------------------------------------------------------------

function conAlmacenamiento(fn: (datos: Map<string, string>) => void) {
  const datos = new Map<string, string>();
  const antes = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => datos.get(k) ?? null,
      setItem: (k: string, v: string) => void datos.set(k, v),
      removeItem: (k: string) => void datos.delete(k),
    },
  };
  try {
    fn(datos);
  } finally {
    (globalThis as { window?: unknown }).window = antes;
  }
}

test("borrador: se guarda y se lee (formulario y lista)", () => {
  conAlmacenamiento(() => {
    const lista = [producto({ articulo: "Uno" }), producto({ articulo: "Dos", promo_precio_pieza: "9" })];
    const formulario = producto({ articulo: "A medias", precio_regular: "" });
    guardarBorrador("u1", "v1", { formulario, pendientes: lista });
    const leido = leerBorrador("u1", "v1");
    assert.deepEqual(leido?.pendientes, lista);
    assert.deepEqual(leido?.formulario, formulario);
    assert.equal(leerBorrador("u2", "v1"), null);
    guardarBorrador("u1", "v1", { formulario: productoVacio(), pendientes: [] });
    assert.equal(leerBorrador("u1", "v1"), null);
  });
});

test("borrador del formato anterior (010) o dañado: se ignora sin errores", () => {
  conAlmacenamiento((datos) => {
    // Clave y forma del formulario anterior: no se lee.
    datos.set("levantamiento:captura:v1:u1:v1", JSON.stringify([{ articulo: "Viejo", cantidad: "600", unidad: "ml" }]));
    assert.equal(leerBorrador("u1", "v1"), null);
    // Clave nueva con contenido que no es del formato nuevo.
    datos.set("levantamiento:captura:v2:u1:v1", JSON.stringify([{ articulo: "Viejo", cantidad: "600" }]));
    assert.equal(leerBorrador("u1", "v1"), null);
    datos.set("levantamiento:captura:v2:u1:v1", "{no es json");
    assert.equal(leerBorrador("u1", "v1"), null);
    datos.set("levantamiento:captura:v2:u1:v1", JSON.stringify({ formulario: 5, pendientes: [{ articulo: 1 }] }));
    assert.equal(leerBorrador("u1", "v1"), null);
  });
});

test("borrador: sin localStorage no falla", () => {
  assert.equal(leerBorrador("u1", "v1"), null);
  assert.doesNotThrow(() => guardarBorrador("u1", "v1", { formulario: producto({}), pendientes: [] }));
});
