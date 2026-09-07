import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        ink: {
          950: "#08090c",
          900: "#0d0f14",
          850: "#12151c",
          800: "#171b24",
          700: "#222735",
          600: "#2e3446",
          500: "#3a4155",
        },
        accent: { DEFAULT: "#5b9dff", dim: "#3d6fbf" },
      },
    },
  },
  plugins: [],
};
export default config;
