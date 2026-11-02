"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { navigationMenu } from "./navigation";
import styles from "./admin-shell.module.css";

export function SidebarNavigation({
  onNavigate,
  compact = false,
  onExpand,
}: {
  onNavigate: () => void;
  compact?: boolean;
  onExpand?: () => void;
}) {
  const pathname = usePathname();
  const id = useId();
  const [expanded, setExpanded] = useState<
    Record<string, { pathname: string; open: boolean }>
  >({});

  return (
    <nav className={styles.navigation} aria-label="Menú principal">
      {navigationMenu.map((entry, index) => {
        if (!("items" in entry))
          return (
            <Link
              key={entry.href}
              href={entry.href}
              prefetch={false}
              onClick={onNavigate}
              aria-label={entry.label}
              title={compact ? entry.label : undefined}
              aria-current={pathname === entry.href ? "page" : undefined}
              className={`${styles.navItem} ${pathname === entry.href ? styles.active : ""}`}
            >
              <Icon name={entry.icon} size={18} />
              <span>{entry.label}</span>
              {pathname === entry.href && <span className={styles.activeDot} />}
            </Link>
          );

        const active = entry.items.some((item) => item.href === pathname);
        const override = expanded[entry.label];
        // Al cambiar de ruta se abre su grupo sin sobrescribir estado desde un efecto.
        const open = override?.pathname === pathname ? override.open : active;
        const panelId = `${id}-grupo-${index}`;
        return (
          <div key={entry.label} className={styles.navGroup}>
            <button
              type="button"
              className={`${styles.navItem} ${styles.groupButton} ${active ? styles.activeGroup : ""}`}
              aria-expanded={!compact && open}
              aria-label={entry.label}
              title={compact ? entry.label : undefined}
              aria-controls={panelId}
              onClick={() => {
                if (compact) onExpand?.();
                setExpanded((previous) => ({
                  ...previous,
                  [entry.label]: { pathname, open: compact ? true : !open },
                }));
              }}
            >
              <Icon name={entry.icon} size={18} />
              <span>{entry.label}</span>
              <span
                className={`${styles.groupChevron} ${open ? styles.groupChevronOpen : ""}`}
              >
                <Icon name="down" size={14} />
              </span>
            </button>
            <ul
              id={panelId}
              hidden={compact || !open}
              className={styles.submenu}
            >
              {entry.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch={false}
                    onClick={onNavigate}
                    aria-current={pathname === item.href ? "page" : undefined}
                    className={`${styles.submenuLink} ${pathname === item.href ? styles.submenuActive : ""}`}
                  >
                    <span>{item.label}</span>
                    {pathname === item.href && (
                      <span className={styles.activeDot} />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
