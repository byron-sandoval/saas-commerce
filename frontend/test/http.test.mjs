import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, apiRequest, requestJson } from "../src/lib/api/http.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("envia JSON y cookies al proxy sin cachear informacion privada", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/backend/ventas");
    assert.equal(options.credentials, "same-origin");
    assert.equal(options.cache, "no-store");
    assert.equal(options.headers.get("Content-Type"), "application/json");
    assert.deepEqual(JSON.parse(options.body), { clienteId: "cliente" });
    return Response.json({ id: "venta" });
  };
  assert.deepEqual(await apiRequest("/ventas", { method: "POST", json: { clienteId: "cliente" } }), { id: "venta" });
});

test("mantiene 401/403 y mensajes de validacion para que la pantalla decida como responder", async () => {
  for (const status of [400, 401, 403]) {
    globalThis.fetch = async () => Response.json({ message: ["Primer error", "Segundo error"] }, { status });
    await assert.rejects(apiRequest("/empresas/actual"), (error) =>
      error instanceof ApiError && error.status === status && error.message === "Primer error. Segundo error");
  }
});

test("acepta respuestas vacias y sesiones nulas", async () => {
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await apiRequest("/usuarios/empleado", { method: "DELETE" }), undefined);
  globalThis.fetch = async () => Response.json(null);
  assert.equal(await requestJson("/api/auth", "/get-session"), null);
});

test("detecta un proxy que devuelve HTML y conserva errores de red", async () => {
  globalThis.fetch = async () => new Response("<html>Error</html>", { status: 502 });
  await assert.rejects(apiRequest("/ventas"), (error) => error instanceof ApiError && error.status === 502);
  globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
  await assert.rejects(apiRequest("/ventas"), TypeError);
});

test("rechaza rutas absolutas y rutas que salen del prefijo", async () => {
  globalThis.fetch = async () => { assert.fail("No debe realizar una solicitud"); };
  for (const path of ["https://ajeno.example", "//ajeno.example", "/../auth", "/ventas/../auth", "/ventas#fragmento"]) {
    await assert.rejects(apiRequest(path), /ruta/);
  }
});
