"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  applyThemeToDom,
  forceDocumentLightTheme,
  getStoredAdminTheme,
  isAdminPathname,
} from "@/hooks/useAdminTheme";

/**
 * Keeps dark mode scoped to /admin*.
 * Client navigations (admin → cliente) would otherwise leave html.dark on.
 */
export function DocumentThemeScope() {
  const pathname = usePathname();

  useEffect(() => {
    if (isAdminPathname(pathname)) {
      applyThemeToDom(getStoredAdminTheme());
      return;
    }
    forceDocumentLightTheme();
  }, [pathname]);

  return null;
}
