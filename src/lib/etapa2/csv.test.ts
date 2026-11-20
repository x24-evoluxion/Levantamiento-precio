// Pruebas del lector de CSV, SOLO con datos INVENTADOS.
// Correr: npm run test:etapa2
import { test } from "node:test";
import assert from "node:assert/strict";
import { leerCsv, ErrorCsv } from "./csv.ts";

const campos = (texto: string) => leerCsv(texto).map((f) => f.campos);

test("quita el BOM y lee CRLF", () => {
  const filas = leerCsv("﻿clave,descripcion\r\n00123,AGUA\r\nZ9,CHICLE\r\n");
  assert.deepEqual(filas, [
    { renglon: 1, campos: ["clave", "descripcion"] },
    { renglon: 2, campos: ["00123", "AGUA"] },
    { renglon: 3, campos: ["Z9", "CHICLE"] },
  ]);
  // El encabezado no conserva el BOM.
  assert.equal(filas[0].campos[0], "clave");
});

test("la clave sigue siendo texto (ceros a la izquierda y más de 15 dígitos)", () => {
  const [, fila] = campos("clave\r\n0001234567890123456\r\n");
  assert.deepEqual(fila, ["0001234567890123456"]);
});

test("respeta comas dentro de comillas", () => {
  assert.deepEqual(campos('a,b,c\r\n1,"GALLETA, CHOCOLATE",3\r\n'), [
    ["a", "b", "c"],
    ["1", "GALLETA, CHOCOLATE", "3"],
  ]);
});

test("comillas dobles escapadas", () => {
  assert.deepEqual(campos('a,b\r\n"TUBO 1/2"" PVC","dice ""hola"""\r\n'), [
    ["a", "b"],
    ['TUBO 1/2" PVC', 'dice "hola"'],
  ]);
});

test("salto de línea dentro de un campo, y el renglón siguiente se cuenta bien", () => {
  const filas = leerCsv('a,b\r\n"LINEA 1\r\nLINEA 2",x\r\nfin,y\r\n');
  assert.deepEqual(filas, [
    { renglon: 1, campos: ["a", "b"] },
    { renglon: 2, campos: ["LINEA 1\r\nLINEA 2", "x"] },
    { renglon: 4, campos: ["fin", "y"] },
  ]);
});

test("campos vacíos, al final y entre comillas", () => {
  assert.deepEqual(campos('a,b,c\r\n,,\r\n"",x,\r\n'), [
    ["a", "b", "c"],
    ["", "", ""],
    ["", "x", ""],
  ]);
});

test("sin salto de línea al final y con LF solo", () => {
  assert.deepEqual(campos("a,b\n1,2"), [
    ["a", "b"],
    ["1", "2"],
  ]);
});

test("archivo vacío o solo BOM = sin filas", () => {
  assert.deepEqual(leerCsv(""), []);
  assert.deepEqual(leerCsv("﻿"), []);
});

test("errores: comillas sin cerrar, texto tras comillas, comilla a media celda", () => {
  assert.throws(() => leerCsv('a\r\n"sin cerrar\r\n'), ErrorCsv);
  assert.throws(() => leerCsv('a,b\r\n"uno"x,2\r\n'), ErrorCsv);
  assert.throws(() => leerCsv('a,b\r\nuno"dos,2\r\n'), ErrorCsv);
});
