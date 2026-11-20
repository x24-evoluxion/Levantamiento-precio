// Pruebas de la validación del paquete, SOLO con datos INVENTADOS.
// Correr: npm run test:etapa2
import { test } from "node:test";
import assert from "node:assert/strict";
import { leerCsv } from "./csv.ts";
import { validarPaquete, contarPorTipo, COLUMNAS_ARTICULOS, COLUMNAS_PROMOCIONES } from "./catalogo.ts";

const CRLF = "\r\n";
const BOM = "﻿";

function diccionario(): string {
  const filas = ["tabla,columna,tipo,llave,definicion"];
  for (const c of COLUMNAS_ARTICULOS) filas.push(`x24_articulos,${c.nombre},${c.tipoDiccionario},,x`);
  for (const c of COLUMNAS_PROMOCIONES) filas.push(`x24_promociones,${c.nombre},${c.tipoDiccionario},,x`);
  return BOM + filas.join(CRLF) + CRLF;
}

function articulo(v: Record<string, string>): string {
  const base: Record<string, string> = {
    fecha_corte: "2030-01-15", clave: "0001", clave_es_ean: "0", descripcion: "PRODUCTO INVENTADO",
    es_servicio: "0", obsoleto: "0", de_baja: "0", precio_regular: "10.00",
  };
  const r = { ...base, ...v };
  return COLUMNAS_ARTICULOS.map((c) => {
    const x = r[c.nombre] ?? "";
    return /[",]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x;
  }).join(",");
}

function promo(v: Record<string, string>): string {
  const base: Record<string, string> = {
    fecha_corte: "2030-01-15", origen: "promogrupo", id_promocion: "-5", id_grupo: "1", clave: "0001",
    fecha_inicio: "2030-01-01", fecha_fin: "2030-01-31", es_combo: "0",
  };
  const r = { ...base, ...v };
  return COLUMNAS_PROMOCIONES.map((c) => r[c.nombre] ?? "").join(",");
}

function paquete(arts: string[], proms: string[]) {
  const a = BOM + [COLUMNAS_ARTICULOS.map((c) => c.nombre).join(","), ...arts].join(CRLF) + CRLF;
  const p = BOM + [COLUMNAS_PROMOCIONES.map((c) => c.nombre).join(","), ...proms].join(CRLF) + CRLF;
  return validarPaquete(leerCsv(a), leerCsv(p), leerCsv(diccionario()));
}

test("paquete correcto: clave texto, contenido y booleanos", () => {
  const r = paquete(
    [articulo({ clave: "0001", contenido_pieza: "600.0", unidad_contenido: "ml" }),
     articulo({ clave: "Z9", descripcion: "CHICLE, MENTA 10 PZ" })],
    [promo({ clave: "0001", precio_promo_pieza: "16.6667" })],
  );
  assert.equal(r.errores.length, 0);
  assert.equal(r.fechaCorte, "2030-01-15");
  assert.equal(r.articulos[0].clave, "0001"); // conserva el cero
  assert.equal(r.articulos[0].cantidad, "600.0");
  assert.equal(r.articulos[1].cantidad, null);
  assert.equal(r.articulos[1].descripcion, "CHICLE, MENTA 10 PZ");
  assert.equal(r.sinContenido[0].pista, "la descripcion dice N PZ");
  assert.equal(r.articulos[0].es_servicio, false);
  // 4 decimales en promoción: se guarda exacto y se reporta como calidad
  assert.equal(r.promociones[0].precio_promo_pieza, "16.6667");
  assert.equal(contarPorTipo(r.calidad).get("decimales_de_mas"), 1);
});

test("errores de formato detienen: clave vacía, con espacios, repetida, fecha y unidad", () => {
  const r = paquete(
    [articulo({ clave: "" }), articulo({ clave: " 0002" }), articulo({ clave: "0003" }),
     articulo({ clave: "0003" }), articulo({ clave: "0004", fecha_ultimo_cambio_precio: "2030-02-30" }),
     articulo({ clave: "0005", contenido_pieza: "1", unidad_contenido: "oz" }),
     articulo({ clave: "0006", precio_regular: "10.123" })],
    [],
  );
  const e = contarPorTipo(r.errores);
  assert.equal(e.get("clave_vacia"), 1);
  assert.equal(e.get("clave_con_espacios"), 1);
  assert.equal(e.get("llave_repetida"), 1);
  assert.equal(e.get("fecha_invalida"), 1);
  assert.equal(e.get("unidad_invalida"), 1);
  assert.equal(e.get("no_cabe_en_la_base"), 1);
});

test("encabezados distintos detienen todo", () => {
  const a = "clave,descripcion" + CRLF + "1,X" + CRLF;
  const p = COLUMNAS_PROMOCIONES.map((c) => c.nombre).join(",") + CRLF;
  const r = validarPaquete(leerCsv(a), leerCsv(p), leerCsv(diccionario()));
  assert.equal(contarPorTipo(r.errores).get("encabezados_distintos"), 1);
  assert.equal(r.articulos.length, 0);
});

test("problemas de calidad se reportan y NO se corrigen", () => {
  const r = paquete(
    [articulo({ clave: "0001", descripcion: "UNO", precio_regular: "10.00", precio_mayoreo: "10.00" }),
     articulo({ clave: "0002", precio_regular: "0.00", descripcion: "REPETIDO" }),
     articulo({ clave: "0003", descripcion: "REPETIDO " }),
     articulo({ clave: "0004", descripcion: "CUATRO", precio_regular: "11.60", precio_regular_sin_impuestos: "9.0000", tasa_iva: "0.16", tasa_ieps: "0" })],
    [promo({ clave: "0001", descuento_pct: "-0.05", precio_promo_pieza: "12.00", precio_regular_al_inicio: "10.00" }),
     promo({ clave: "NOEXISTE", id_grupo: "2", piezas_requeridas: "2", precio_promo_pieza: "15.00", precio_promo_grupo: "31.00" }),
     promo({ clave: "0002", id_grupo: "3", fecha_inicio: "2030-02-01", fecha_fin: "2030-01-01" })],
  );
  const q = contarPorTipo(r.calidad);
  assert.equal(r.errores.length, 0);
  assert.equal(q.get("mayoreo_mayor_o_igual_al_regular"), 1);
  assert.equal(q.get("precio_regular_cero_o_negativo"), 1);
  assert.equal(q.get("descripcion_repetida"), 2);
  assert.equal(q.get("sin_impuestos_no_cuadra"), 1);
  assert.equal(q.get("descuento_negativo"), 1);
  assert.equal(q.get("promo_pieza_mayor_o_igual_al_regular"), 1);
  assert.equal(q.get("promocion_sin_articulo"), 1);
  assert.equal(q.get("promo_grupo_no_cuadra"), 1);
  assert.equal(q.get("fecha_inicio_posterior_a_fin"), 1);
  // Se cargan tal cual
  assert.equal(r.articulos.find((a) => a.clave === "0002")?.precio_regular, "0.00");
  assert.equal(r.promociones.length, 3);
});

test("dos fechas de corte distintas detienen", () => {
  const r = paquete([articulo({ clave: "1" }), articulo({ clave: "2", fecha_corte: "2030-01-16" })], []);
  assert.equal(contarPorTipo(r.errores).get("fecha_corte_distinta"), 1);
});
