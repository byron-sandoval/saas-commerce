import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { obtenerAccesoServidor } from "@/features/auth/server";
import { destinoAcceso } from "@/features/auth/destino";
import styles from "@/features/auth/components/auth.module.css";

export const metadata = { title: "Tu cuenta" };

async function Acceso() {
  const contexto = await obtenerAccesoServidor();
  if (!contexto) redirect("/iniciar-sesion");
  if (contexto.acceso === "ADMIN" || contexto.acceso === "CAMBIAR_PASSWORD")
    redirect(destinoAcceso(contexto.acceso));
  const sinEmpresa = contexto.acceso === "SIN_EMPRESA";
  return (
    <>
      <p className={styles.kicker}>SESIÓN INICIADA</p>
      <h2 className={styles.title}>Hola, {contexto.usuario.nombre}</h2>
      <p className={styles.description}>
        {sinEmpresa
          ? "Tu cuenta todavía no tiene una ferretería registrada. El registro de empresa estará disponible en la siguiente etapa."
          : `Ingresaste correctamente${contexto.empresa ? ` a ${contexto.empresa.nombre}` : ""}. El panel de tu perfil todavía está en preparación; por ahora estamos construyendo el panel de administración.`}
      </p>
      <LogoutButton />
    </>
  );
}

export default function AccessPage() {
  return (
    <AuthShell>
      <Suspense fallback={<p role="status">Comprobando acceso…</p>}>
        <Acceso />
      </Suspense>
    </AuthShell>
  );
}
