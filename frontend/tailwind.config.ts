import type { Config } from "tailwindcss";

/** Centralized design tokens. Components reference these, never raw hexes. */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // surfaces - warm ivory page, warm white cards
        canvas: "#f6f3ed",      // page behind the shell (warm ivory)
        shell: "#fffefb",       // app shell
        surface: "#fffdf8",     // cards - brighter than the page, never stark white
        subtle: "#f7f4ed",      // inset panels / muted fills
        line: "#e9e4d9",        // hairline borders (soft warm neutral)
        "line-strong": "#dad3c5",
        // text - warm-leaning neutrals for contrast on ivory
        heading: "#17150f",
        body: "#443f35",
        muted: "#6f6a5d",
        faint: "#807a69",
        // accent scale (emerald family)
        brand: {
          50: "#effaf3",
          100: "#d9f2e2",
          200: "#b4e5c9",
          300: "#7ed3a5",
          400: "#42b97c",
          500: "#1f9d5f",
          600: "#137d4b",
          700: "#0f6039",
          800: "#0d4d2f",
          900: "#0a3b25",
          950: "#052e19",
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
        card: "0 1px 2px rgba(38,32,20,0.04), 0 8px 24px -12px rgba(38,32,20,0.10)",
        "card-hover": "0 2px 4px rgba(38,32,20,0.05), 0 16px 32px -14px rgba(38,32,20,0.16)",
        lift: "0 12px 28px -12px rgba(38,32,20,0.20)",
        ring: "0 0 0 4px rgba(31,157,95,0.12)",
        modal: "0 24px 64px -16px rgba(38,32,20,0.32)",
      },
      transitionDuration: { fast: "150ms", DEFAULT: "200ms", slow: "250ms" },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(31,157,95,0.35)" },
          "70%": { boxShadow: "0 0 0 8px rgba(31,157,95,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(31,157,95,0)" },
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
