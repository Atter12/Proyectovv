import assert from "node:assert/strict";
import test from "node:test";
import { overviewFirstPaintDashboard } from "./overview-dashboard-query.ts";

test("la primera pintura de overview trae los KPIs diarios y no las campañas ni creativos", () => {
  assert.equal(overviewFirstPaintDashboard.includeDailySpend, true);
  assert.equal(overviewFirstPaintDashboard.includeCampaignSpend, false);
  assert.equal(overviewFirstPaintDashboard.includeCreativos, false);
});
