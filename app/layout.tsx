import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { assertProductionSecrets } from "@/lib/env/env.server";
import "./globals.css";

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  assertProductionSecrets();

  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full overflow-x-hidden bg-[#f5f7fb] font-sans text-[#0f172a]">
        {children}
      </body>
    </html>
  );
}
