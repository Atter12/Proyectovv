import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("el layout pide en paralelo y redirige antes de pintar el dashboard", () => {
  const layout = source("app/(dashboard)/layout.tsx");
  const redirectAt = layout.lastIndexOf("registrationNextPath");
  const selectedAt = layout.lastIndexOf("getSelectedHecomCliente");
  assert.ok(redirectAt !== -1 && selectedAt !== -1);
  assert.ok(redirectAt < selectedAt);
  assert.ok(layout.lastIndexOf("routes.serviceContract") < selectedAt);
  assert.ok(layout.lastIndexOf("routes.membershipCheckout") < selectedAt);
  assert.match(
    layout,
    /Promise\.all\(\[\s*resolvePaymentsFundingCapabilities\([\s\S]*?getTesterDashboardMode\(/,
  );
  assert.match(
    layout,
    /Promise\.all\(\[\s*getSelectedHecomCliente\(session\.id\),\s*getActingAsCliente\(session\.id\),?\s*\]\)/,
  );
  assert.equal(layout.includes("getWalletLedgerBalance"), false);
  assert.equal(layout.includes("getHecomClienteShell"), false);
  assert.match(layout, /SidebarClienteWalletBoundary/);
});

test("el modo tester se lee una vez por request", () => {
  const tester = source("lib/auth/tester-dashboard-mode.server.ts");
  assert.match(tester, /export const getTesterDashboardMode = cache\(/);
});

test("overview no espera el gasto por cuenta para pintar los KPIs", () => {
  const page = source("app/(dashboard)/overview/page.tsx");
  assert.match(page, /overviewFirstPaintDashboard/);
  assert.match(page, /<Suspense fallback=\{<OverviewAccountSpendFallback/);
  assert.match(page, /<OverviewAccountSpend/);
  assert.doesNotMatch(page, /includeCampaignSpend:\s*true/);
  const panel = source("features/clientes/components/ClienteScopedOverview.tsx");
  assert.match(panel, /getHecomCampaignSpendRows/);
});

test("profit aplaza el bot y los productos, y deja el rango en la página", () => {
  const page = source("features/profit/components/ProfitPageClient.client.tsx");
  assert.match(page, /import \{ ProfitDateRangeField \}/);
  assert.match(page, /useAdAccountLiveMetrics/);
  assert.match(page, /const \[from, setFrom\]/);
  assert.match(page, /setTo\(/);
  assert.doesNotMatch(page, /import \{[^}]*ProfitAdvisorBot/);
  assert.doesNotMatch(page, /import \{[^}]*ProductPerformancePanel/);
  assert.match(
    page,
    /import\("@\/features\/profit\/components\/ProfitAdvisorBot\.client"\)/,
  );
  assert.match(
    page,
    /import\("@\/features\/profit\/components\/ProductPerformancePanel\.client"\)/,
  );
  assert.match(page, /ssr:\s*false/g);
  assert.match(page, /loading:\s*\(\)\s*=>\s*<ProfitAdvisorBotFallback/);
  assert.match(page, /loading:\s*\(\)\s*=>\s*null/);
  assert.match(page, /<ProfitAdvisorBot clienteName=\{clienteName\} from=\{from\} to=\{to\}/);
  assert.match(page, /<ProductPerformancePanel campaigns=\{analysis\.campaigns\}/);
});

test("el chat cerrado usa el poll lento y se detiene con la pestaña oculta", () => {
  const widget = source("components/floating/SupportChatWidget.client.tsx");
  assert.match(widget, /SUPPORT_BACKGROUND_POLL_MS/);
  assert.match(widget, /shouldPollSupportBackground/);
  assert.match(widget, /planBackgroundStaffNotice/);
  assert.match(widget, /if \(isOpen\) return;/);
  assert.match(widget, /visibilitychange/);
  assert.match(widget, /visibilityState === "visible"/);
  assert.doesNotMatch(widget, /setInterval\([\s\S]{0,80}5_?000\)/);
});

test("la tarjeta de cartera no bloquea el layout y no pinta un cero mientras carga", () => {
  const wallet = source("components/layout/SidebarClienteWallet.tsx");
  const skeleton = source("components/layout/SidebarWalletCard.client.tsx");
  assert.match(wallet, /pickClienteWalletOrganizationId/);
  assert.match(wallet, /resolveOrganizationIdForHecomCliente\(clienteId\)/);
  assert.match(wallet, /sidebarWalletCents/);
  assert.match(wallet, /walletBalanceCents: null/);
  assert.match(wallet, /<Suspense/);
  assert.match(wallet, /SidebarWalletCardSkeleton/);
  assert.match(skeleton, /aria-busy="true"/);
  assert.doesNotMatch(
    skeleton.slice(skeleton.indexOf("function SidebarWalletCardSkeleton")),
    /formatMoney/,
  );
});
