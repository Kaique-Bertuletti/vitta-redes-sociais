import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./painel.css";
import "./hub.css";
import { Navigation } from "./navigation";

export const metadata: Metadata = {
  title: "Vitta Marketing Hub 2.0",
  description: "Desempenho do Instagram @vittaemsaopaulo",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="light">
      <body><Navigation/><div className="hub-content">{children}</div></body>
    </html>
  );
}
