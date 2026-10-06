import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Gestão de Células", description: "Acompanhamento de células e reuniões da igreja" };
export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
