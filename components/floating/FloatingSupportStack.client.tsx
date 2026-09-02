"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { routes } from "@/config/routes";
import type { DashboardPersona } from "@/types/dashboard-persona";
import { SupportChatWidget } from "./SupportChatWidget.client";
import { StaffSupportNotifier } from "./StaffSupportNotifier.client";

const OnboardingWidgetLoader = dynamic(
  () =>
    import("./OnboardingWidgetLoader.client").then(
      (m) => m.OnboardingWidgetLoader,
    ),
  { ssr: false },
);

export function FloatingSupportStack({
  persona = "cliente",
}: {
  persona?: DashboardPersona;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const pathname = usePathname();
  const onSupportPage =
    pathname === routes.support || pathname.startsWith(`${routes.support}/`);
  const needsStickyLift =
    pathname === routes.payments ||
    pathname.startsWith(`${routes.payments}/`) ||
    pathname === routes.adAccounts ||
    pathname.startsWith(`${routes.adAccounts}/`);
  const isStaff = persona === "gerente" || persona === "super_admin";

  // Staff: burbuja izquierda + sonido fuera de /support (inbox ya avisa adentro).
  if (isStaff) {
    return <StaffSupportNotifier />;
  }

  // En /support la página completa es el canal; sin WhatsApp ni burbuja duplicada.
  if (onSupportPage) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed right-3 z-50 flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2 sm:right-5 sm:gap-3 md:bottom-6 md:right-6",
        needsStickyLift
          ? "bottom-[4.75rem] sm:bottom-[5.25rem] md:bottom-6"
          : "bottom-3 sm:bottom-5",
      )}
    >
      <div className="pointer-events-auto flex w-full max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2 sm:max-w-none sm:gap-3">
        <OnboardingWidgetLoader chatOpen={chatOpen} />
        <SupportChatWidget
          isOpen={chatOpen}
          onToggle={() => setChatOpen(true)}
          onOpenChange={setChatOpen}
          persona={persona}
        />
      </div>
    </div>
  );
}
