import type { IconName } from "@/components/ui/icon";

export interface NavigationItem {
  href: string;
  label: string;
  icon: IconName;
  description: string;
}

export interface NavigationGroup {
  label: string;
  icon: IconName;
  items: NavigationItem[];
}

export const navigationMenu: (NavigationItem | NavigationGroup)[] = [
  {
    href: "/inicio",
    label: "Dashboard",
    icon: "dashboard",
    description: "Resumen general de tu ferretería.",
  },
  {
    label: "Inventario",
    icon: "warehouse",
    items: [
      {
        href: "/inventario/productos",
        label: "Productos",
        icon: "box",
        description: "Organiza los productos de tu ferretería.",
      },
      {
        href: "/inventario/categorias",
        label: "Categorías",
        icon: "box",
        description: "Agrupa los productos por categorías.",
      },
      {
        href: "/inventario/unidades",
        label: "Unidades de medida",
        icon: "box",
        description:
          "Administra las unidades para vender y comprar tus productos.",
      },
      {
        href: "/inventario/existencias",
        label: "Existencias",
        icon: "warehouse",
        description:
          "Consulta las existencias de los productos de tu ferretería.",
      },
      {
        href: "/inventario/movimientos",
        label: "Movimientos de inventario",
        icon: "warehouse",
        description:
          "Aquí se preparará la consulta del historial de entradas y salidas de productos.",
      },
    ],
  },
  {
    label: "Ventas",
    icon: "cart",
    items: [
      {
        href: "/ventas/nueva",
        label: "Nueva venta",
        icon: "cart",
        description: "Registra una venta desde tu caja abierta.",
      },
      {
        href: "/ventas/historial",
        label: "Historial de ventas",
        icon: "clipboard",
        description: "Consulta las ventas y facturas de tu ferretería.",
      },
      {
        href: "/ventas/clientes",
        label: "Clientes",
        icon: "users",
        description: "Administra la información de tus clientes.",
      },
      {
        href: "/ventas/cambios",
        label: "Devoluciones",
        icon: "undo",
        description:
          "Consulta y registra cambios de productos vinculados a una venta.",
      },
    ],
  },
  {
    label: "Compras",
    icon: "clipboard",
    items: [
      {
        href: "/compras/ordenes",
        label: "Órdenes de compra",
        icon: "clipboard",
        description: "Prepara órdenes de compra y registra su recepción.",
      },
      {
        href: "/compras/proveedores",
        label: "Proveedores",
        icon: "truck",
        description: "Mantén organizada la información de tus proveedores.",
      },
    ],
  },
  {
    label: "Caja",
    icon: "cash",
    items: [
      {
        href: "/caja/actual",
        label: "Mi caja",
        icon: "cash",
        description: "Abre tu caja, revisa el arqueo y registra el cierre.",
      },
      {
        href: "/caja/historial",
        label: "Historial de cajas",
        icon: "cash",
        description: "Consulta las sesiones de caja de tu ferretería.",
      },
    ],
  },
  {
    label: "Créditos",
    icon: "credit",
    items: [
      {
        href: "/creditos/cartera",
        label: "Cartera de clientes",
        icon: "credit",
        description:
          "Consulta los créditos y saldos pendientes de tus clientes.",
      },
      {
        href: "/creditos/abonos",
        label: "Abonos",
        icon: "credit",
        description: "Consulta y registra cobros asociados a un crédito.",
      },
    ],
  },
  {
    href: "/usuarios",
    label: "Usuarios",
    icon: "users",
    description:
      "Administra los accesos de cajeros y bodegueros de tu ferretería.",
  },
  {
    href: "/reportes",
    label: "Reportes",
    icon: "chart",
    description: "Aquí se prepararán los resúmenes y reportes de tu negocio.",
  },
  {
    href: "/configuracion",
    label: "Configuración",
    icon: "settings",
    description:
      "Configura los datos de tu ferretería, el IVA y los cambios de productos.",
  },
];

// Una sola definicion alimenta el menu, las rutas provisionales y la cabecera.
export const navigation: NavigationItem[] = navigationMenu.flatMap((entry) =>
  "items" in entry ? entry.items : [entry],
);
