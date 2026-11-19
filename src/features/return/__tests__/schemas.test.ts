import { describe, expect, it } from "vitest";

import { approveInputSchema, createReceiptInputSchema, openInputSchema } from "../input-schemas";
import { returnReceiptDtoSchema, returnRequestDtoSchema, returnRowDtoSchema } from "../schemas";

/** Hình BE `ReturnRequestResponse` với `non_null`: trường chưa đặt vắng mặt hẳn. */
const returnJson = (over: Record<string, unknown> = {}) => ({
  id: "ret-1",
  rmaNumber: "RMA-20261110-0001",
  orderId: "ord-1",
  orderNumber: "SO-20261101-000001",
  customerId: "cus-1",
  status: "REQUESTED",
  reasonCode: "PRINT_DEFECT",
  description: "Lem mực",
  requestedResolution: "REFUND",
  channel: "PORTAL",
  requestedBy: "u-1",
  requestedAt: "2026-11-10T03:00:00Z",
  currency: "VND",
  lines: [
    {
      id: "line-1",
      orderLineId: "ol-1",
      sku: "SKU-1",
      customPrinted: true,
      unitPrice: 100000,
      requestedQuantity: 24,
      refundQuantity: 0,
    },
  ],
  evidence: [],
  discrepancies: [],
  history: [{ to: "REQUESTED", occurredAt: "2026-11-10T03:00:00Z" }],
  version: 0,
  ...over,
});

describe("DTO schemas (contract)", () => {
  it("parses a return without review, receipt or resolution", () => {
    const parsed = returnRequestDtoSchema.parse(returnJson());
    expect(parsed.review).toBeUndefined();
    expect(parsed.lines[0]?.approvedQuantity).toBeUndefined();
  });

  it("parses a queue row and a return receipt with expected cartons", () => {
    expect(
      returnRowDtoSchema.parse({
        id: "ret-1",
        rmaNumber: "RMA-1",
        orderId: "o",
        orderNumber: "SO-1",
        customerId: "c",
        status: "RESOLVED",
        reasonCode: "WRONG_ITEM",
        channel: "BACK_OFFICE",
        requestedAt: "2026-11-10T03:00:00Z",
        currency: "VND",
        vatAdjustmentRequired: true,
        version: 3,
      }).vatAdjustmentRequired,
    ).toBe(true);
    const receipt = returnReceiptDtoSchema.parse({
      id: "gr-1",
      number: "GR-1",
      receiptType: "RETURN",
      status: "DRAFT",
      warehouseId: "wh-1",
      cartons: [],
      expectedCartons: [{ lpn: "LPN-1", sku: "SKU-1", quantity: 24, scanned: false }],
      version: 0,
    });
    expect(receipt.expectedCartons).toHaveLength(1);
  });

  it("rejects an unknown status (contract bug, not silently shown)", () => {
    expect(() => returnRequestDtoSchema.parse(returnJson({ status: "QC_DONE" }))).toThrow();
  });
});

describe("input schemas", () => {
  const line = (quantity: number, cap = 10, customPrinted = false) => ({
    orderLineId: "ol-1",
    quantity,
    cap,
    customPrinted,
  });
  const open = (over: Record<string, unknown> = {}) => ({
    shipmentId: "",
    shipmentRequired: false,
    reasonCode: "PRINT_DEFECT",
    description: "",
    lateClaimReason: "",
    lines: [line(2)],
    ...over,
  });

  it("WF-05 TH-1: an order delivered in several shipments needs the shipment named", () => {
    const missing = openInputSchema.safeParse(open({ shipmentRequired: true }));
    expect(missing.error?.issues[0]?.path).toEqual(["shipmentId"]);
    expect(
      openInputSchema.safeParse(open({ shipmentRequired: true, shipmentId: "s-1" })).success,
    ).toBe(true);
  });

  it("OTHER needs a description", () => {
    const result = openInputSchema.safeParse(open({ reasonCode: "OTHER" }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["description"]);
  });

  it("BR-RMA-002: printed goods come back only for a named fault", () => {
    const printed = openInputSchema.safeParse(
      open({ reasonCode: "OTHER", description: "Không thích", lines: [line(1, 10, true)] }),
    );
    expect(printed.success).toBe(false);
    expect(printed.error?.issues.some((issue) => issue.path[0] === "reasonCode")).toBe(true);
    expect(openInputSchema.safeParse(open({ lines: [line(1, 10, true)] })).success).toBe(true);
  });

  it("a claim needs one unit and stays within what was delivered", () => {
    expect(openInputSchema.safeParse(open({ lines: [line(0)] })).success).toBe(false);
    expect(openInputSchema.safeParse(open({ lines: [line(11)] })).success).toBe(false);
  });

  it("approving nothing is a rejection, not an approval", () => {
    const none = approveInputSchema.safeParse({
      lines: [{ lineId: "l", quantity: 0, cap: 3 }],
      note: "",
    });
    expect(none.success).toBe(false);
    expect(
      approveInputSchema.safeParse({ lines: [{ lineId: "l", quantity: 4, cap: 3 }], note: "" })
        .success,
    ).toBe(false);
  });

  it("a return receipt names its source", () => {
    const base = {
      sourceType: "RMA",
      returnRequestId: "",
      shipmentId: "",
      warehouseId: "wh",
      quarantineLocationCode: "WH-QC01",
      note: "",
    };
    expect(createReceiptInputSchema.safeParse(base).success).toBe(false);
    expect(createReceiptInputSchema.safeParse({ ...base, returnRequestId: "r" }).success).toBe(
      true,
    );
  });
});
