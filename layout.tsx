import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./painel.css";

export const metadata: Metadata = {
  title: "Instagram da Vitta · Painel de métricas",
  description: "Desempenho do Instagram @vittaemsaopaulo",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
