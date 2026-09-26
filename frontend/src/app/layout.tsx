import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JB Ecosolar | Simulador de Economia",
  description: "Protótipo funcional do MVP da JB Ecosolar",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
