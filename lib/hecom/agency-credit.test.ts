import assert from "node:assert/strict";
import test from "node:test";
import { isAgencyCreditSlug } from "./agency-credit.ts";

test("en Ads Holistic nadie es crédito", () => {
  assert.equal(isAgencyCreditSlug("wilder-remolina"), false);
  assert.equal(isAgencyCreditSlug("ely-aguirre"), false);
  assert.equal(isAgencyCreditSlug("jerson-artezano"), false);
  assert.equal(isAgencyCreditSlug(""), false);
  assert.equal(isAgencyCreditSlug(null), false);
});
