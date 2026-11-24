// Pruebas de la clasificación de errores (red / sesión / Supabase).
// Usa las clases de error REALES de storage-js y la forma exacta que devuelve
// postgrest-js 2.119 cuando fetch falla. Correr: npm run test:errores
import { test } from "node:test";
import assert from "node:assert/strict";
import { StorageApiError, StorageUnknownError } from "@supabase/storage-js";
import { clasificarFalla, mensajeDeFalla } from "./errores.ts";

test("PostgREST sin internet (fetch falló) → red", () => {
  const error = { message: "TypeError: Failed to fetch", details: "", hint: "", code: "" };
  assert.equal(clasificarFalla(error, 0).tipo, "red");
  assert.equal(clasificarFalla(error).tipo, "red"); // aun sin status
  assert.equal(clasificarFalla({ message: "TypeError: Load failed", code: "" }).tipo, "red"); // Safari
});

test("PostgREST tiempo agotado → red", () => {
  const error = { message: "AbortError: signal is aborted without reason", code: "", hint: "Request was aborted" };
  assert.equal(clasificarFalla(error).tipo, "red");
});

test("PostgREST regla de permisos → supabase con código", () => {
  const error = {
    message: 'new row violates row-level security policy for table "visitas"',
    code: "42501",
    details: null,
    hint: null,
  };
  const falla = clasificarFalla(error, 403);
  assert.deepEqual(falla, { tipo: "supabase", codigo: "42501" });
  assert.equal(mensajeDeFalla(falla), "No se pudo guardar. Avisa al responsable e indica este código: 42501");
});

test("PostgREST recursión en reglas → supabase con código (no red)", () => {
  const error = { message: 'infinite recursion detected in policy for relation "visitas"', code: "42P17" };
  assert.deepEqual(clasificarFalla(error, 500), { tipo: "supabase", codigo: "42P17" });
});

test("PostgREST respuesta sin código (502) → código HTTP", () => {
  assert.deepEqual(clasificarFalla({ message: "<html>Bad gateway</html>" }, 502), {
    tipo: "supabase",
    codigo: "HTTP-502",
  });
});

test("PostgREST JWT caducado → sesión", () => {
  assert.equal(clasificarFalla({ message: "JWT expired", code: "PGRST303" }, 401).tipo, "sesion");
  assert.equal(clasificarFalla({ message: "JWT expired", code: "PGRST301" }, 401).tipo, "sesion");
});

test("Storage sin internet → red", () => {
  const error = new StorageUnknownError("Failed to fetch", new TypeError("Failed to fetch"));
  assert.equal(clasificarFalla(error).tipo, "red");
});

test("Storage regla de permisos → supabase con código S403", () => {
  const error = new StorageApiError("new row violates row-level security policy", 403, "403", "storage", "Unauthorized");
  assert.deepEqual(clasificarFalla(error), { tipo: "supabase", codigo: "S403-Unauthorized" });
});

test("Storage JWT caducado → sesión", () => {
  const error = new StorageApiError('"exp" claim timestamp check failed', 400, "InvalidJWT", "storage", "InvalidJWT");
  assert.equal(clasificarFalla(error).tipo, "sesion");
});

test("Error de la app sin código → APP", () => {
  assert.deepEqual(clasificarFalla(new Error("algo")), { tipo: "supabase", codigo: "APP" });
});
