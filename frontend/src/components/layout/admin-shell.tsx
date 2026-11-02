"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ContextoAcceso } from "@/features/auth/types";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { Icon } from "@/components/ui/icon";
import { SidebarNavigation } from "./sidebar-navigation";
import styles from "./admin-shell.module.css";

export function AdminShell({
  contexto,
  children,
}: {
  contexto: ContextoAcceso;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const drawer = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const userMenu = useRef<HTMLDetailsElement>(null);
  const initials = contexto.usuario.nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  useEffect(() => {
    function closeUserMenu(event: MouseEvent) {
      if (userMenu.current && !userMenu.current.contains(event.target as Node))
        userMenu.current.open = false;
    }
    document.addEventListener("click", closeUserMenu);
    return () => document.removeEventListener("click", closeUserMenu);
  }, []);

  useEffect(() => {
    if (!menuAbierto) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawer.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuAbierto(false);
        menuButton.current?.focus();
      }
      if (event.key === "Tab") {
        const elements = Array.from(
          drawer.current?.querySelectorAll<HTMLElement>(
            "a[href], button:not([disabled])",
          ) ?? [],
        ).filter((element) => element.getClientRects().length > 0);
        if (!elements?.length) return;
        const first = elements[0],
          last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKey);
    const desktop = window.matchMedia("(min-width: 801px)");
    function handleResize(event: MediaQueryListEvent) {
      if (event.matches) setMenuAbierto(false);
    }
    desktop.addEventListener("change", handleResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
      desktop.removeEventListener("change", handleResize);
    };
  }, [menuAbierto]);

  function closeDrawer() {
    setMenuAbierto(false);
    menuButton.current?.focus();
  }

  const sidebar = (mobile = false) => (
    <>
      <div className={styles.brand}>
        <button
          type="button"
          className={styles.brandIcon}
          aria-label={
            mobile
              ? "Ocultar menú"
              : sidebarCollapsed
                ? "Expandir menú lateral"
                : "Contraer menú lateral"
          }
          aria-expanded={mobile ? menuAbierto : !sidebarCollapsed}
          title={
            mobile
              ? "Ocultar menú"
              : sidebarCollapsed
                ? "Expandir menú lateral"
                : "Contraer menú lateral"
          }
          onClick={() =>
            mobile
              ? closeDrawer()
              : setSidebarCollapsed((collapsed) => !collapsed)
          }
        >
          <Icon name="menu" size={23} />
        </button>
        <Link
          href="/inicio"
          className={styles.brandLink}
          title={contexto.empresa?.nombre}
          onClick={closeDrawer}
        >
          {contexto.empresa?.nombre}
        </Link>
      </div>
      <p className={styles.navLabel}>MI FERRETERÍA</p>
      <SidebarNavigation
        key={pathname}
        onNavigate={closeDrawer}
        compact={!mobile && sidebarCollapsed}
        onExpand={() => setSidebarCollapsed(false)}
      />
      <div className={styles.sidebarFooter}>
        <div className={styles.workspaceIcon}>
          <Icon name="shield" size={18} />
        </div>
        <div>
          <strong>Espacio de administración</strong>
          <p>Todo tu negocio en un lugar</p>
        </div>
      </div>
    </>
  );

  return (
    <div
      className={`${styles.shell} ${sidebarCollapsed ? styles.sidebarCollapsed : ""}`}
    >
      <a href="#contenido-principal" className={styles.skipLink}>
        Saltar al contenido
      </a>
      <aside className={styles.sidebar}>{sidebar()}</aside>
      {menuAbierto && (
        <div className={styles.mobileBackdrop} onClick={closeDrawer}>
          <div
            ref={drawer}
            role="dialog"
            aria-modal="true"
            aria-label="Menú principal"
            className={styles.mobileSidebar}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.closeMenu}
              aria-label="Cerrar menú"
              onClick={closeDrawer}
            >
              <Icon name="close" />
            </button>
            {sidebar(true)}
          </div>
        </div>
      )}
      <div className={styles.workspace}>
        <header className={styles.header}>
          <div className={styles.breadcrumb}>
            <button
              ref={menuButton}
              type="button"
              className={styles.menuToggle}
              aria-label="Abrir menú"
              aria-expanded={menuAbierto}
              onClick={() => setMenuAbierto(true)}
            >
              <Icon name="menu" />
            </button>
          </div>
          <div className={styles.headerRight}>
            <details ref={userMenu} className={styles.userMenu}>
              <summary className={styles.profile}>
                <span className={styles.avatar}>{initials || "A"}</span>
                <span className={styles.profileText}>
                  <strong>{contexto.usuario.nombre}</strong>
                  <small>Administrador</small>
                </span>
                <Icon name="down" size={14} />
              </summary>
              <div className={styles.profileDropdown}>
                <strong>{contexto.usuario.nombre}</strong>
                <p>{contexto.empresa?.nombre}</p>
                <LogoutButton />
              </div>
            </details>
          </div>
        </header>
        <main id="contenido-principal" tabIndex={-1} className={styles.content}>
          {children}
        </main>
        <footer className={styles.pageFooter}>
          <span>
            FerreSaaS <span>·</span> Tu ferretería en la nube
          </span>
          <span>Panel de administración</span>
        </footer>
      </div>
    </div>
  );
}
