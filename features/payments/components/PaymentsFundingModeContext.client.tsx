"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PaymentsFundingMode } from "./PaymentsFundingModeSwitch.client";

export type PaymentsFundingCapabilitiesClient = {
  isStaff: boolean;
  isSuperAdmin: boolean;
  canAgencyBmFund: boolean;
  canClientStripeFund: boolean;
  canSwitchFundingModes: boolean;
  defaultFundingMode: PaymentsFundingMode;
};

const FundingModeContext = createContext<{
  fundingMode: PaymentsFundingMode;
  setFundingMode: (mode: PaymentsFundingMode) => void;
  isStaff: boolean;
  isSuperAdmin: boolean;
  canAgencyBmFund: boolean;
  canClientStripeFund: boolean;
  canSwitchFundingModes: boolean;
  agencyBmFunding: boolean;
} | null>(null);

export function PaymentsFundingModeProvider({
  capabilities,
  children,
}: {
  capabilities: PaymentsFundingCapabilitiesClient;
  children: ReactNode;
}) {
  const [fundingMode, setFundingMode] = useState<PaymentsFundingMode>(
    capabilities.defaultFundingMode,
  );

  const value = useMemo(() => {
    const effectiveMode: PaymentsFundingMode =
      capabilities.canSwitchFundingModes
        ? fundingMode
        : capabilities.defaultFundingMode;

    return {
      fundingMode: effectiveMode,
      setFundingMode,
      isStaff: capabilities.isStaff,
      isSuperAdmin: capabilities.isSuperAdmin,
      canAgencyBmFund: capabilities.canAgencyBmFund,
      canClientStripeFund: capabilities.canClientStripeFund,
      canSwitchFundingModes: capabilities.canSwitchFundingModes,
      agencyBmFunding:
        capabilities.canAgencyBmFund && effectiveMode === "agency_bm",
    };
  }, [capabilities, fundingMode]);

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
      isSuperAdmin: false,
      canAgencyBmFund: false,
      canClientStripeFund: true,
      canSwitchFundingModes: false,
      agencyBmFunding: false,
    };
  }
  return ctx;
}
