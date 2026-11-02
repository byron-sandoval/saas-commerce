import type { NextConfig } from "next";

const backendUrl = new URL(process.env.BACKEND_URL ?? "http://localhost:4000");
if (
  !["http:", "https:"].includes(backendUrl.protocol) ||
  backendUrl.username ||
  backendUrl.password ||
  backendUrl.pathname !== "/" ||
  backendUrl.search ||
  backendUrl.hash
) {
  throw new Error(
    "BACKEND_URL debe ser un origen HTTP o HTTPS sin credenciales ni rutas.",
  );
}
if (process.env.NODE_ENV === "production" && !process.env.BACKEND_URL) {
  throw new Error("Configura BACKEND_URL para produccion.");
}

const nextConfig: NextConfig = {
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    // Compatibilidad con los enlaces anteriores; se resuelve antes de renderizar.
    return [
      {
        source: "/productos",
        destination: "/inventario/productos",
        permanent: false,
      },
      {
        source: "/inventario",
        destination: "/inventario/existencias",
        permanent: false,
      },
      { source: "/ventas", destination: "/ventas/historial", permanent: false },
      {
        source: "/clientes",
        destination: "/ventas/clientes",
        permanent: false,
      },
      {
        source: "/devoluciones",
        destination: "/ventas/cambios",
        permanent: false,
      },
      { source: "/compras", destination: "/compras/ordenes", permanent: false },
      {
        source: "/proveedores",
        destination: "/compras/proveedores",
        permanent: false,
      },
      { source: "/caja", destination: "/caja/actual", permanent: false },
      {
        source: "/creditos",
        destination: "/creditos/cartera",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: `${backendUrl.origin}/api/auth/:path*`,
      },
      {
        source: "/api/backend/:path*",
        destination: `${backendUrl.origin}/:path*`,
      },
    ];
  },
  turbopack: {
    rules: {
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
