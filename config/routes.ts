export const routes = {
  home: "/",
  login: "/login",
  register: "/register",
  verifyOtp: "/verify-otp",
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
    payments: {
      intents: "/api/payments/intents",
    },
    adAccounts: "/api/ad-accounts",
    support: {
      tickets: "/api/support/tickets",
    },
    notifications: "/api/notifications",
    onboarding: {
      status: "/api/onboarding/status",
    },
  },
} as const;
