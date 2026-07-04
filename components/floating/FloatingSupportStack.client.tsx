"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { supportMock } from "@/features/support/mocks/support.mock";
import { WhatsAppFloatingButton } from "./WhatsAppFloatingButton.client";
import { SupportChatWidget } from "./SupportChatWidget.client";

const OnboardingWidgetLoader = dynamic(
  () =>
    import("./OnboardingWidgetLoader.client").then(
      (m) => m.OnboardingWidgetLoader,
    ),
  { ssr: false },
);

export function FloatingSupportStack() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-3 right-3 z-50 flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2 sm:bottom-5 sm:right-5 sm:gap-3 md:bottom-6 md:right-6",
      )}
    >
      <div className="pointer-events-auto flex w-full max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2 sm:max-w-none sm:gap-3">
        <OnboardingWidgetLoader chatOpen={chatOpen} />

        <div className="flex flex-row items-end justify-end gap-2 sm:flex-col sm:gap-3">
          <WhatsAppFloatingButton url={supportMock.whatsappUrl} />
          <SupportChatWidget
            isOpen={chatOpen}
            onToggle={() => setChatOpen(true)}
            onOpenChange={setChatOpen}
          />
        </div>
      </div>
    </div>
  );
}
