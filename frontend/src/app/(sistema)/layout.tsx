import { Suspense } from "react";
import type { ReactNode } from "react";
import { requerirAdmin } from "@/features/auth/server";
import { AdminShell } from "@/components/layout/admin-shell";

async function AdminLayout({ children }: { children: ReactNode }) {
  const contexto = await requerirAdmin();
  return <AdminShell contexto={contexto}>{children}</AdminShell>;
}

export default function SystemLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <main
          role="status"
          className="flex min-h-svh items-center justify-center bg-slate-50 text-sm text-slate-500"
        >
          Preparando tu espacio de trabajo…
        </main>
      }
    >
      <AdminLayout>{children}</AdminLayout>
    </Suspense>
  );
}
