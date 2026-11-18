import { describe, expect, it } from "vitest";

import { QUOTE_PERMISSIONS } from "@/constants";

import { QUOTE_TRANSITIONS, allowedStaffQuoteActions } from "../lifecycle";
import { isExpired, moqOf, unpricedPlateFees } from "../selectors";

const all = () => true;
const readOnly = (code: string) => code === QUOTE_PERMISSIONS.read;
const coordinator = (code: string) => code === QUOTE_PERMISSIONS.convert;

describe("QUOTE_TRANSITIONS (BE QuoteStatus, docs 14 §5)", () => {
  it("terminal statuses have no transition", () => {
    expect(QUOTE_TRANSITIONS.EXPIRED).toEqual([]);
    expect(QUOTE_TRANSITIONS.CANCELLED).toEqual([]);
    expect(QUOTE_TRANSITIONS.CONVERTED).toEqual([]);
  });
  it("CHANGES_REQUESTED only reopens as a DRAFT revision", () => {
    expect(QUOTE_TRANSITIONS.CHANGES_REQUESTED).toEqual(["DRAFT"]);
  });
});

describe("allowedStaffQuoteActions — action gating (3 roles)", () => {
  it("TC-F04-01: create order only on ACCEPTED", () => {
    for (const status of [
      "DRAFT",
      "SENT",
      "CHANGES_REQUESTED",
      "EXPIRED",
      "CANCELLED",
      "CONVERTED",
    ] as const)
      expect(allowedStaffQuoteActions(status, all)).not.toContain("convert");
    expect(allowedStaffQuoteActions("ACCEPTED", all)).toContain("convert");
  });
  it("SALES on DRAFT: edit, send, cancel; SENT has no content action", () => {
    expect(allowedStaffQuoteActions("DRAFT", all)).toEqual(["edit", "send", "cancel"]);
    expect(allowedStaffQuoteActions("SENT", all)).toEqual([]);
  });
  it("read-only role sees nothing; coordinator only converts", () => {
    expect(allowedStaffQuoteActions("DRAFT", readOnly)).toEqual([]);
    expect(allowedStaffQuoteActions("ACCEPTED", coordinator)).toEqual(["convert"]);
  });
  it("a legacy quote is view-only", () => {
    expect(allowedStaffQuoteActions("DRAFT", all, true)).toEqual([]);
  });
});

describe("selectors", () => {
  it("MOQ is the lowest tier", () => {
    expect(
      moqOf([
        { minQuantity: 50, unitPrice: 1 },
        { minQuantity: 20, unitPrice: 2 },
      ]),
    ).toBe(20);
  });
  it("counts plate fees still without an amount", () => {
    expect(
      unpricedPlateFees({
        fees: [
          {
            id: "f",
            kind: "PLATE_FEE",
            sku: "X",
            amount: null,
            taxClass: null,
            taxRate: null,
            tax: null,
          },
        ],
      }),
    ).toBe(1);
  });
  it("expired once validUntil has passed", () => {
    expect(isExpired("2000-01-01T00:00:00Z")).toBe(true);
  });
});
