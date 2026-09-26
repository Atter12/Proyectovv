import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReferralShareUrl,
  CLIENT_AFFILIATE_REWARD_USD,
  formatAffiliateUsd,
  mapReferralSource,
  referralDisplayPath,
  resolveClientAffiliateView,
  selectLinkedAffiliateUserId,
  smokeClientReferrals,
  summarizeClientReferrals,
} from "./client-program.ts";

const TESTER = "sandrowonmer@gmail.com";

test("la vista de otro cliente no usa el usuario del gerente", () => {
  const gerente = "gerente-user";
  const abel = "abel-user";
  assert.equal(selectLinkedAffiliateUserId(gerente, [gerente, abel]), abel);
  assert.equal(selectLinkedAffiliateUserId(gerente, [abel]), abel);
  assert.equal(selectLinkedAffiliateUserId(gerente, [gerente]), null);
  assert.equal(selectLinkedAffiliateUserId(gerente, []), null);
});

test("el enlace público usa /r y se muestra sin protocolo", () => {
  const shareUrl = buildReferralShareUrl("https://adsholistic.com/", "sandro-wong");
  assert.equal(shareUrl, "https://adsholistic.com/r/sandro-wong");
  assert.equal(referralDisplayPath(shareUrl), "adsholistic.com/r/sandro-wong");
});

test("un código pendiente no publica un enlace atribuible", () => {
  assert.equal(
    buildReferralShareUrl("https://adsholistic.com", "pending"),
    "https://adsholistic.com/register",
  );
});

test("el tester sin referidos ve smoke y otro usuario ve la tabla vacía", () => {
  const shared = {
    rewardUsd: CLIENT_AFFILIATE_REWARD_USD,
    referralCode: "sandro",
    shareUrl: "https://adsholistic.com/r/sandro",
    displayPath: "adsholistic.com/r/sandro",
    liveReferrals: [],
  };

  const tester = resolveClientAffiliateView({ ...shared, email: TESTER });
  assert.equal(tester.smoke, true);
  assert.equal(tester.stats.total, 8);
  assert.equal(tester.stats.closed, 3);
  assert.equal(tester.stats.negotiating, 2);
  assert.equal(tester.stats.discountsEarnedUsd, 45);

  const client = resolveClientAffiliateView({
    ...shared,
    email: "cliente@tienda.com",
  });
  assert.equal(client.smoke, false);
  assert.equal(client.referrals.length, 0);
  assert.equal(client.stats.discountsEarnedUsd, 0);

  const viewingAbel = resolveClientAffiliateView({
    ...shared,
    email: TESTER,
    allowSmoke: false,
  });
  assert.equal(viewingAbel.smoke, false);
  assert.equal(viewingAbel.referrals.length, 0);
});

test("si el tester ya tiene referidos reales, el smoke no los tapa", () => {
  const live = mapReferralSource(
    {
      id: "real-1",
      status: "converted",
      commissionAmountCents: 0,
      createdAt: "2026-09-01T12:00:00.000Z",
      paidAt: null,
      metadata: {
        referred_name: "Ana Real",
        company: "Ana Shop",
        referred_email: "ana@shop.com",
      },
      organizationName: null,
      organizationEmail: null,
    },
    CLIENT_AFFILIATE_REWARD_USD,
  );

  const view = resolveClientAffiliateView({
    email: TESTER,
    rewardUsd: CLIENT_AFFILIATE_REWARD_USD,
    referralCode: "sandro",
    shareUrl: "https://adsholistic.com/r/sandro",
    displayPath: "adsholistic.com/r/sandro",
    liveReferrals: [live],
  });

  assert.equal(view.smoke, false);
  assert.deepEqual(
    view.referrals.map((row) => row.name),
    ["Ana Real"],
  );
  assert.equal(view.stats.closed, 1);
  assert.equal(view.stats.discountsEarnedUsd, 15);
  assert.equal(live.discountStatus, "pending");
});

test("el estado de base se traduce al pipeline del cliente", () => {
  const stillClosed = mapReferralSource(
    {
      id: "paid",
      status: "converted",
      commissionAmountCents: 2000,
      createdAt: "2026-09-01T12:00:00.000Z",
      paidAt: "2026-09-10T12:00:00.000Z",
      metadata: { pipeline_stage: "registered" },
      organizationName: "Org",
      organizationEmail: "org@correo.com",
    },
    CLIENT_AFFILIATE_REWARD_USD,
  );
  assert.equal(stillClosed.stage, "closed");
  assert.equal(stillClosed.benefitUsd, 20);

  const contract = mapReferralSource(
    {
      id: "contract",
      status: "active",
      commissionAmountCents: 0,
      createdAt: "2026-09-01T12:00:00.000Z",
      paidAt: null,
      metadata: { pipeline_stage: "contract_sent" },
      organizationName: "En contrato",
      organizationEmail: null,
    },
    CLIENT_AFFILIATE_REWARD_USD,
  );
  assert.equal(contract.stage, "contract_sent");
  assert.equal(contract.earned, false);

  const rejected = mapReferralSource(
    {
      id: "no",
      status: "closed",
      commissionAmountCents: 1500,
      createdAt: "2026-09-01T12:00:00.000Z",
      paidAt: null,
      metadata: null,
      organizationName: "No sigue",
      organizationEmail: null,
    },
    CLIENT_AFFILIATE_REWARD_USD,
  );
  assert.equal(rejected.stage, "declined");
  assert.equal(rejected.benefitUsd, 0);
  assert.equal(rejected.earned, false);

  const paid = mapReferralSource(
    {
      id: "custom",
      status: "converted",
      commissionAmountCents: 2000,
      createdAt: "2026-09-01T12:00:00.000Z",
      paidAt: "2026-09-10T12:00:00.000Z",
      metadata: null,
      organizationName: "Cerrado",
      organizationEmail: null,
    },
    CLIENT_AFFILIATE_REWARD_USD,
  );
  assert.equal(paid.benefitUsd, 20);
  assert.equal(paid.discountStatus, "applied");
  assert.equal(formatAffiliateUsd(summarizeClientReferrals([paid]).discountsEarnedUsd), "US$20");
});

test("el smoke cubre el ejemplo de la vista", () => {
  const names = smokeClientReferrals(CLIENT_AFFILIATE_REWARD_USD).map((row) => row.name);
  assert.ok(names.includes("Carlos Mendoza"));
  assert.ok(names.includes("María Torres"));
  assert.ok(names.includes("Andrea López"));
});
