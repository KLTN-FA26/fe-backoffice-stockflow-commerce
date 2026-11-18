import { describe, expect, it } from "vitest";

import { QUOTE_ACCEPTED, QUOTE_DRAFT_PLATE_UNPRICED, QUOTE_ROW } from "../__fixtures__/quote-ds02";
import { toQuoteBody } from "../form-body";
import { quoteFormSchema } from "../form-schemas";
import { quoteDtoSchema, quotePageDtoSchema } from "../schemas";
import { lineAmount, previewTotals, tierPrice } from "../selectors";

describe("quote DTO (BE QuoteResponse, seed QT-20261120-9001)", () => {
  it("parses the real shape; omitted nulls read as null", () => {
    const quote = quoteDtoSchema.parse(QUOTE_ACCEPTED);
    expect(quote.lines[0]).toMatchObject({
      cartons: 60,
      unitsPerCarton: 1000,
      units: 60000,
      moq: 20,
    });
    expect(quote.lines[0]?.designSnapshotId).toBeNull();
    expect(quote.customerFeedback).toBeNull();
    expect(quote.accepted?.total).toBe(77550000);
  });

  it("a draft with an unpriced plate fee parses with amount null and no totals", () => {
    const quote = quoteDtoSchema.parse(QUOTE_DRAFT_PLATE_UNPRICED);
    expect(quote.fees[0]).toMatchObject({ kind: "PLATE_FEE", amount: null });
    expect(quote.proposed).toBeNull();
  });

  it("QuoteRowResponse has no payment term and parses in a 0-based page", () => {
    const page = quotePageDtoSchema.parse({
      items: [QUOTE_ROW],
      page: 0,
      size: 15,
      totalElements: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    });
    expect(page.items[0]?.convertedOrderId).toBe(QUOTE_ROW.convertedOrderId);
  });
});

describe("TC-F03-02 — line amount and totals", () => {
  const [line] = QUOTE_ACCEPTED.lines;
  if (!line) throw new Error("fixture thiếu dòng");
  it("line amount = cartons × units per carton × tier price, as BE", () => {
    const price = tierPrice(line.tiers, 60);
    expect(price).toBe(1150);
    expect(lineAmount(60, 1000, price ?? 0)).toBe(line.proposedLineTotal);
  });

  it("below the lowest tier (MOQ) there is no price", () => {
    expect(tierPrice(line.tiers, 10)).toBeNull();
  });

  it("total = Σ lines + fees + tax equals BE `proposed`", () => {
    const totals = previewTotals(
      [{ amount: 69000000, taxRate: line.taxRate }],
      [{ amount: 1500000, taxRate: 10 }],
    );
    expect(totals).toEqual(QUOTE_ACCEPTED.proposed);
  });
});

describe("quote form → BE body", () => {
  const base = {
    customerId: QUOTE_ACCEPTED.customerId,
    validUntil: "2099-12-31",
    requestedDeliveryDate: "",
    terms: "",
    lines: [{ sku: "LY-GIAY-DEMO-12OZ-XANH", cartons: "60", hasCustomerPrice: true, tiers: [] }],
    plateFees: [{ sku: "LY-GIAY-DEMO-12OZ-XANH", amount: "1500000" }],
    shippingFee: "",
    hasShippingFee: false,
  };

  it("no tiers = customer's own price; plate fee sent with its sku and amount", () => {
    const body = toQuoteBody(quoteFormSchema.parse(base));
    expect(body.lines).toEqual([{ sku: "LY-GIAY-DEMO-12OZ-XANH", cartons: 60 }]);
    expect(body.fees).toEqual([
      { kind: "PLATE_FEE", sku: "LY-GIAY-DEMO-12OZ-XANH", amount: 1500000 },
    ]);
  });

  it("without a customer price, tiers are required", () => {
    const result = quoteFormSchema.safeParse({
      ...base,
      lines: [{ ...base.lines[0], hasCustomerPrice: false }],
    });
    expect(result.success).toBe(false);
  });

  it("a SKU appears on one line only; shipping fee must be > 0", () => {
    const result = quoteFormSchema.safeParse({
      ...base,
      lines: [base.lines[0], base.lines[0]],
      hasShippingFee: true,
      shippingFee: "0",
    });
    const paths = result.error?.issues.map((issue) => issue.path.join(".")) ?? [];
    expect(paths).toEqual(expect.arrayContaining(["lines.1.sku", "shippingFee"]));
  });
});
