export interface UsuarioSesion {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  username?: string | null;
  empresaId?: string | null;
  rolId?: string | null;
  activo: boolean;
  debeCambiarPassword: boolean;
}

export interface SesionActual {
  user: UsuarioSesion;
  session: { id: string; userId: string; expiresAt: string };
}

export type Acceso =
  | "ADMIN"
  | "CAJERO"
  | "BODEGUERO"
  | "SIN_EMPRESA"
  | "CAMBIAR_PASSWORD"
  | "SUPERADMIN";
export interface ContextoAcceso {
  usuario: { id: string; nombre: string };
  acceso: Acceso;
  empresa: { id: string; nombre: string } | null;
}
