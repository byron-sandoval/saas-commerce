import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { obtenerAccesoServidor } from "@/features/auth/server";
import { destinoAcceso } from "@/features/auth/destino";

export const metadata = { title: "Cambiar contraseña" };

async function Cambio() {
  const contexto = await obtenerAccesoServidor();
  if (!contexto) redirect("/iniciar-sesion");
  if (contexto.acceso !== "CAMBIAR_PASSWORD")
    redirect(destinoAcceso(contexto.acceso));
  return <ChangePasswordForm />;
}

export default function ChangePasswordPage() {
  return (
    <AuthShell>
      <Suspense fallback={<p role="status">Comprobando sesión…</p>}>
        <Cambio />
      </Suspense>
    </AuthShell>
  );
}
