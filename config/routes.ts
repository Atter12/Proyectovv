export const routes = {
  home: "/",
  login: "/login",
  register: "/register",
  verifyOtp: "/verify-otp",
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
  },
} as const;
