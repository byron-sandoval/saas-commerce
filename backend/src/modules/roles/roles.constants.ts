export const ROLES_INICIALES = [
  {
    nombre: 'ADMIN',
    descripcion: 'Administrador de la ferreteria.',
  },
  {
    nombre: 'CAJERO',
    descripcion: 'Encargado de ventas, cobros y caja.',
  },
  {
    nombre: 'BODEGUERO',
    descripcion: 'Encargado de productos, recepciones e inventario.',
  },
] as const;

export type NombreRolInicial = (typeof ROLES_INICIALES)[number]['nombre'];
