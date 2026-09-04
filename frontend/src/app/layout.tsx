import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JB Ecosolar | Simulador de Economia",
  description: "Protótipo funcional do MVP da JB Ecosolar",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="icon" href="/favicon.ico?v=2" type="image/x-icon" sizes="32x32" />
      </head>
      <body>{children}</body>
    </html>
  );
}
