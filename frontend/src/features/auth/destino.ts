import type { Acceso } from "./types";

// Destinos fijos: nunca se acepta una URL de redireccion enviada por el cliente.
export function destinoAcceso(acceso: Acceso): string {
  if (acceso === "ADMIN") return "/inicio";
  if (acceso === "CAMBIAR_PASSWORD") return "/cambiar-password";
  return "/acceso";
}
