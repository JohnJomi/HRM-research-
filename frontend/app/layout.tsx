import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HRM ARC Workstation",
  description: "Local Hierarchical Reasoning Model inference on ARC tasks",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen text-slate-200 antialiased">{children}</body>
    </html>
  );
}
