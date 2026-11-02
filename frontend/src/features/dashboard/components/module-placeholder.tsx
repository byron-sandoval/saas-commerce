import Link from "next/link";
import type { NavigationItem } from "@/components/layout/navigation";
import { Icon } from "@/components/ui/icon";
import styles from "./dashboard.module.css";

export function ModulePlaceholder({ item }: { item: NavigationItem }) {
  return (
    <div className={styles.dashboard}>
      <div className={styles.pageHeading}>
        <div>
          <div className={styles.headingLine}>
            <h1>{item.label}</h1>
            <span className={styles.previewBadge}>En preparación</span>
          </div>
          <p>{item.description}</p>
        </div>
      </div>
      <section className={styles.modulePlaceholder}>
        <span className={styles.moduleIcon}>
          <Icon name={item.icon} size={35} />
        </span>
        <p className={styles.moduleEyebrow}>TU ESPACIO DE TRABAJO</p>
        <h2>Estamos preparando esta sección</h2>
        <p>
          La sección ya tiene su lugar en el panel. En la siguiente etapa
          incorporaremos sus pantallas y operaciones.
        </p>
        <Link href="/inicio">
          Volver al Dashboard <Icon name="arrow" size={16} />
        </Link>
      </section>
    </div>
  );
}
