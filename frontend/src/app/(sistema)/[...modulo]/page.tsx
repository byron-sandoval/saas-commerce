import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requerirAdmin } from "@/features/auth/server";
import { navigation } from "@/components/layout/navigation";
import { ModulePlaceholder } from "@/features/dashboard/components/module-placeholder";

export const metadata = { title: "Panel de administración" };

async function Module({ params }: { params: Promise<{ modulo: string[] }> }) {
  await requerirAdmin();
  const { modulo } = await params;
  const path = `/${modulo.join("/")}`;
  const item = navigation.find(
    (entry) => entry.href === path && entry.href !== "/inicio",
  );
  if (!item) notFound();
  return <ModulePlaceholder item={item} />;
}

export default function ModulePage({
  params,
}: {
  params: Promise<{ modulo: string[] }>;
}) {
  return (
    <Suspense fallback={<p role="status">Preparando sección…</p>}>
      <Module params={params} />
    </Suspense>
  );
}
