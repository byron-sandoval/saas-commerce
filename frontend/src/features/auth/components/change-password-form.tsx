"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api/http";
import { cambiarPasswordTemporal } from "../api";
import { PasswordField } from "./password-field";
import { LogoutButton } from "./logout-button";
import styles from "./auth.module.css";

export function ChangePasswordForm() {
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [completado, setCompletado] = useState(false);
  const ocupado = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (ocupado.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const actual = String(data.get("passwordActual") ?? "");
    const nueva = String(data.get("passwordNueva") ?? "");
    setError("");
    if (nueva !== data.get("confirmacion")) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    if (actual === nueva) {
      setError("La contraseña nueva debe ser diferente de la temporal.");
      return;
    }
    ocupado.current = true;
    setGuardando(true);
    try {
      await cambiarPasswordTemporal(actual, nueva);
      form.reset();
      setCompletado(true);
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status < 500
          ? cause.message
          : "No pudimos guardar el cambio. Inténtalo de nuevo.",
      );
      ocupado.current = false;
    } finally {
      setGuardando(false);
    }
  }
  if (completado)
    return (
      <>
        <h2 className={styles.title}>Contraseña actualizada</h2>
        <p className={styles.description} role="status">
          Tu sesión anterior se cerró por seguridad. Inicia sesión con tu nueva
          contraseña.
        </p>
        <Link href="/iniciar-sesion" className={styles.primary}>
          Volver a iniciar sesión →
        </Link>
      </>
    );
  return (
    <>
      <p className={styles.kicker}>PROTEGE TU CUENTA</p>
      <h2 className={styles.title}>Cambia tu contraseña</h2>
      <p className={styles.description}>
        Antes de continuar, reemplaza tu contraseña temporal por una propia de
        12 a 128 caracteres.
      </p>
      <form onSubmit={submit} className={styles.form} aria-busy={guardando}>
        <fieldset disabled={guardando} className={styles.fields}>
          <PasswordField id="passwordActual" label="Contraseña temporal" />
          <PasswordField
            id="passwordNueva"
            label="Nueva contraseña"
            autoComplete="new-password"
            minLength={12}
          />
          <PasswordField
            id="confirmacion"
            label="Confirma la nueva contraseña"
            autoComplete="new-password"
            minLength={12}
          />
        </fieldset>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <button className={styles.primary} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar contraseña"}
        </button>
      </form>
      <div className={styles.help}>
        <LogoutButton />
      </div>
    </>
  );
}
