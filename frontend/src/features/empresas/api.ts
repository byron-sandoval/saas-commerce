import { apiRequest } from "@/lib/api/http";
import type { EmpresaActual } from "./types";

export function obtenerEmpresaActual(signal?: AbortSignal) {
  return apiRequest<EmpresaActual>("/empresas/actual", { signal });
}
