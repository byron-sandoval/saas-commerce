import { Suspense } from "react";
import { requerirAdmin } from "@/features/auth/server";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";

export const metadata = { title: "Dashboard" };

async function Dashboard() {
  await requerirAdmin();
  return <DashboardView />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<p role="status">Preparando resumen…</p>}>
      <Dashboard />
    </Suspense>
  );
}
