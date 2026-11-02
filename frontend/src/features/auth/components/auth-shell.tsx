import type { ReactNode } from "react";
import styles from "./auth.module.css";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className={styles.shell}>
      <aside className={styles.presentation}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>F</span>
          <span>
            FerreSaaS<small>Tu ferretería en la nube</small>
          </span>
        </div>
        <div className={styles.pitch}>
          <p className={styles.eyebrow}>HECHO PARA TU FERRETERÍA</p>
          <h1>
            Todo tu negocio.
            <br />
            <span>Un solo lugar.</span>
          </h1>
          <p>
            Del inventario a la caja, mantén el control de cada parte de tu
            ferretería.
          </p>
          <div className={styles.moduleList}>
            <span>
              01 <strong>Inventario al día</strong>
            </span>
            <span>
              02 <strong>Ventas y caja</strong>
            </span>
            <span>
              03 <strong>Tu equipo conectado</strong>
            </span>
          </div>
        </div>
        <p className={styles.asideFooter}>
          Más orden para tu negocio. Más tiempo para hacerlo crecer.
        </p>
      </aside>
      <section className={styles.formPanel}>
        <div className={styles.mobileBrand}>
          <span className={styles.brandMark}>F</span> FerreSaaS
        </div>
        <div className={styles.formContent}>{children}</div>
        <p className={styles.footer}>FerreSaaS · Gestión para ferreterías</p>
      </section>
    </main>
  );
}
