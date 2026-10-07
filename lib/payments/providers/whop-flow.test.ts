import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  absoluteWhopPurchaseUrl,
  buildWhopCheckoutBody,
  parseWhopCheckoutResponse,
  WHOP_WALLET_PRODUCT_EXTERNAL_ID,
} from "./whop-checkout.ts";
import {
  parseWhopWebhookPayload,
  verifyWhopWebhookSignature,
} from "./whop-webhook.ts";

const INTENT = "11111111-2222-4333-8444-555555555555";
const SECRET = "ws_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

test("buildWhopCheckoutBody usa plan one_time y metadata del intent", () => {
  const body = buildWhopCheckoutBody({
    companyId: "biz_test123",
    amountCents: 11300,
    currency: "USD",
    paymentIntentId: INTENT,
    organizationId: "org_1",
    walletId: "wal_1",
    redirectUrl: "https://www.adsholistic.com/payments?tab=wallet-tx&status=whop_return",
    concept: "Recarga Holistic · Demo",
    customerEmail: "cliente@example.com",
  });

  assert.equal(body.mode, "payment");
  assert.equal(body.redirect_url, "https://www.adsholistic.com/payments?tab=wallet-tx&status=whop_return");
  const plan = body.plan as Record<string, unknown>;
  assert.equal(plan.company_id, "biz_test123");
  assert.equal(plan.plan_type, "one_time");
  assert.equal(plan.currency, "usd");
  assert.equal(plan.initial_price, 113);
  assert.equal(plan.title, "Recarga Holistic");
  assert.ok(String(plan.title).length <= 30);
  assert.equal(plan.internal_notes, "Recarga Holistic · Demo");
  const product = plan.product as Record<string, unknown>;
  assert.equal(product.external_identifier, WHOP_WALLET_PRODUCT_EXTERNAL_ID);
  const metadata = body.metadata as Record<string, unknown>;
  assert.equal(metadata.payment_intent_id, INTENT);
  assert.equal(metadata.organization_id, "org_1");
  assert.equal(metadata.wallet_id, "wal_1");
  assert.equal(metadata.customer_email, "cliente@example.com");
});

test("buildWhopCheckoutBody respeta product_id fijo", () => {
  const body = buildWhopCheckoutBody({
    companyId: "biz_test123",
    amountCents: 1000,
    currency: "usd",
    paymentIntentId: INTENT,
    organizationId: "org_1",
    walletId: "wal_1",
    redirectUrl: "https://example.com/return",
    productId: "prod_fixed",
  });
  const plan = body.plan as Record<string, unknown>;
  assert.equal(plan.product_id, "prod_fixed");
  assert.equal(plan.product, undefined);
});

test("absoluteWhopPurchaseUrl normaliza paths relativos", () => {
  assert.equal(
    absoluteWhopPurchaseUrl("/checkout/plan_abc?session=ch_1"),
    "https://whop.com/checkout/plan_abc?session=ch_1",
  );
  assert.equal(
    absoluteWhopPurchaseUrl("https://whop.com/checkout/x"),
    "https://whop.com/checkout/x",
  );
});

test("parseWhopCheckoutResponse exige id y purchase_url", () => {
  assert.equal(parseWhopCheckoutResponse(null), null);
  assert.equal(parseWhopCheckoutResponse({ id: "ch_1" }), null);
  const parsed = parseWhopCheckoutResponse({
    id: "ch_1",
    purchase_url: "/checkout/plan_x",
  });
  assert.deepEqual(parsed, {
    id: "ch_1",
    purchaseUrl: "https://whop.com/checkout/plan_x",
  });
});

test("verifyWhopWebhookSignature acepta HMAC Standard Webhooks", () => {
  const rawBody = JSON.stringify({
    id: "msg_test",
    type: "payment.succeeded",
    data: {
      id: "pay_1",
      total: 113,
      currency: "usd",
      metadata: { payment_intent_id: INTENT },
    },
  });
  const webhookId = "msg_test";
  const webhookTimestamp = "1700000000";
  const signed = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const sig = createHmac("sha256", SECRET).update(signed, "utf8").digest("base64");

  assert.equal(
    verifyWhopWebhookSignature({
      rawBody,
      webhookId,
      webhookTimestamp,
      webhookSignature: `v1,${sig}`,
      secret: SECRET,
      nowSeconds: 1700000000,
    }),
    true,
  );
  assert.equal(
    verifyWhopWebhookSignature({
      rawBody,
      webhookId,
      webhookTimestamp,
      webhookSignature: `v1,${sig}`,
      secret: "ws_otro",
      nowSeconds: 1700000000,
    }),
    false,
  );
  assert.equal(
    verifyWhopWebhookSignature({
      rawBody,
      webhookId,
      webhookTimestamp,
      webhookSignature: `v1,${sig}`,
      secret: SECRET,
      nowSeconds: 1700000000 + 600,
    }),
    false,
  );
});

test("parseWhopWebhookPayload mapea payment.succeeded y failed", () => {
  const succeeded = parseWhopWebhookPayload(
    JSON.stringify({
      id: "msg_ok",
      type: "payment.succeeded",
      data: {
        id: "pay_ok",
        usd_total: 113.0,
        currency: "usd",
        metadata: { payment_intent_id: INTENT },
      },
    }),
  );
  assert.ok(succeeded);
  assert.equal(succeeded.succeeded, true);
  assert.equal(succeeded.failed, false);
  assert.equal(succeeded.paymentIntentId, INTENT);
  assert.equal(succeeded.providerReference, "pay_ok");
  assert.equal(succeeded.amountCents, 11300);
  assert.equal(succeeded.currency, "USD");

  const failed = parseWhopWebhookPayload(
    JSON.stringify({
      id: "msg_fail",
      type: "payment.failed",
      data: { id: "pay_fail", metadata: { payment_intent_id: INTENT } },
    }),
  );
  assert.ok(failed);
  assert.equal(failed.failed, true);
  assert.equal(failed.succeeded, false);

  const cancelled = parseWhopWebhookPayload(
    JSON.stringify({
      id: "msg_cancel",
      type: "payment.canceled",
      data: { id: "pay_cancel" },
    }),
  );
  assert.ok(cancelled);
  assert.equal(cancelled.cancelled, true);
});
