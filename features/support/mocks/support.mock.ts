import type { SupportConfig } from "../types/support.types";

export const supportMock: SupportConfig = {
  brandName: "Default Media",
  poweredByLabel: "Powered by Default Support",
  whatsappUrl: "https://wa.me/000000000",
  initialMessages: [
    {
      id: "bot-welcome",
      role: "bot",
      text: "Welcome! Our support team is ready to assist you. Let us know what you need.",
      timestamp: "10:00",
    },
  ],
  categories: [
    {
      id: "platform-guideline",
      title: "Default Platform Guideline",
      articleIds: [
        "intro",
        "step-register",
        "step-agency",
        "step-funds",
        "step-allocation",
        "features",
        "referral",
        "remove-card",
        "invoice",
      ],
    },
    {
      id: "agency-ad-account",
      title: "Agency Ad Account",
      articleIds: [
        "benefits",
        "business-center",
        "access-agency",
        "pixel-setup",
        "ads-tools",
        "setup-campaign",
        "setup-ad-group",
        "setup-ads",
      ],
    },
    {
      id: "ads-policies",
      title: "Ads Policies",
      articleIds: ["prohibited", "landing-page"],
    },
  ],
  articles: [
    {
      id: "intro",
      categoryId: "platform-guideline",
      title: "1. Introductions",
      content:
        "Welcome to Default Media. This guide walks you through the essential steps to start advertising with our platform.",
      bullets: [
        "Create your Default account",
        "Connect or create an ad account",
        "Fund your wallet and allocate budget",
      ],
    },
    {
      id: "step-register",
      categoryId: "platform-guideline",
      title: "Step 1: Register Default Account",
      content:
        "Sign up with your email or Google account to access the Default Media dashboard.",
      bullets: [
        "Go to the login page",
        "Complete your profile information",
        "Verify your email address",
      ],
    },
    {
      id: "step-agency",
      categoryId: "platform-guideline",
      title: "Step 2: Get Agency Ad Account",
      content:
        "Request an agency ad account through the dashboard to manage campaigns at scale.",
      bullets: [
        "Navigate to Mis cuentas publicitarias",
        "Click Crear nuevo",
        "Wait for account approval",
      ],
    },
    {
      id: "step-funds",
      categoryId: "platform-guideline",
      title: "Step 3: Add funds to Default balance",
      content:
        "Add funds to Cartera Default using your preferred payment gateway.",
      bullets: [
        "Go to Pago section",
        "Select a payment method",
        "Click Agregar saldo",
      ],
    },
    {
      id: "step-allocation",
      categoryId: "platform-guideline",
      title: "Step 4: Money Allocation",
      content:
        "Assign wallet balance to your ad accounts for campaign spending.",
      bullets: [
        "Open Asignación de saldo tab",
        "Select target ad account",
        "Enter amount and confirm",
      ],
    },
    {
      id: "features",
      categoryId: "platform-guideline",
      title: "2.1 Features",
      content: "Overview of key platform features available in your dashboard.",
      bullets: [
        "Wallet management",
        "Multi-account support",
        "Creative Analyzer",
        "Affiliate program",
      ],
    },
    {
      id: "referral",
      categoryId: "platform-guideline",
      title: "2.2 Default Referral Program",
      content:
        "Earn commissions by referring new advertisers to Default Media.",
      bullets: [
        "Share your unique referral link",
        "Track referrals in the affiliates section",
        "Receive monthly payouts",
      ],
    },
    {
      id: "remove-card",
      categoryId: "platform-guideline",
      title: "2.3 Remove Credit Card",
      content:
        "Learn how to remove a saved payment method from your account.",
      bullets: [
        "Go to Pago settings",
        "Select saved payment method",
        "Click Remove card",
      ],
    },
    {
      id: "invoice",
      categoryId: "platform-guideline",
      title: "2.4 Download Invoice",
      content: "Download invoices for your wallet transactions and top-ups.",
      bullets: [
        "Open transaction history",
        "Select a completed transaction",
        "Click Download invoice",
      ],
    },
    {
      id: "benefits",
      categoryId: "agency-ad-account",
      title: "Benefits of agency ads account",
      content:
        "Agency ad accounts offer enhanced limits, BC management, and team collaboration.",
      bullets: [
        "Higher spending limits",
        "Business Center integration",
        "Multi-user access",
      ],
    },
    {
      id: "business-center",
      categoryId: "agency-ad-account",
      title: "How to use Business Center",
      content:
        "Business Center lets you organize ad accounts, assets, and team permissions.",
      bullets: [
        "Link your BC ID in the dashboard",
        "Assign roles to team members",
        "Manage assets centrally",
      ],
    },
    {
      id: "access-agency",
      categoryId: "agency-ad-account",
      title: "How to access Agency Ad Account provided by Default",
      content:
        "Once approved, access your agency account from Mis cuentas publicitarias.",
      bullets: [
        "Check account status in the table",
        "Click Gestionar on active accounts",
        "Sync with ad platform",
      ],
    },
    {
      id: "pixel-setup",
      categoryId: "agency-ad-account",
      title: "How to setup Pixel for Web Conversion Campaign",
      content:
        "Install and verify your tracking pixel for conversion campaigns.",
      bullets: [
        "Create pixel in ad manager",
        "Add pixel code to your website",
        "Verify events in dashboard",
      ],
    },
    {
      id: "ads-tools",
      categoryId: "agency-ad-account",
      title: "Tools for Ads",
      content: "Recommended tools for creative production and campaign optimization.",
      bullets: [
        "Creative Analyzer",
        "Audience insights",
        "A/B testing framework",
      ],
    },
    {
      id: "setup-campaign",
      categoryId: "agency-ad-account",
      title: "How to setup Campaign",
      content: "Create a new campaign with objectives, budget, and schedule.",
      bullets: [
        "Select campaign objective",
        "Set daily or lifetime budget",
        "Define start and end dates",
      ],
    },
    {
      id: "setup-ad-group",
      categoryId: "agency-ad-account",
      title: "How to setup Ad group",
      content:
        "Configure ad groups with targeting, placements, and bid strategy.",
      bullets: [
        "Define audience targeting",
        "Choose placements",
        "Set bid amount",
      ],
    },
    {
      id: "setup-ads",
      categoryId: "agency-ad-account",
      title: "How to setup Ads",
      content: "Upload creatives, write copy, and publish your ads.",
      bullets: [
        "Upload video or image assets",
        "Add headlines and descriptions",
        "Submit for review",
      ],
    },
    {
      id: "prohibited",
      categoryId: "ads-policies",
      title: "Prohibited products or service",
      content:
        "Default Media prohibits advertising for certain products and services.",
      bullets: [
        "Illegal substances and weapons",
        "Misleading financial products",
        "Adult content without proper restrictions",
        "Counterfeit goods",
      ],
    },
    {
      id: "landing-page",
      categoryId: "ads-policies",
      title: "Landing page requirements",
      content:
        "All landing pages must meet transparency and user experience standards.",
      bullets: [
        "Clear product or service description",
        "Working contact information",
        "Privacy policy link",
        "Mobile-friendly design",
      ],
    },
  ],
};
