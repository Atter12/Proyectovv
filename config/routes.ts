export const routes = {
  home: "/",
  login: "/login",
  register: "/register",
  verifyOtp: "/verify-otp",
  forgotPassword: "/forgot-password",
  accountSetup: "/account-setup",
  overview: "/overview",
  adAccounts: "/ad-accounts",
  payments: "/payments",
  affiliates: "/affiliates",
  creativeAnalyzer: "/creative-analyzer",
  api: {
    auth: {
      logout: "/api/auth/logout",
      session: "/api/auth/session",
    },
    onboarding: {
      status: "/api/onboarding/status",
    },
    wallet: "/api/wallet",
    payments: {
      intents: "/api/payments/intents",
      transactions: "/api/payments/transactions",
    },
    adAccounts: "/api/ad-accounts",
    support: {
      tickets: "/api/support/tickets",
    },
    notifications: "/api/notifications",
  },
} as const;
