import { AsyncLocalStorage } from 'node:async_hooks';

export interface ContextoRls {
  usuarioId: string;
  empresaId: string | null;
}

// Solo los guards escriben esta propiedad; no procede de body, query ni headers.
export const CONTEXTO_RLS = Symbol('contexto-rls-validado');
export const contextoRls = new AsyncLocalStorage<ContextoRls>();
