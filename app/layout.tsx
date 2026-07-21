import type { Metadata } from "next";
import { Manrope, Newsreader } from "next/font/google";
import { siteConfig } from "@/config/site";
import { adminThemeInitScript } from "@/lib/admin-theme-script";
import { assertProductionSecrets } from "@/lib/env/env.server";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-newsreader",
  style: ["normal", "italic"],
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
    <html
      lang="es"
      className={`${manrope.variable} ${newsreader.variable} light h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: adminThemeInitScript }} />
      </head>
      <body className="min-h-full overflow-x-hidden bg-[var(--background)] font-sans text-[var(--foreground)]">
        {children}
      </body>
    </html>
  );
}
