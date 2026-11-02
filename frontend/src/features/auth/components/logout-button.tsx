"use client";

import { useState } from "react";
import { cerrarSesion } from "../api";
import styles from "./auth.module.css";

export function LogoutButton() {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  async function salir() {
    setOcupado(true);
    setError("");
    try {
      await cerrarSesion();
      window.location.replace("/iniciar-sesion");
    } catch {
      setError("No se pudo cerrar la sesión. Inténtalo de nuevo.");
      setOcupado(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        className={styles.secondary}
        disabled={ocupado}
        onClick={salir}
      >
        {ocupado ? "Cerrando sesión…" : "Cerrar sesión"}
      </button>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
