import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icon";
import styles from "./dashboard.module.css";
import { DashboardCalendar, type CalendarDate } from "./dashboard-calendar";
import { SalesChart } from "./sales-chart";

const indicators: {
  label: string;
  icon: IconName;
  color: string;
  note: string;
}[] = [
  {
    label: "Ventas totales",
    icon: "money",
    color: "green",
    note: "Importe de ventas del período",
  },
  {
    label: "Número de ventas",
    icon: "cart",
    color: "accent",
    note: "Ventas registradas en el período",
  },
  {
    label: "Productos en inventario",
    icon: "box",
    color: "amber",
    note: "Productos de tu catálogo",
  },
  {
    label: "Clientes registrados",
    icon: "users",
    color: "violet",
    note: "Clientes de tu ferretería",
  },
];

export function DashboardView({
  nombreUsuario,
  hoy,
}: {
  nombreUsuario: string;
  hoy: CalendarDate;
}) {
  return (
    <div className={styles.dashboard}>
      <div className={styles.pageHeading}>
        <div>
          <div className={styles.headingLine}>
            <h1>👋 Bienvenido(a), {nombreUsuario}</h1>
          </div>
          <p>Resumen general de tu ferretería</p>
        </div>
      </div>
      <div className={styles.indicators}>
        {indicators.map((item) => (
          <section
            key={item.label}
            className={styles.indicator}
            aria-label={item.label}
          >
            <div className={`${styles.indicatorIcon} ${styles[item.color]}`}>
              <Icon name={item.icon} size={23} />
            </div>
            <div>
              <h2>{item.label}</h2>
              <strong className={styles.metricValue}>—</strong>
              <p>{item.note}</p>
            </div>
          </section>
        ))}
      </div>
      <div className={styles.charts}>
        <SalesChart />
        <section className={styles.panel} aria-label="Calendario">
          <DashboardCalendar hoy={hoy} />
        </section>
      </div>
      <div className={styles.tables}>
        <section className={styles.panel}>
          <div className={styles.tableHeading}>
            <h2>
              <span className={`${styles.smallIcon} ${styles.red}`}>
                <Icon name="alert" size={15} />
              </span>
              Productos con bajo stock
            </h2>
            <Link href="/inventario/existencias">
              Ver inventario <Icon name="arrow" size={13} />
            </Link>
          </div>
          <div className={styles.tableScroll}>
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Producto</th>
                  <th>Stock actual</th>
                  <th>Stock mínimo</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4}>
                    <div className={styles.tableEmpty}>
                      <Icon name="box" size={26} />
                      <strong>El inventario bajo control</strong>
                      <p>
                        Aquí aparecerán los productos que necesiten reposición.
                      </p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>Ventas por categoría</h2>
              <p>Conoce qué mueve tu negocio</p>
            </div>
          </div>
          <div className={styles.categoryChart}>
            <div
              className={styles.donut}
              aria-label="Gráfico por categorías pendiente de datos"
            >
              <div>
                <strong>—</strong>
                <span>Total de ventas</span>
              </div>
            </div>
            <div className={styles.categoryLegend}>
              <span className={styles.legendDot} />
              <div>
                <strong>Tus categorías</strong>
                <p>Distribución por conectar</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
