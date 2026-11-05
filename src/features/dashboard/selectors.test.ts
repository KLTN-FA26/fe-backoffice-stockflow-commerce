import { describe, expect, it } from "vitest";

import { DASHBOARD_LABELS } from "@/constants/dashboard";

import { alertBreakdown, alertKindLabel, alertWarehouseLabel, totalOpenAlerts } from "./selectors";

const summary = { openByKind: { REORDER: 0, SAFETY: 2, EXPIRING: 3, EXPIRED: 0 } };

describe("alert selectors", () => {
  it("totals open alerts across kinds", () => {
    expect(totalOpenAlerts(summary)).toBe(5);
    expect(totalOpenAlerts({ openByKind: {} })).toBe(0);
  });

  it("breaks down only kinds that have alerts; a newer kind is shown by its code", () => {
    expect(alertBreakdown(summary)).toBe("Dưới tồn an toàn 2 · Sắp hết hạn 3");
    expect(alertBreakdown({ openByKind: { REORDER: 0 } })).toBe("");
    expect(alertBreakdown({ openByKind: { FUTURE: 1 } })).toBe("FUTURE 1");
  });

  it("labels kinds and the system-wide scope of REORDER / SAFETY (no warehouse)", () => {
    expect(alertKindLabel("EXPIRED")).toBe("Đã hết hạn");
    expect(alertKindLabel("FUTURE")).toBe("FUTURE");
    expect(alertWarehouseLabel("HCM")).toBe("HCM");
    expect(alertWarehouseLabel(undefined)).toBe(DASHBOARD_LABELS.alertAllWarehouses);
    expect(alertWarehouseLabel(null)).toBe(DASHBOARD_LABELS.alertAllWarehouses);
  });
});
