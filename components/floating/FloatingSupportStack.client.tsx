"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { supportMock } from "@/features/support/mocks/support.mock";
import { WhatsAppFloatingButton } from "./WhatsAppFloatingButton.client";
import { SupportChatWidget } from "./SupportChatWidget.client";
import { OnboardingProgressWidget } from "./OnboardingProgressWidget.client";

export function FloatingSupportStack() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6",
      )}
    >
      <div
        className={cn(
          "pointer-events-auto flex flex-col items-end gap-3 transition-all duration-200 ease-out",
          chatOpen && "sm:mr-0",
        )}
      >
        <OnboardingProgressWidget chatOpen={chatOpen} />

        <div className="flex flex-row items-end gap-3 sm:flex-col">
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
