export const CACHE_TAGS = {
  paymentGateways: "payment-gateways",
  onboarding: (organizationId: string) => `onboarding-${organizationId}`,
  wallet: (organizationId: string) => `wallet-${organizationId}`,
} as const;
