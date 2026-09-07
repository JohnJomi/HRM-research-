import type { Config } from "tailwindcss";

/** Centralized design tokens. Components reference these, never raw hexes. */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // surfaces - warm parchment page, light warm cards above it
        canvas: "#d9cbb6",      // #D9CBB6 primary warm background
        shell: "#fbf8f2",       // app shell, lighter than the page
        surface: "#fdfaf4",     // cards - clearly lighter than the background
        subtle: "#f2ece0",      // inset panels / muted fills
        line: "#d5c7ac",        // hairline borders (#BFAE8F, lightened)
        "line-strong": "#bfae8f", // #BFAE8F secondary warm neutral
        // text - forest green instead of black
        heading: "#2e3b33",     // #2E3B33 dark forest
        body: "#3f4d43",
        muted: "#5c6b5f",       // darkened sage: #7A8F73 fails contrast at UI sizes
        faint: "#7d7566",
        // accent scale built from the sage / deep-sage / forest triple
        brand: {
          50: "#eff3ed",
          100: "#dde5da",
          200: "#c3d0bf",
          300: "#a3b79e",
          400: "#7a8f73",       // #7A8F73 sage - secondary accent, icons, hovers
          500: "#4f6b57",       // #4F6B57 deep sage - PRIMARY accent
          600: "#45604d",
          700: "#3c5444",
          800: "#35483b",
          900: "#2e3b33",       // #2E3B33 dark forest
          950: "#232d27",
        },
        danger: { 50: "#fef2f2", 200: "#fecaca", 500: "#dc2626", 700: "#b91c1c" },
        warn: { 50: "#fffbeb", 200: "#fde68a", 600: "#d97706" },
      },
      borderRadius: {
        card: "16px",
        panel: "12px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(46,59,51,0.04), 0 8px 24px -12px rgba(46,59,51,0.10)",
        "card-hover": "0 2px 4px rgba(46,59,51,0.05), 0 16px 32px -14px rgba(46,59,51,0.16)",
        lift: "0 12px 28px -12px rgba(46,59,51,0.20)",
        ring: "0 0 0 4px rgba(79,107,87,0.16)",
        modal: "0 24px 64px -16px rgba(46,59,51,0.32)",
      },
      transitionDuration: { fast: "150ms", DEFAULT: "200ms", slow: "250ms" },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(79,107,87,0.38)" },
          "70%": { boxShadow: "0 0 0 8px rgba(79,107,87,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(79,107,87,0)" },
        },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-up": "fade-up 300ms ease-out both",
        "fade-in": "fade-in 250ms ease-out both",
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.4,0,0.6,1) infinite",
      },
    },
  },
  plugins: [],
};
export default config;
