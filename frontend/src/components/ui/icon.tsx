import type { SVGProps } from "react";

const paths = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  cart: "M3 3h2l3 12h10l3-9H6 M9 21h.01 M18 21h.01",
  box: "m12 3 9 5-9 5-9-5 9-5z M3 8v9l9 5 9-5V8 M12 13v9 M7.5 5.5l9 5",
  warehouse: "m3 9 9-6 9 6v12H3V9z M7 21V11h10v10 M7 15h10 M7 18h10",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z",
  truck:
    "M1 4h13v13H1z M14 9h4l4 4v4h-8 M8 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M21 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  clipboard: "M9 5H5v16h14V5h-4 M9 3h6v4H9z M8 12h8 M8 16h5",
  cash: "M3 5h18v14H3z M3 9h18 M7 15h2 M15 15h2",
  credit: "M3 5h18v14H3z M3 10h18 M7 15h3",
  undo: "M9 4 3 10l6 6 M3 10h11a6 6 0 0 1 0 12",
  chart: "M4 3v18h17 M8 16v-5 M13 16V7 M18 16v-9",
  settings:
    "m9 3-1 3-3 1-2 3 2 2v3l3 2 1 3h5l1-3 3-2v-3l2-2-2-3-3-1-1-3H9z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  calendar: "M4 5h16v16H4z M8 3v4 M16 3v4 M4 11h16 M8 15h2 M14 15h2",
  chevron: "m9 5 7 7-7 7",
  down: "m6 9 6 6 6-6",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  close: "m6 6 12 12 M6 18 18 6",
  arrow: "M4 12h16 m-6-6 6 6-6 6",
  info: "M12 16v-4 M12 8h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z",
  money: "M12 2v20 M17 5H9a4 4 0 0 0 0 8h6a4 4 0 0 1 0 8H6",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3z m-4 9 3 3 5-6",
  tools:
    "m14 6 4 4 M4 20l9-9 M14 3a6 6 0 0 0-7 8l-5 5a3 3 0 0 0 4 4l5-5a6 6 0 0 0 8-7l-4 4-3-3 4-4z",
  store:
    "M3 10h18 M5 10v11h14V10 M9 21v-7h6v7 M3 10l2-7h14l2 7 M9 3l-1 7 M15 3l1 7",
  alert: "m12 3 10 18H2L12 3z M12 9v5 M12 17h.01",
} as const;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 20,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
