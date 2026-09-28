import assert from "node:assert/strict";
import test from "node:test";
import { nasMembershipCheckoutUrl } from "./nas-checkout.ts";

test("el checkout de NAS vuelve a Ads Holistic", () => {
  const target = nasMembershipCheckoutUrl("https://www.adsholistic.com/pago/listo?token=abc");
  const url = new URL(target);
  assert.equal(url.origin, "https://nas.com");
  assert.equal(url.searchParams.get("communityCode"), "HOLISTIS_ECOM_CLUB");
  assert.equal(url.searchParams.get("tierId"), "69097e76034f2e22f1ad6033");
  assert.equal(
    url.searchParams.get("linkClicked"),
    "https://www.adsholistic.com/pago/listo?token=abc",
  );
  assert.equal(target.includes("victorminas28.com"), false);
});
