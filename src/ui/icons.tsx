import type { SVGProps } from "react";

/** Jednoduché liniové ikony (SVG, žádné emoji). Dekorativní: popis nese text tlačítka. */
const base: SVGProps<SVGSVGElement> = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export const IconSun = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
export const IconArrow = ({ back = false }: { back?: boolean }) => (
  <svg {...base} style={back ? { transform: "rotate(180deg)" } : undefined}><path d="M4 12h16m-6-6 6 6-6 6" /></svg>
);
export const IconSettings = () => (
  <svg {...base}><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2" fill="var(--surface)" /><circle cx="15" cy="17" r="2" fill="var(--surface)" /></svg>
);
export const IconMoon = () => (
  <svg {...base}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
  </svg>
);
export const IconRoof = () => (
  <svg {...base}>
    <path d="M3 12 12 4l9 8M6 10v9h12v-9" />
  </svg>
);
export const IconRuler = () => (
  <svg {...base}>
    <path d="M3 17 17 3l4 4L7 21z" />
    <path d="m7 13 2 2M10 10l2 2M13 7l2 2" />
  </svg>
);
export const IconReset = () => (
  <svg {...base}>
    <path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4" />
  </svg>
);
export const IconHand = () => (
  <svg {...base}>
    <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a5 5 0 0 1-4-2l-2.5-3.5a1.5 1.5 0 0 1 2.3-1.9L8 15" />
  </svg>
);
export const IconChevron = ({ open }: { open: boolean }) => (
  <svg {...base} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 150ms" }}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const IconBuild = () => (
  <svg {...base}>
    <path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6" />
  </svg>
);
export const IconEye = () => (
  <svg {...base}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
export const IconTraffic = () => (
  <svg {...base}>
    <path d="M3 15h18l-1.6-5.2A2 2 0 0 0 17.5 8.4h-11a2 2 0 0 0-1.9 1.4L3 15zM5 15v3M19 15v3" />
    <circle cx="7.5" cy="12.5" r="0.6" />
    <circle cx="16.5" cy="12.5" r="0.6" />
  </svg>
);
export const IconPlay = () => (
  <svg {...base}>
    <path d="M7 4.5v15l12-7.5z" />
  </svg>
);
export const IconSkip = () => (
  <svg {...base}>
    <path d="M5 5v14l9-7zM18 5v14" />
  </svg>
);
