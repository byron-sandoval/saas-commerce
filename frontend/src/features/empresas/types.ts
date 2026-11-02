export interface EmpresaActual {
  id: string;
  nombre: string;
  direccion: string;
  ruc: string | null;
  telefono: string | null;
  correo: string | null;
  porcentajeIva: string;
  devolucionesHabilitadas: boolean;
  estado: "ACTIVA" | "SUSPENDIDA" | "INACTIVA";
}
