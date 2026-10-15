"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { routes } from "@/config/routes";

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  // Links deuda ocupa el alto del main (solo se mueve la lista): el envoltorio
  // tiene que seguir la columna flex del main para que el panel pueda crecer.
  const fillsMain = pathname === routes.linksDeuda;

  return (
    <motion.div
      key={pathname}
      className={fillsMain ? "flex min-h-0 min-w-0 flex-1 flex-col" : "min-w-0"}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
