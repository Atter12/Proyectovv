import "server-only";
import {
  isDemoClienteEmail,
  isDemoGerenteEmail,
} from "@/lib/auth/demo-personas.server";
import { serverEnv } from "@/lib/env/env.server";
import { isHecomOtpStaffEmail } from "@/lib/auth/hecom-otp.server";

export type PaymentsFundingMode = "client" | "agency_bm";

/** Super admin Pagos: ve Cliente (Stripe) + Gerente (BM). */
const DEFAULT_PAYMENTS_SUPER_ADMIN_EMAILS = [
  "attermayerbasiliorengifo@gmail.com",
];

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isPaymentsSuperAdminEmail(emailRaw: string): boolean {
  const email = normalizeEmail(emailRaw);
  if (!email) return false;
  // Demostración: cliente/gerente fijos no son dual super-admin.
  if (isDemoClienteEmail(email) || isDemoGerenteEmail(email)) return false;
  if (serverEnv.paymentsSuperAdminEmails.includes(email)) return true;
  return DEFAULT_PAYMENTS_SUPER_ADMIN_EMAILS.includes(email);
}

export type PaymentsFundingCapabilities = {
  /** Gerente Holistic (lista staff / owner / admin). */
  isStaff: boolean;
  /** Solo super admin: puede usar ambos caminos. */
  isSuperAdmin: boolean;
  /** Puede fondear desde cash BM. */
  canAgencyBmFund: boolean;
  /** Puede recargar cartera con Stripe/manual. */
  canClientStripeFund: boolean;
  /** Muestra el switch Cliente | Gerente. */
  canSwitchFundingModes: boolean;
  defaultFundingMode: PaymentsFundingMode;
};

/**
 * Roles de fondeo en Pagos:
 * - Cliente → solo Stripe / cartera
 * - Gerente → solo BM
 * - Super admin (Atter) → ambos
 *
 * Cuentas demo:
 * - atlvbasiliorengifo@gmail.com → gerente
 */
export function resolvePaymentsFundingCapabilities(input: {
  email: string;
  role?: string | null;
}): PaymentsFundingCapabilities {
  const email = normalizeEmail(input.email);

  if (isDemoClienteEmail(email)) {
    return {
      isStaff: false,
      isSuperAdmin: false,
      canAgencyBmFund: false,
      canClientStripeFund: true,
      canSwitchFundingModes: false,
      defaultFundingMode: "client",
    };
  }

  if (isDemoGerenteEmail(email)) {
    return {
      isStaff: true,
      isSuperAdmin: false,
      canAgencyBmFund: true,
      canClientStripeFund: false,
      canSwitchFundingModes: false,
      defaultFundingMode: "agency_bm",
    };
  }

  const isOrgElevated =
    input.role === "owner" || input.role === "admin";
  const isStaff =
    isHecomOtpStaffEmail(email) || isOrgElevated;
  const isSuperAdmin = isPaymentsSuperAdminEmail(email);

  const canAgencyBmFund = isStaff;
  const canClientStripeFund = !isStaff || isSuperAdmin;
  const canSwitchFundingModes = isSuperAdmin && canAgencyBmFund;

  let defaultFundingMode: PaymentsFundingMode = "client";
  if (canAgencyBmFund && !canClientStripeFund) {
    defaultFundingMode = "agency_bm";
  } else if (canSwitchFundingModes) {
    defaultFundingMode = "agency_bm";
  }

  return {
    isStaff,
    isSuperAdmin,
    canAgencyBmFund,
    canClientStripeFund,
    canSwitchFundingModes,
    defaultFundingMode,
  };
}
