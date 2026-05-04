import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hibot Interactions Dashboard",
  description: "Dashboard analítico para planillas de interacciones",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="dark">
      <body>{children}</body>
    </html>
  );
}
