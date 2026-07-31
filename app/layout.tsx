import type { Metadata } from "next";
import { Manrope, Newsreader, Plus_Jakarta_Sans } from "next/font/google";
import { siteConfig } from "@/config/site";
import { DocumentThemeScope } from "@/components/theme/DocumentThemeScope.client";
import { adminThemeInitScript } from "@/lib/admin-theme-script";
import { assertProductionSecrets } from "@/lib/env/env.server";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
  weight: ["300", "400", "500", "600", "700"],
});

const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-newsreader",
  style: ["normal", "italic"],
});

/** SaaS geometric — estética tipo Rockads (auth/landing light) */
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
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
      className={`${manrope.variable} ${newsreader.variable} ${plusJakarta.variable} light h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: adminThemeInitScript }} />
      </head>
      <body className="min-h-full overflow-x-hidden bg-[var(--background)] font-sans text-[var(--foreground)]">
        <DocumentThemeScope />
        {children}
      </body>
    </html>
  );
}
