"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import styles from "./dashboard.module.css";

export function SalesChart() {
  const [agrupacion, setAgrupacion] = useState<"dia" | "mes">("dia");

  return (
    <section className={styles.panel}>
      <div className={`${styles.panelHeading} ${styles.salesHeading}`}>
        <div>
          <h2>Ventas por {agrupacion === "dia" ? "día" : "mes"}</h2>
          <p>La evolución de tu negocio, de un vistazo</p>
        </div>
        <div
          className={styles.chartPeriod}
          role="group"
          aria-label="Agrupar ventas"
        >
          <button
            type="button"
            aria-pressed={agrupacion === "dia"}
            onClick={() => setAgrupacion("dia")}
          >
            Día
          </button>
          <button
            type="button"
            aria-pressed={agrupacion === "mes"}
            onClick={() => setAgrupacion("mes")}
          >
            Mes
          </button>
        </div>
      </div>
      <div className={styles.lineChart}>
        <div className={styles.chartGrid} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className={styles.chartEmpty}>
          <span className={styles.emptyIcon}>
            <Icon name="chart" size={25} />
          </span>
          <strong>
            Aquí verás tus ventas por {agrupacion === "dia" ? "día" : "mes"}
          </strong>
          <p>El gráfico se completará con tus ventas registradas.</p>
        </div>
      </div>
    </section>
  );
}
