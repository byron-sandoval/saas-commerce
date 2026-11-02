"use client";

import { AuthShell } from "@/features/auth/components/auth-shell";
import { LogoutButton } from "@/features/auth/components/logout-button";
import styles from "@/features/auth/components/auth.module.css";

export default function AccessError({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <AuthShell>
      <h2 className={styles.title}>No pudimos verificar tu acceso</h2>
      <p className={styles.description}>
        Comprueba tu conexión e inténtalo de nuevo. Si el problema continúa,
        contacta al administrador para revisar el estado de tu cuenta.
      </p>
      <button className={styles.primary} onClick={retry}>
        Volver a intentar
      </button>
      <div className={styles.help}>
        <LogoutButton />
      </div>
    </AuthShell>
  );
}
