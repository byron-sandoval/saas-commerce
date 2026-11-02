import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";
import styles from "./landing.module.css";

const modules: {
  name: string;
  icon: IconName;
  description: string;
  detail: string;
}[] = [
  {
    name: "Inventario",
    icon: "box",
    description: "Cada producto en su lugar.",
    detail:
      "Organiza tu catálogo por categorías y unidades. Consulta las existencias y el historial de movimientos.",
  },
  {
    name: "Ventas y clientes",
    icon: "cart",
    description: "Del mostrador al registro.",
    detail:
      "Registra ventas de contado o a crédito y conserva el detalle de cada operación y de tus clientes.",
  },
  {
    name: "Caja",
    icon: "cash",
    description: "Las cuentas claras, cada día.",
    detail:
      "Abre tu caja, consulta el efectivo esperado y registra el conteo al cerrar la jornada.",
  },
  {
    name: "Compras",
    icon: "clipboard",
    description: "Abastece tu negocio con orden.",
    detail:
      "Mantén tus proveedores organizados y registra las órdenes y la recepción de tus compras.",
  },
];

const questions = [
  {
    question: "¿FerreSaaS está pensado para mi ferretería?",
    answer:
      "Sí. La organización del sistema está pensada para ferreterías: productos por categorías, cantidades en unidades, metros, kilos o litros, ventas, compras y control de caja.",
  },
  {
    question: "¿Mi equipo tendrá el mismo acceso que yo?",
    answer:
      "No. El administrador gestiona su ferretería y las cuentas de su equipo. Los perfiles de cajero y bodeguero tienen permisos según su función.",
  },
  {
    question: "¿Cómo se manejan las ventas a crédito?",
    answer:
      "El administrador puede registrar una venta a crédito para un cliente. El sistema conserva el saldo pendiente y el historial de abonos de esa deuda.",
  },
  {
    question: "¿Ya puedo registrar una nueva ferretería?",
    answer:
      "El registro desde esta página estará disponible próximamente. Si ya tienes una cuenta, puedes entrar desde «Iniciar sesión» con tu correo o nombre de usuario y contraseña.",
  },
];

function Brand() {
  return (
    <a href="#inicio" className={styles.brand} aria-label="FerreSaaS, inicio">
      <span className={styles.brandIcon}>
        <Icon name="store" size={23} />
      </span>
      FerreSaaS<span className={styles.brandDot}>.</span>
    </a>
  );
}

