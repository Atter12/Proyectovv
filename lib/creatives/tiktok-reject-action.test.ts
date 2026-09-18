import assert from "node:assert/strict";
import test from "node:test";
import {
  countRecentSameKindRejects,
  latestPolicyOrClaimsKind,
  looksLikeRejectedAdStatus,
  REJECT_REPEAT_LIMIT,
} from "./tiktok-reject-action.ts";

test("Problema de revisión cuenta como rechazo; en revisión no", () => {
  assert.equal(looksLikeRejectedAdStatus("AD_STATUS_AUDIT_DENY"), true);
  assert.equal(looksLikeRejectedAdStatus("AD_STATUS_PARTIAL_AUDIT_DENY"), true);
  assert.equal(looksLikeRejectedAdStatus("AD_STATUS_AUDIT"), false);
  assert.equal(looksLikeRejectedAdStatus("AD_STATUS_REAUDIT"), false);
  assert.equal(looksLikeRejectedAdStatus(null), false);
});

test("3 rechazos del mismo tipo en 7 días bloquean; el 2 no", () => {
  const now = Date.parse("2026-09-18T20:00:00.000Z");
  const recent = [1, 2, 3].map((n) => ({
    kind: "policy" as const,
    at: new Date(now - n * 60 * 60 * 1000).toISOString(),
  }));
  assert.equal(
    countRecentSameKindRejects({ kind: "policy", recent: recent.slice(0, 2), now }),
    2,
  );
  assert.ok(
    countRecentSameKindRejects({ kind: "policy", recent, now }) >=
      REJECT_REPEAT_LIMIT,
  );
  assert.equal(
    countRecentSameKindRejects({ kind: "claims", recent, now }),
    0,
  );
});

test("el aviso de subida usa el último rechazo de política o claims", () => {
  assert.equal(
    latestPolicyOrClaimsKind([
      { reasons: ["video invalid"], at: "2026-09-18T01:00:00.000Z" },
      { reasons: ["misleading health claim"], at: "2026-09-18T02:00:00.000Z" },
    ]),
    "claims",
  );
  assert.equal(
    latestPolicyOrClaimsKind([
      { reasons: ["policy violation"], at: "2026-09-18T03:00:00.000Z" },
    ]),
    "policy",
  );
  assert.equal(latestPolicyOrClaimsKind([]), null);
});
