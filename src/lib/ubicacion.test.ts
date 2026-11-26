// Pruebas de leerCoordenadas (corregir la ubicación de una visita, 013). Datos inventados.
// Correr: npm run test:ubicacion
import { test } from "node:test";
import assert from "node:assert/strict";
import { leerCoordenadas } from "./ubicacion.ts";

const CDMX = { latitud: 19.4326, longitud: -99.1332 };

test("coordenadas escritas: con coma, con espacio, sin espacio", () => {
  assert.deepEqual(leerCoordenadas("19.4326, -99.1332"), CDMX);
  assert.deepEqual(leerCoordenadas("  19.4326 -99.1332 "), CDMX);
  assert.deepEqual(leerCoordenadas("19.4326,-99.1332"), CDMX);
});

test("enlaces de Google Maps (@lat,lon · ?q= · query= con %2C)", () => {
  assert.deepEqual(leerCoordenadas("https://www.google.com/maps/@19.4326,-99.1332,15z"), CDMX);
  assert.deepEqual(leerCoordenadas("https://maps.google.com/?q=19.4326,-99.1332"), CDMX);
  assert.deepEqual(leerCoordenadas("https://www.google.com/maps/search/?api=1&query=19.4326%2C-99.1332"), CDMX);
});

test("fuera de rango o sin sentido → null (no se manda nada)", () => {
  assert.equal(leerCoordenadas("91, 10"), null);
  assert.equal(leerCoordenadas("10, 181"), null);
  assert.equal(leerCoordenadas("abc"), null);
  assert.equal(leerCoordenadas("19.4"), null);
  assert.equal(leerCoordenadas(""), null);
  assert.equal(leerCoordenadas("100%"), null);
});
