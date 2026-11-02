"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { ApiError } from "@/lib/api/http";
import { iniciarSesion, obtenerContextoAcceso } from "../api";
import { destinoAcceso } from "../destino";
import { PasswordField } from "./password-field";
import styles from "./auth.module.css";

export function LoginForm() {
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const ocupado = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (ocupado.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const identificador = String(data.get("identificador") ?? "").trim();
    if (!identificador) {
      setError("Escribe tu correo o nombre de usuario.");
      return;
    }
    ocupado.current = true;
    setEnviando(true);
    setError("");
    try {
      const sesion = await iniciarSesion(
        identificador,
        String(data.get("password") ?? ""),
      );
      if (!sesion) throw new Error("No se pudo establecer la sesión.");
      const contexto = await obtenerContextoAcceso();
      form.reset();
      window.location.replace(destinoAcceso(contexto.acceso));
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.status === 429
            ? "Demasiados intentos. Espera unos minutos antes de volver a intentar."
            : cause.status === 403
              ? "Tu cuenta no está habilitada o la contraseña temporal venció. Contacta al administrador."
              : cause.status === 400 || cause.status === 401
                ? "El correo, usuario o contraseña no son correctos."
                : "No pudimos iniciar sesión. Inténtalo de nuevo."
          : "No pudimos conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.",
      );
      ocupado.current = false;
      setEnviando(false);
    }
  }

  return (
    <>
      <p className={styles.kicker}>BIENVENIDO A FERRESAAS</p>
      <h2 className={styles.title}>Inicia sesión</h2>
      <p className={styles.description}>
        Ingresa a tu cuenta para continuar con tu negocio.
      </p>
      <form onSubmit={submit} className={styles.form} aria-busy={enviando}>
        <fieldset disabled={enviando} className={styles.fields}>
          <div className={styles.field}>
            <label htmlFor="identificador">Correo o nombre de usuario</label>
            <input
              id="identificador"
              name="identificador"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={254}
              placeholder="Ej. usuario@correo.com"
            />
          </div>
          <PasswordField id="password" label="Contraseña" />
        </fieldset>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <button type="submit" className={styles.primary} disabled={enviando}>
          {enviando ? "Iniciando sesión…" : "Iniciar sesión"}
          <span aria-hidden="true">→</span>
        </button>
      </form>
      <div className={styles.help}>
        <strong>¿Necesitas ayuda para entrar?</strong>
        <p>Contacta al administrador de tu ferretería.</p>
      </div>
    </>
  );
}
