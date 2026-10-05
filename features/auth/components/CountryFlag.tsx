import type { RegisterCountry } from "@/lib/auth/register-countries.shared";

/** Banderas en SVG: los emojis de bandera no se ven en Windows. */
export function CountryFlag({ code, className }: { code: RegisterCountry; className?: string }) {
  const common = { viewBox: "0 0 30 20", className, "aria-hidden": true as const };
  switch (code) {
    case "PE":
      return (
        <svg {...common}>
          <rect width="30" height="20" fill="#fff" />
          <rect width="10" height="20" fill="#D91023" />
          <rect x="20" width="10" height="20" fill="#D91023" />
        </svg>
      );
    case "CO":
      return (
        <svg {...common}>
          <rect width="30" height="10" fill="#FCD116" />
          <rect y="10" width="30" height="5" fill="#003893" />
          <rect y="15" width="30" height="5" fill="#CE1126" />
        </svg>
      );
    case "EC":
      return (
        <svg {...common}>
          <rect width="30" height="10" fill="#FFDD00" />
          <rect y="10" width="30" height="5" fill="#034EA2" />
          <rect y="15" width="30" height="5" fill="#ED1C24" />
          <ellipse cx="15" cy="10" rx="2.6" ry="3.2" fill="#6b4a1f" opacity=".85" />
        </svg>
      );
    case "BR":
      return (
        <svg {...common}>
          <rect width="30" height="20" fill="#009C3B" />
          <path d="M15 2.2 27.6 10 15 17.8 2.4 10Z" fill="#FFDF00" />
          <circle cx="15" cy="10" r="4.4" fill="#002776" />
        </svg>
      );
  }
}
