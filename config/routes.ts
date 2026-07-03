export const routes = {
  home: "/",
  login: "/login",
  overview: "/overview",
  adAccounts: "/ad-accounts",
  payments: "/payments",
  affiliates: "/affiliates",
  creativeAnalyzer: "/creative-analyzer",
  api: {
    auth: {
      login: "/api/auth/login",
      logout: "/api/auth/logout",
      session: "/api/auth/session",
    },
  },
} as const;
