import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api/http";
import { destinoAcceso } from "./destino";
import type { ContextoAcceso } from "./types";

/** Se consulta en cada peticion; no guardar en caches compartidas. */
export const obtenerAccesoServidor = cache(
  async (): Promise<ContextoAcceso | null> => {
    const cookie = (await headers()).get("cookie");
    if (!cookie) return null;
    const backend = process.env.BACKEND_URL ?? "http://localhost:4000";
    const response = await fetch(new URL("/auth/contexto", backend), {
      headers: { Cookie: cookie, Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 401) return null;
    if (!response.ok)
      throw new ApiError(
        response.status,
        "No se pudo verificar el acceso de esta cuenta.",
      );
    return response.json() as Promise<ContextoAcceso>;
  },
);

// React cache solo deduplica dentro del mismo render de servidor, no entre usuarios.
// Cada pagina protegida lo llama tambien: un layout puede conservarse al navegar.
export async function requerirAdmin() {
  const contexto = await obtenerAccesoServidor();
  if (!contexto) redirect("/iniciar-sesion");
  if (contexto.acceso !== "ADMIN") redirect(destinoAcceso(contexto.acceso));
  return contexto;
}
