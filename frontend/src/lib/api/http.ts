/** Cliente para llamadas desde el navegador. Next.js las reenvia a NestJS. */
export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(
    status: number,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = Omit<RequestInit, "body" | "credentials" | "cache"> & {
  json?: unknown;
};

export async function requestJson<T>(
  base: "/api/backend" | "/api/auth",
  path: string,
  { json, headers: inputHeaders, ...options }: RequestOptions = {},
): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//") || /[\\#]/.test(path) || path.split(/[/?]/).some((part) => part === ".." || part === ".")) {
    throw new Error("La ruta debe ser relativa a la API.");
  }
  const headers = new Headers(inputHeaders);
  headers.set("Accept", "application/json");
  if (json !== undefined) headers.set("Content-Type", "application/json");

  const response = await fetch(`${base}${path}`, {
    ...options,
    headers,
    body: json === undefined ? undefined : JSON.stringify(json),
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
  });
  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    throw new ApiError(response.status, "El servidor no devolvio una respuesta JSON valida.");
  }
  if (!response.ok) {
    const message = data && typeof data === "object" && "message" in data
      ? (data as { message: unknown }).message : undefined;
    const description = Array.isArray(message)
      ? message.filter((item): item is string => typeof item === "string").join(". ")
      : typeof message === "string" ? message : undefined;
    throw new ApiError(response.status, description || "No se pudo completar la solicitud.", data);
  }
  return data as T;
}

export function apiRequest<T>(path: string, options?: RequestOptions) {
  return requestJson<T>("/api/backend", path, options);
}
