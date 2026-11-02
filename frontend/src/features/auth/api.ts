import { apiRequest, requestJson } from "@/lib/api/http";
import type { ContextoAcceso, SesionActual } from "./types";

export function obtenerSesion(signal?: AbortSignal) {
  return requestJson<SesionActual | null>("/api/auth", "/get-session", {
    signal,
  });
}

export async function iniciarSesion(identificador: string, password: string) {
  const valor = identificador.trim();
  const esCorreo = valor.includes("@");
  await requestJson<unknown>(
    "/api/auth",
    esCorreo ? "/sign-in/email" : "/sign-in/username",
    {
      method: "POST",
      json: {
        [esCorreo ? "email" : "username"]: valor.toLowerCase(),
        password,
      },
    },
  );
  return obtenerSesion();
}

export async function cerrarSesion() {
  await requestJson<unknown>("/api/auth", "/sign-out", {
    method: "POST",
    json: {},
  });
}

export function obtenerContextoAcceso() {
  return apiRequest<ContextoAcceso>("/auth/contexto");
}

export function cambiarPasswordTemporal(
  passwordActual: string,
  passwordNueva: string,
) {
  return apiRequest<{ ok: boolean }>("/usuarios/cambiar-password-temporal", {
    method: "POST",
    json: { passwordActual, passwordNueva },
  });
}
