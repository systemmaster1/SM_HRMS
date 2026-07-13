import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SM HRMS — Empowering People. Optimizing Talent.",
  description:
    "Human Resource Management System by SystemMaster. Attendance, leave, tasks and GPS-tracked field visits.",
  manifest: "/manifest.json",
  icons: { icon: "/icon.png", apple: "/icon.png" },
  appleWebApp: { capable: true, title: "SM HRMS", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#053A6E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
