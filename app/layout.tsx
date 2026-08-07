import type { Metadata } from "next";
import { Alegreya_Sans, Literata, Plus_Jakarta_Sans } from "next/font/google";
import { siteConfig } from "@/config/site";
import { DocumentThemeScope } from "@/components/theme/DocumentThemeScope.client";
import { adminThemeInitScript } from "@/lib/admin-theme-script";
import { criticalCss, cssLoadGuardScript } from "@/lib/critical-css";
import { assertProductionSecrets } from "@/lib/env/env.server";
import "./globals.css";

/** Dashboard / auth UI — liviana. */
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700"],
  fallback: [
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ],
  adjustFontFallback: true,
});

/** Landing (Exquisitus → Holistic): register sans. */
const alegreyaSans = Alegreya_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-alegreya",
  weight: ["400", "500", "700"],
  fallback: ["system-ui", "Arial", "sans-serif"],
  adjustFontFallback: true,
});

/** Landing: reading serif. */
const literata = Literata({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-literata",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  fallback: ["Georgia", "Times New Roman", "serif"],
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: "/apple-icon.png",
  },
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
      className={`${plusJakarta.variable} ${alegreyaSans.variable} ${literata.variable} light h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Fallback usable si el CSS de Vercel no llega (China / red lenta) */}
        <style
          id="holistic-critical-css"
          dangerouslySetInnerHTML={{ __html: criticalCss }}
        />
        <script dangerouslySetInnerHTML={{ __html: adminThemeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: cssLoadGuardScript }} />
      </head>
      <body
        className={`${plusJakarta.className} min-h-full overflow-x-hidden bg-[var(--background)] text-[var(--foreground)] antialiased`}
      >
        <DocumentThemeScope />
        {children}
      </body>
    </html>
  );
}
