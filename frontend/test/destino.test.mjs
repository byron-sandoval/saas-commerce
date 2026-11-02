import { test } from "node:test";
import assert from "node:assert/strict";
import { destinoAcceso } from "../src/features/auth/destino.ts";

test("solo ADMIN entra a inicio y las temporales requieren cambiar password", () => {
  assert.equal(destinoAcceso("ADMIN"), "/inicio");
  assert.equal(destinoAcceso("CAMBIAR_PASSWORD"), "/cambiar-password");
  for (const rol of ["CAJERO", "BODEGUERO", "SUPERADMIN", "SIN_EMPRESA"]) {
    assert.equal(destinoAcceso(rol), "/acceso");
  }
});
