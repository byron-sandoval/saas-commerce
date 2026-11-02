"use client";

import { useState } from "react";
import styles from "./auth.module.css";

export function PasswordField({
  id,
  label,
  autoComplete = "current-password",
  minLength,
}: {
  id: string;
  label: string;
  autoComplete?: "current-password" | "new-password";
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.password}>
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={minLength}
          maxLength={128}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={`${visible ? "Ocultar" : "Mostrar"} ${label.toLowerCase()}`}
          aria-controls={id}
          aria-pressed={visible}
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
    </div>
  );
}
