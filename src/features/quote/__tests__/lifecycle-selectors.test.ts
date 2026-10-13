import { describe, expect, it } from "vitest";

import { QUOTE_API_STATUSES } from "@/constants";

import {
  QUOTE_TRANSITIONS,
  allowedPortalQuoteActions,
  allowedStaffQuoteActions,
} from "../lifecycle";
import { blankUnits, tierPrice } from "../selectors";

import type { PermissionCode } from "@/lib/auth/me-permissions";

const has =
  (...codes: string[]) =>
  (code: PermissionCode) =>
    codes.includes(code);

describe("QUOTE_TRANSITIONS (BE QuoteStatus.canTransitionTo, SCRUM-448)", () => {
  it("covers every BE status", () => {
    expect(Object.keys(QUOTE_TRANSITIONS).sort()).toEqual([...QUOTE_API_STATUSES].sort());
  });
  it("EXPIRED, CANCELLED and CONVERTED are terminal", () => {
    expect(QUOTE_TRANSITIONS.EXPIRED).toEqual([]);
    expect(QUOTE_TRANSITIONS.CANCELLED).toEqual([]);
    expect(QUOTE_TRANSITIONS.CONVERTED).toEqual([]);
  });
  it("only DRAFT can be cancelled — a sent quote cannot", () => {
    expect(QUOTE_TRANSITIONS.DRAFT).toContain("CANCELLED");
    expect(QUOTE_TRANSITIONS.SENT).not.toContain("CANCELLED");
  });
});

describe("quote action gating", () => {
  const update = has("sales-quotes:UPDATE");
  it("staff: DRAFT → edit/send/cancel; CHANGES_REQUESTED → revise; ACCEPTED → convert; terminal → none", () => {
    expect(allowedStaffQuoteActions("DRAFT", update)).toEqual(["edit", "send", "cancel"]);
    expect(allowedStaffQuoteActions("CHANGES_REQUESTED", update)).toEqual(["revise"]);
    expect(allowedStaffQuoteActions("ACCEPTED", update)).toEqual(["convert"]);
    expect(allowedStaffQuoteActions("CONVERTED", update)).toEqual([]);
    expect(allowedStaffQuoteActions("SENT", update)).toEqual([]);
  });
  it("staff without UPDATE (read-only role) sees no mutating action", () => {
    expect(allowedStaffQuoteActions("DRAFT", has("sales-quotes:READ"))).toEqual([]);
  });
  it("portal: accept / request changes only while SENT and not past validUntil", () => {
    const approve = has("sales-quotes:APPROVE");
    const now = Date.parse("2026-10-14T00:00:00Z");
    expect(allowedPortalQuoteActions("SENT", "2026-10-20T00:00:00Z", approve, now)).toEqual([
      "accept",
      "requestChanges",
    ]);
    expect(allowedPortalQuoteActions("SENT", "2026-10-01T00:00:00Z", approve, now)).toEqual([]);
    expect(allowedPortalQuoteActions("ACCEPTED", "2026-10-20T00:00:00Z", approve, now)).toEqual([]);
    expect(allowedPortalQuoteActions("SENT", "2026-10-20T00:00:00Z", has(), now)).toEqual([]);
  });
});

describe("pricing preview (display only — BE is authoritative)", () => {
  it("P5: sums pieces of the same blank across designs, never across blanks", () => {
    const units = blankUnits([
      { blankSku: "CUP-12OZ", quantity: 600 },
      { blankSku: "cup-12oz", quantity: 400 },
      { blankSku: "BOWL-500", quantity: 300 },
    ]);
    expect(units.get("CUP-12OZ")).toBe(1000);
    expect(units.get("BOWL-500")).toBe(300);
  });
  it("picks the highest tier ≤ units; P4: below the lowest tier → null (no silent lowest price)", () => {
    const tiers = [
      { minQuantity: 5000, unitPrice: 2200 },
      { minQuantity: 1000, unitPrice: 2500 },
    ];
    expect(tierPrice(tiers, 999)).toBeNull();
    expect(tierPrice(tiers, 1000)).toBe(2500);
    expect(tierPrice(tiers, 7000)).toBe(2200);
  });
});
