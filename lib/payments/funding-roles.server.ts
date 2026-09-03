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
  /** Gerente Holistic (email en AUTH_HECOM_OTP_STAFF_EMAILS). */
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
 * - Gerente → solo BM (email en AUTH_HECOM_OTP_STAFF_EMAILS)
 * - Super admin (Atter) → ambos
 *
 * Nota: el rol `owner` en la org personal del cliente NO implica gerente.
 *
 * Cuentas demo:
 * - ferbasiliorengifo@gmail.com → cliente (UI Stripe; Hecom por emails del CRM)
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

  const isStaff = isHecomOtpStaffEmail(email);
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

/**
 * Staff/super admin “entra como cliente”: misma UI y recarga Stripe/cartera,
 * sin switch BM ni cola de pagos manuales.
 */
export function withActAsClienteView(
  caps: PaymentsFundingCapabilities,
  actingAsCliente: boolean,
): PaymentsFundingCapabilities {
  if (!actingAsCliente) return caps;
  return {
    isStaff: false,
    isSuperAdmin: false,
    canAgencyBmFund: false,
    canClientStripeFund: true,
    canSwitchFundingModes: false,
    defaultFundingMode: "client",
  };
}
