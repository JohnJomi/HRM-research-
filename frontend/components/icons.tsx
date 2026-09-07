/** Lightweight inline SVG icons - no icon-library dependency. */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export const IconDashboard = (p: P) => (
  <svg {...base} {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
);
export const IconPlus = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8.5v7M8.5 12h7" /></svg>
);
export const IconLibrary = (p: P) => (
  <svg {...base} {...p}><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h5l2 2h7A1.5 1.5 0 0 1 20 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3 17.5z" /></svg>
);
export const IconChart = (p: P) => (
  <svg {...base} {...p}><path d="M5 20V11M12 20V5M19 20v-6" /></svg>
);
export const IconSettings = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-1 1.46V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 4.72 15a1.6 1.6 0 0 0-1.46-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.6 1.6 0 0 0 9 4.72h.08A1.6 1.6 0 0 0 10 3.26V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.46 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.6 1.6 0 0 0 19.4 9v.08a1.6 1.6 0 0 0 1.46 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></svg>
);
export const IconHelp = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.3" /><path d="M12 17h.01" /></svg>
);
export const IconInfo = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
);
export const IconSearch = (p: P) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
);
export const IconBell = (p: P) => (
  <svg {...base} {...p}><path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" /><path d="M13.7 20a2 2 0 0 1-3.4 0" /></svg>
);
export const IconActivity = (p: P) => (
  <svg {...base} {...p}><path d="M3 12h3.5l2-6 4 12 2.5-6H21" /></svg>
);
export const IconUpload = (p: P) => (
  <svg {...base} {...p}><path d="M12 16V5" /><path d="m8 9 4-4 4 4" /><path d="M4 15v2.5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V15" /></svg>
);
export const IconFile = (p: P) => (
  <svg {...base} {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
);
export const IconEye = (p: P) => (
  <svg {...base} {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12" /><circle cx="12" cy="12" r="3" /></svg>
);
export const IconPlay = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M8 5.5v13a1 1 0 0 0 1.54.84l10-6.5a1 1 0 0 0 0-1.68l-10-6.5A1 1 0 0 0 8 5.5" /></svg>
);
export const IconArrowRight = (p: P) => (
  <svg {...base} {...p}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
);
export const IconChevronDown = (p: P) => (
  <svg {...base} {...p}><path d="m6 9 6 6 6-6" /></svg>
);
export const IconCheck = (p: P) => (
  <svg {...base} {...p}><path d="m5 13 4.5 4.5L19 7" /></svg>
);
export const IconCheckCircle = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}><circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15" /><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" /><path d="m8 12.3 2.6 2.6L16 9.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const IconAlert = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16h.01" /></svg>
);
export const IconExpand = (p: P) => (
  <svg {...base} {...p}><path d="M9 4H4v5M15 20h5v-5M20 9V4h-5M4 15v5h5" /></svg>
);
export const IconClose = (p: P) => (
  <svg {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconClock = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.2 1.9" /></svg>
);
export const IconLayers = (p: P) => (
  <svg {...base} {...p}><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></svg>
);
export const IconChip = (p: P) => (
  <svg {...base} {...p}><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M4 10h3M4 14h3M17 10h3M17 14h3M10 4v3M14 4v3M10 17v3M14 17v3" /></svg>
);
export const IconType = (p: P) => (
  <svg {...base} {...p}><path d="m9 8-5 4 5 4M15 8l5 4-5 4" /></svg>
);
export const IconCode = (p: P) => (
  <svg {...base} {...p}><path d="m9 7-5 5 5 5M15 7l5 5-5 5" /></svg>
);
export const IconDatabase = (p: P) => (
  <svg {...base} {...p}><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>
);
export const IconGrid = (p: P) => (
  <svg {...base} {...p}><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" /></svg>
);
export const IconShield = (p: P) => (
  <svg {...base} {...p}><path d="M12 3 5 6v6c0 4.2 2.9 7.9 7 9 4.1-1.1 7-4.8 7-9V6z" /></svg>
);
export const IconCpu = (p: P) => (
  <svg {...base} {...p}><rect x="5" y="5" width="14" height="14" rx="3" /><rect x="9.5" y="9.5" width="5" height="5" rx="1" /></svg>
);
export const IconPulse = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M7.5 12h2l1.5-3 2 6 1.5-3h2" /></svg>
);
export const IconQuote = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M9 7H5.5A2.5 2.5 0 0 0 3 9.5V12a2.5 2.5 0 0 0 2.5 2.5H7c0 1.4-.9 2.3-2 2.5v2c2.9-.3 5-2.6 5-5.7V8a1 1 0 0 0-1-1m11 0h-3.5A2.5 2.5 0 0 0 14 9.5V12a2.5 2.5 0 0 0 2.5 2.5H18c0 1.4-.9 2.3-2 2.5v2c2.9-.3 5-2.6 5-5.7V8a1 1 0 0 0-1-1" /></svg>
);
export const IconSpinner = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" {...p}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);
