"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface ReferralLinkBoxProps {
  link: string;
}

export function ReferralLinkBox({ link }: ReferralLinkBoxProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Input readOnly value={link} className="flex-1" />
      <Button onClick={handleCopy} className="shrink-0">
        {copied ? "¡Copiado!" : "Copiar este enlace"}
      </Button>
    </div>
  );
}
