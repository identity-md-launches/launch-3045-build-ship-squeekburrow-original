import type { CSSProperties } from "react";
export type IconName =
  | "leaf"
  | "shield"
  | "compass"
  | "moon"
  | "wood"
  | "heart"
  | "arrow"
  | "check"
  | "close"
  | "help"
  | "people"
  | "book"
  | "home"
  | "sun"
  | "cloud"
  | "refresh"
  | "lock"
  | "bolt"
  | "external"
  | "trophy"
  | "settings"
  | "seed";
const paths: Record<IconName, React.ReactNode> = {
  leaf: (
    <>
      <path d="M20 4C9 2 3 7 5 14c2 7 13 6 15-10Z" />
      <path d="M3 21 15 9M8 16l1-7m-1 7 7-1" />
    </>
  ),
  shield: (
    <>
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m16 8-2 6-6 2 2-6 6-2Z" />
    </>
  ),
  moon: <path d="M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z" />,
  wood: (
    <>
      <path d="m6 6 11 10M4 9l3-5 13 12-4 4L4 9Z" />
      <path d="m11 3 10 10M12 5l2-3 8 7-2 4" />
    </>
  ),
  heart: <path d="M20 5c-3-3-6-1-8 1C6-1-2 7 5 14l7 7 7-7c3-3 4-6 1-9Z" />,
  arrow: (
    <>
      <path d="M4 12h16m-6-6 6 6-6 6" />
    </>
  ),
  check: <path d="m5 12 4 4L20 5" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.5 1-1.5 1-1.5 3m0 3h.01" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 4c3 1 3 3 3 6" />
    </>
  ),
  book: (
    <>
      <path d="M12 6c-3-3-6-3-10-2v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-4-1-7-1-10 2v15Z" />
      <path d="m5 8 4 1m6 0 4-1m-4 5 4-1m-14 0 4 1" />
    </>
  ),
  home: (
    <>
      <path d="m2 11 10-8 10 8M5 9v12h14V9m-10 12v-8h6v8" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" />
    </>
  ),
  cloud: (
    <>
      <path d="M6 16a4 4 0 1 1 1-8 6 6 0 0 1 11 2 3 3 0 0 1 0 6H6Z" />
      <path d="m8 19-1 2m6-2-1 2m6-2-1 2" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7A9 9 0 1 0 21 15M20 3v5h-5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="3" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
    </>
  ),
  bolt: <path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z" />,
  external: (
    <>
      <path d="M13 3h8v8m0-8L10 14M9 3H4v17h17v-6" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 3h10v6a5 5 0 0 1-10 0V3Zm0 2H3v4c0 3 2 4 5 4m9-8h4v4c0 3-2 4-5 4m-4 1v6m-4 1h8" />
    </>
  ),
  settings: (
    <>
      <path d="m9 3-1 3-3 1 1 4-2 2 3 3 2-1 2 1 1 4h3l1-4 3-1 2-3-2-2 1-4-4-1-1-3H9Z" />
      <circle cx="12" cy="11" r="3" />
    </>
  ),
  seed: (
    <>
      <path d="M13 3c-7 1-10 5-9 10 2 7 10 9 14 4 5-6-2-11-5-14Z" />
      <path d="m8 17 5-9" />
    </>
  ),
};
export function Icon({
  name,
  size = 20,
  style,
  className = "",
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {paths[name]}
    </svg>
  );
}
