import { describe, expect, it } from "vitest";

import { QUOTE_PERMISSIONS } from "@/constants";

import { QUOTE_TRANSITIONS, allowedStaffQuoteActions } from "../lifecycle";
import {
  hasDiscontinuedLine,
  isExpired,
  lastChangeRequest,
  moqOf,
  sendBlockReason,
  unpricedPlateFees,
} from "../selectors";
import type { QuoteTransition } from "../types";

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
  it("BE-14: ACCEPTED can be cancelled only when a line has a purchasability other than PURCHASABLE", () => {
    const lines = (...values: (string | null | undefined)[]) => ({
      lines: values.map((purchasability) => ({ purchasability })) as never,
    });
    expect(hasDiscontinuedLine(lines("PURCHASABLE", "PRODUCT_INACTIVE"))).toBe(true);
    expect(hasDiscontinuedLine(lines("PURCHASABLE"))).toBe(false);
    // Old lines carry no value: null alone must not enable the button.
    expect(hasDiscontinuedLine(lines(null, undefined))).toBe(false);
    expect(allowedStaffQuoteActions("ACCEPTED", all, false, false)).toEqual(["convert"]);
    expect(allowedStaffQuoteActions("ACCEPTED", all, false, true)).toEqual(["cancel", "convert"]);
    // Drafts keep their cancel regardless of lines.
    expect(allowedStaffQuoteActions("DRAFT", all)).toContain("cancel");
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

describe("lastChangeRequest — ý khách ở dòng lịch sử cuối có toStatus CHANGES_REQUESTED", () => {
  const at = (n: number) => `2099-11-1${n}T03:00:00Z`;
  const row = (
    revision: number,
    toStatus: QuoteTransition["toStatus"],
    day: number,
    reason: string | null = null,
  ): QuoteTransition => ({
    revision,
    fromStatus: null,
    toStatus,
    reason,
    changedAt: at(day),
    changedBy: null,
  });
  it("lấy dòng CHANGES_REQUESTED cuối cùng (lịch sử cũ nhất trước)", () => {
    const history = [
      row(1, "DRAFT", 1),
      row(1, "CHANGES_REQUESTED", 2, "Giảm giá 3%"),
      row(2, "DRAFT", 3),
      row(2, "SENT", 4),
      row(2, "CHANGES_REQUESTED", 5, "Giảm giá 5%"),
      row(3, "DRAFT", 6),
    ];
    expect(lastChangeRequest(history)).toEqual({
      feedback: "Giảm giá 5%",
      at: at(5),
      revision: 2,
    });
  });
  it("chưa từng bị yêu cầu sửa → null", () => {
    expect(lastChangeRequest([row(1, "DRAFT", 1)])).toBeNull();
    expect(lastChangeRequest([])).toBeNull();
  });
});

describe("sendBlockReason — nhóm thuế (BE QUOTE_TAX_CLASS_MISSING)", () => {
  const base = { fees: [], priced: true, validUntil: "2099-01-01T00:00:00Z" };
  it("dòng chưa có taxRate → chặn, nêu dòng và SKU", () => {
    const reason = sendBlockReason({
      ...base,
      lines: [
        { lineNo: 1, sku: "A", taxRate: 8 },
        { lineNo: 2, sku: "SKU-X", taxRate: null },
      ],
    });
    expect(reason).toContain("Dòng 2");
    expect(reason).toContain("SKU-X");
    expect(reason).toContain("chưa có nhóm thuế");
  });
  it("phí chưa có taxRate → chặn", () => {
    const reason = sendBlockReason({
      ...base,
      lines: [{ lineNo: 1, sku: "A", taxRate: 8 }],
      fees: [
        {
          id: "f",
          kind: "PLATE_FEE",
          sku: "A",
          amount: 1000,
          taxClass: null,
          taxRate: null,
          tax: null,
        },
      ],
    });
    expect(reason).toContain("chưa có nhóm thuế");
  });
  it("đủ thuế → không chặn", () => {
    expect(sendBlockReason({ ...base, lines: [{ lineNo: 1, sku: "A", taxRate: 0 }] })).toBeNull();
  });
});
