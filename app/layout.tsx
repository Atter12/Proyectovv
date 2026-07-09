import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { siteConfig } from "@/config/site";
import { assertProductionSecrets } from "@/lib/env/env.server";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

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
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full overflow-x-hidden bg-[#F6F8FB] font-sans text-slate-950">
        {children}
      </body>
    </html>
  );
}
