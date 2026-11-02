import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icon";
import styles from "./dashboard.module.css";

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

export function DashboardView() {
  return (
    <div className={styles.dashboard}>
      <div className={styles.pageHeading}>
        <div>
          <div className={styles.headingLine}>
            <h1>Dashboard</h1>
            <span className={styles.previewBadge}>Vista inicial</span>
          </div>
          <p>Resumen general de tu ferretería</p>
        </div>
        <span className={styles.period}>
          <Icon name="calendar" size={17} />
          Últimos 30 días
        </span>
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
      <div className={styles.previewNote}>
        <Icon name="info" size={15} />
        <p>
          Esta es la estructura de tu panel. Los indicadores y gráficos se
          mostrarán al conectar el resumen de tu ferretería.
        </p>
      </div>
      <div className={styles.charts}>
        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>Ventas por día</h2>
              <p>La evolución de tu negocio, de un vistazo</p>
            </div>
            <span className={styles.panelTag}>Resumen de ventas</span>
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
              <strong>Aquí verás tus ventas por día</strong>
              <p>El gráfico se completará con tus ventas registradas.</p>
            </div>
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
          <div className={styles.tableHeading}>
            <h2>
              <span className={`${styles.smallIcon} ${styles.accent}`}>
                <Icon name="cart" size={15} />
              </span>
              Últimas ventas
            </h2>
            <Link href="/ventas/historial">
              Ver ventas <Icon name="arrow" size={13} />
            </Link>
          </div>
          <div className={styles.tableScroll}>
            <table>
              <thead>
                <tr>
                  <th>N.º de venta</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4}>
                    <div className={styles.tableEmpty}>
                      <Icon name="clipboard" size={26} />
                      <strong>Tu actividad más reciente</strong>
                      <p>Las últimas ventas se mostrarán en este espacio.</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <div className={styles.quickAccess}>
        <span className={styles.quickIcon}>
          <Icon name="store" size={20} />
        </span>
        <div>
          <strong>Todo listo para organizar tu ferretería</strong>
          <p>
            Explora las secciones del menú y conoce tu nuevo espacio de trabajo.
          </p>
        </div>
        <Link href="/inventario/productos">
          Ir a productos <Icon name="arrow" size={15} />
        </Link>
      </div>
    </div>
  );
}
