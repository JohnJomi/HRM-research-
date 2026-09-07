import type { Metadata } from "next";
import { Mulish } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

/** Body / UI face. Variable, so one download covers every weight in use. */
const mulish = Mulish({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

/**
 * Display face. Arima Madurai is absent from next/font/google's catalog in
 * Next 14, so the two weights we use are self-hosted from Google's own latin
 * subset via next/font/local - same self-hosting and no layout-shift handling
 * as the google loader, no runtime CSS import.
 */
const arimaMadurai = localFont({
  src: [
    { path: "./fonts/ArimaMadurai-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ArimaMadurai-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HRM Lab — Local ARC Reasoning",
  description: "Local Hierarchical Reasoning Model inference on ARC tasks",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mulish.variable} ${arimaMadurai.variable}`}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
