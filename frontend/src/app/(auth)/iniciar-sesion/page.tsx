import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { LoginForm } from "@/features/auth/components/login-form";
import { obtenerAccesoServidor } from "@/features/auth/server";
import { destinoAcceso } from "@/features/auth/destino";

export const metadata = { title: "Iniciar sesión" };

async function Login() {
  const contexto = await obtenerAccesoServidor();
  if (contexto) redirect(destinoAcceso(contexto.acceso));
  return <LoginForm />;
}

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={<p role="status">Comprobando sesión…</p>}>
        <Login />
      </Suspense>
    </AuthShell>
  );
}
