"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import styles from "./dashboard-calendar.module.css";

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function DashboardCalendar({ hoy }: { hoy: CalendarDate }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const first = new Date(hoy.year, hoy.month + monthOffset, 1);
  const year = first.getFullYear();
  const month = first.getMonth();
  const start = (first.getDay() + 6) % 7;
  const title = first.toLocaleDateString("es-NI", {
    month: "long",
    year: "numeric",
  });
  // Seis semanas mantienen estable la altura incluso al cambiar de mes.
  const weeks = Array.from({ length: 6 }, (_, week) =>
    Array.from(
      { length: 7 },
      (_, day) => new Date(year, month, week * 7 + day - start + 1),
    ),
  );

  return (
    <div className={styles.calendar}>
      <div className={styles.heading}>
        <h2 aria-live="polite" aria-atomic="true">
          {title}
        </h2>
        <div className={styles.navigation}>
          <button
            type="button"
            aria-label="Mes anterior"
            disabled={year <= 1900 && month === 0}
            onClick={() => setMonthOffset((offset) => offset - 1)}
          >
            <Icon name="chevron" size={16} className={styles.previous} />
          </button>
          <button
            type="button"
            aria-label="Mes siguiente"
            disabled={year >= 2100 && month === 11}
            onClick={() => setMonthOffset((offset) => offset + 1)}
          >
            <Icon name="chevron" size={16} />
          </button>
        </div>
      </div>
      <div className={styles.toolbar}>
        <span>
          <Icon name="calendar" size={14} />
          Calendario
        </span>
        <button type="button" onClick={() => setMonthOffset(0)}>
          Hoy
        </button>
      </div>
      <table className={styles.month}>
        <caption className={styles.srOnly}>{title}</caption>
        <thead>
          <tr>
            {weekdays.map((day) => (
              <th key={day} scope="col">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, index) => (
            <tr key={index}>
              {week.map((date) => {
                const isToday =
                  date.getFullYear() === hoy.year &&
                  date.getMonth() === hoy.month &&
                  date.getDate() === hoy.day;
                const outside = date.getMonth() !== month;
                const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                return (
                  <td
                    key={iso}
                    className={outside ? styles.outside : undefined}
                  >
                    <time
                      dateTime={iso}
                      aria-current={isToday ? "date" : undefined}
                      className={isToday ? styles.today : undefined}
                    >
                      {date.getDate()}
                    </time>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