function PanelPreview() {
  return (
    <figure
      className={styles.preview}
      aria-label="Ejemplo ilustrativo del panel de una ferretería"
    >
      <div className={styles.previewBar}>
        <span className={styles.windowDots}>
          <i />
          <i />
          <i />
        </span>
        <span>Tu ferretería en la nube</span>
        <Icon name="shield" size={14} />
      </div>
      <div className={styles.previewBody}>
        <div className={styles.previewSidebar} aria-hidden="true">
          <span className={styles.miniBrand}>
            <Icon name="store" size={20} />
          </span>
          {(
            [
              "dashboard",
              "box",
              "cart",
              "clipboard",
              "cash",
              "users",
            ] as IconName[]
          ).map((icon, index) => (
            <span
              key={icon}
              className={index === 0 ? styles.miniActive : undefined}
            >
              <Icon name={icon} size={17} />
            </span>
          ))}
        </div>
        <div className={styles.previewContent}>
          <div className={styles.previewHeading}>
            <div>
              <small>FERRETERÍA SAN JOSÉ</small>
              <h3>Así va tu negocio</h3>
            </div>
            <span className={styles.example}>Ejemplo</span>
          </div>
          <div className={styles.previewStats}>
            <div>
              <Icon name="cart" size={16} />
              <small>Ventas del día</small>
              <strong>
                C$ 8,450<span>.00</span>
              </strong>
            </div>
            <div>
              <Icon name="box" size={16} />
              <small>Productos</small>
              <strong>248</strong>
            </div>
            <div>
              <Icon name="cash" size={16} />
              <small>Estado de caja</small>
              <strong className={styles.openCash}>Abierta</strong>
            </div>
          </div>
          <div className={styles.previewChart}>
            <div>
              <strong>Ventas de la semana</strong>
              <span>Últimos 7 días</span>
            </div>
            <div className={styles.bars} aria-hidden="true">
              {[42, 64, 51, 79, 57, 91, 72].map((height, index) => (
                <span key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
            <div className={styles.chartDays} aria-hidden="true">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
          </div>
          <div className={styles.previewTable}>
            <div>
              <strong>Productos en inventario</strong>
              <Icon name="box" size={14} />
            </div>
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Existencias</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Cemento gris 42.5 kg</td>
                  <td>85 bolsas</td>
                  <td>
                    <span>Disponible</span>
                  </td>
                </tr>
                <tr>
                  <td>Tubo PVC de ½ pulgada</td>
                  <td>120 unidades</td>
                  <td>
                    <span>Disponible</span>
                  </td>
                </tr>
                <tr>
                  <td>Pintura blanca 1 galón</td>
                  <td>8 galones</td>
                  <td>
                    <span className={styles.lowStock}>Stock bajo</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <figcaption>Vista ilustrativa · Los datos son de ejemplo</figcaption>
    </figure>
  );
}

export function LandingPage() {
  return (
    <div className={styles.page} id="inicio">
      <a className={styles.skipLink} href="#contenido">
        Saltar al contenido
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Brand />
          <nav className={styles.desktopNav} aria-label="Navegación principal">
            <a href="#herramientas">Herramientas</a>
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#preguntas">Preguntas frecuentes</a>
          </nav>
          <div className={styles.headerActions}>
            <Link className={styles.loginLink} href="/iniciar-sesion">
              Iniciar sesión
            </Link>
            <a className={styles.headerCta} href="#registro">
              Registrar mi ferretería
              <Icon name="arrow" size={16} />
            </a>
          </div>
          <details className={styles.mobileMenu}>
            <summary aria-label="Abrir navegación">
              <Icon name="menu" size={23} />
            </summary>
            <nav aria-label="Navegación móvil">
              <a href="#herramientas">Herramientas</a>
              <a href="#como-funciona">Cómo funciona</a>
              <a href="#preguntas">Preguntas frecuentes</a>
              <a href="#registro">Registrar mi ferretería</a>
            </nav>
          </details>
        </div>
      </header>
      <main id="contenido">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>
                <span />
                HECHO PARA FERRETERÍAS
              </p>
              <h1 id="hero-title">
                Tu negocio crece.
                <br />
                El desorden <em>no tiene que hacerlo.</em>
              </h1>
              <p className={styles.heroDescription}>
                Productos, ventas, compras y caja. Dale a tu ferretería un lugar
                donde todo encaje.
              </p>
              <div className={styles.heroActions}>
                <a className={styles.primary} href="#registro">
                  Registrar mi ferretería
                  <Icon name="arrow" size={19} />
                </a>
                <a className={styles.textLink} href="#herramientas">
                  Conocer el sistema
                  <Icon name="down" size={15} />
                </a>
              </div>
              <p className={styles.heroNote}>
                <Icon name="store" size={16} />
                Tu ferretería. Tu equipo. Un solo lugar.
              </p>
            </div>
            <div className={styles.heroVisual}>
              <div className={styles.visualLabel}>
                <span>MENOS PAPELEO. MÁS CONTROL.</span>
                <span>01 / TU NEGOCIO</span>
              </div>
              <PanelPreview />
              <div className={styles.visualFooter}>
                <span className={styles.statusDot} />
                Cada movimiento cuenta.
              </div>
            </div>
          </div>
        </section>
        <div className={styles.moduleStrip} aria-label="Áreas del sistema">
          <div>
            {(
              [
                ["box", "Inventario"],
                ["cart", "Ventas"],
                ["clipboard", "Compras"],
                ["cash", "Caja"],
                ["credit", "Créditos"],
              ] as [IconName, string][]
            ).map(([icon, name]) => (
              <span key={name}>
                <Icon name={icon} size={20} />
                {name}
              </span>
            ))}
          </div>
        </div>
        <section
          className={styles.toolsSection}
          id="herramientas"
          aria-labelledby="tools-title"
        >
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.eyebrow}>LAS HERRAMIENTAS DE CADA DÍA</p>
              <h2 id="tools-title">
                Del almacén al mostrador,
                <br />
                todo tiene su lugar.
              </h2>
            </div>
            <p>
              No necesitas perder de vista una parte del negocio para atender
              otra. Conecta las operaciones que mueven tu ferretería.
            </p>
          </div>
          <div className={styles.moduleGrid}>
            {modules.map((module, index) => (
              <article className={styles.module} key={module.name}>
                <div className={styles.moduleTop}>
                  <span className={styles.moduleIcon}>
                    <Icon name={module.icon} size={25} />
                  </span>
                  <span>0{index + 1}</span>
                </div>
                <p className={styles.moduleName}>{module.name}</p>
                <h3>{module.description}</h3>
                <p>{module.detail}</p>
              </article>
            ))}
          </div>
        </section>
        <section className={styles.teamSection} aria-labelledby="team-title">
          <div className={styles.teamVisual}>
            <div className={styles.teamVisualHeading}>
              <Icon name="store" size={21} />
              <span>Una ferretería, un equipo.</span>
            </div>
            <div className={styles.member}>
              <span className={styles.memberAvatar}>AD</span>
              <div>
                <strong>Administrador</strong>
                <small>La visión completa de tu negocio</small>
              </div>
              <Icon name="shield" size={21} />
            </div>
            <div className={styles.member}>
              <span className={styles.memberAvatar}>CA</span>
              <div>
                <strong>Cajero</strong>
                <small>Ventas, cobros y su caja</small>
              </div>
              <Icon name="cash" size={21} />
            </div>
            <div className={styles.member}>
              <span className={styles.memberAvatar}>BO</span>
              <div>
                <strong>Bodeguero</strong>
                <small>Inventario, compras y proveedores</small>
              </div>
              <Icon name="box" size={21} />
            </div>
            <p>Acceso según las responsabilidades de cada persona.</p>
          </div>
          <div className={styles.teamCopy}>
            <p className={styles.eyebrow}>CADA PERSONA, SU FUNCIÓN</p>
            <h2>
              Tu equipo trabaja.
              <br />
              Tú mantienes el control.
            </h2>
            <p>
              Administra las cuentas de tus colaboradores y asigna el perfil que
              corresponde a su trabajo. Los permisos acompañan a cada operación.
            </p>
            <ul>
              <li>
                <Icon name="shield" size={19} />
                Información separada para cada ferretería.
              </li>
              <li>
                <Icon name="users" size={19} />
                Cuentas individuales para tu equipo.
              </li>
              <li>
                <Icon name="clipboard" size={19} />
                Historial de las operaciones de tu negocio.
              </li>
            </ul>
          </div>
        </section>
        <section
          className={styles.stepsSection}
          id="como-funciona"
          aria-labelledby="steps-title"
        >
          <p className={styles.eyebrow}>UN COMIENZO CON ORDEN</p>
          <h2 id="steps-title">Así será empezar con FerreSaaS.</h2>
          <div className={styles.steps}>
            <article>
              <span>01</span>
              <h3>Registra tu ferretería</h3>
              <p>
                Crea tu cuenta e ingresa los datos de tu negocio. Tendrás el
                acceso de administrador.
              </p>
            </article>
            <article>
              <span>02</span>
              <h3>Organiza lo que vendes</h3>
              <p>
                Agrega tus productos, categorías, unidades de medida, clientes y
                proveedores.
              </p>
            </article>
            <article>
              <span>03</span>
              <h3>Comienza tu jornada</h3>
              <p>
                Abre tu caja y registra tus operaciones. Mantén a mano el
                historial de tu ferretería.
              </p>
            </article>
          </div>
          <p className={styles.stepsNote}>
            El registro de nuevas ferreterías estará disponible próximamente.
          </p>
        </section>
        <section
          className={styles.faqSection}
          id="preguntas"
          aria-labelledby="faq-title"
        >
          <div>
            <p className={styles.eyebrow}>ANTES DE COMENZAR</p>
            <h2 id="faq-title">Las cosas claras.</h2>
            <p>Algunas respuestas para conocer mejor el sistema.</p>
          </div>
          <div className={styles.questions}>
            {questions.map(({ question, answer }) => (
              <details key={question}>
                <summary>
                  {question}
                  <Icon name="down" size={18} />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section
          className={styles.registerSection}
          id="registro"
          aria-labelledby="register-title"
        >
          <div>
            <p className={styles.registerEyebrow}>
              EL SIGUIENTE PASO PARA TU NEGOCIO
            </p>
            <h2 id="register-title">
              Una ferretería más ordenada
              <br />
              empieza aquí.
            </h2>
            <p>
              Estamos preparando el registro de nuevas ferreterías.
              <br />
              Próximamente podrás crear tu cuenta desde esta página.
            </p>
          </div>
          <div className={styles.registerAction}>
            <span className={styles.comingSoon}>Registro próximamente</span>
            <p>¿Ya tienes tu cuenta?</p>
            <Link href="/iniciar-sesion" className={styles.lightButton}>
              Iniciar sesión
              <Icon name="arrow" size={18} />
            </Link>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <div>
          <Brand />
          <p>Tu ferretería en la nube.</p>
        </div>
        <nav aria-label="Navegación del pie de página">
          <a href="#herramientas">Herramientas</a>
          <a href="#preguntas">Preguntas frecuentes</a>
          <Link href="/iniciar-sesion">Iniciar sesión</Link>
        </nav>
        <p>Hecho para el trabajo de cada día.</p>
      </footer>
    </div>
  );
}
