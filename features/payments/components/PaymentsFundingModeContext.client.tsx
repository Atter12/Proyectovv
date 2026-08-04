"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PaymentsFundingMode } from "./PaymentsFundingModeSwitch.client";

const FundingModeContext = createContext<{
  fundingMode: PaymentsFundingMode;
  setFundingMode: (mode: PaymentsFundingMode) => void;
  isStaff: boolean;
  agencyBmFunding: boolean;
} | null>(null);

export function PaymentsFundingModeProvider({
  isStaff,
  children,
}: {
  isStaff: boolean;
  children: ReactNode;
}) {
  const [fundingMode, setFundingMode] = useState<PaymentsFundingMode>(
    isStaff ? "agency_bm" : "client",
  );

  const value = useMemo(
    () => ({
      fundingMode,
      setFundingMode,
      isStaff,
      agencyBmFunding: isStaff && fundingMode === "agency_bm",
    }),
    [fundingMode, isStaff],
  );

  return (
    <FundingModeContext.Provider value={value}>
      {children}
    </FundingModeContext.Provider>
  );
}

export function usePaymentsFundingMode() {
  const ctx = useContext(FundingModeContext);
  if (!ctx) {
    return {
      fundingMode: "client" as PaymentsFundingMode,
      setFundingMode: (_: PaymentsFundingMode) => undefined,
      isStaff: false,
      agencyBmFunding: false,
    };
  }
  return ctx;
}
