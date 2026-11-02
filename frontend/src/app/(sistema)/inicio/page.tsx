import { Suspense } from "react";
import { requerirAdmin } from "@/features/auth/server";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";

export const metadata = { title: "Dashboard" };

async function Dashboard() {
  const contexto = await requerirAdmin();
  const fecha = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Managua",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const parte = (tipo: string) =>
    Number(fecha.find((p) => p.type === tipo)!.value);
  return (
    <DashboardView
      nombreUsuario={contexto.usuario.nombre}
      hoy={{
        year: parte("year"),
        month: parte("month") - 1,
        day: parte("day"),
      }}
    />
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<p role="status">Preparando resumen…</p>}>
      <Dashboard />
    </Suspense>
  );
}
