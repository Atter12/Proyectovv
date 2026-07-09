"use client";

import { useEffect, useState } from "react";
import { readAdminChartThemeMode, type AdminChartThemeMode } from "./chartTheme";

export function useAdminChartThemeMode(): AdminChartThemeMode {
  const [mode, setMode] = useState<AdminChartThemeMode>("light");

  useEffect(() => {
    const sync = () => setMode(readAdminChartThemeMode());
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return mode;
}
