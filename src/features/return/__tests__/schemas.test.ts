import { describe, expect, it } from "vitest";

import {
  approveInputSchema,
  createReceiptInputSchema,
  openInputSchema,
  proposeInputSchema,
} from "../input-schemas";
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

  // WF-05 BO-11 (audit C-32): BE gửi chuỗi và còn thêm giá trị — giá trị lạ đọc thành UNKNOWN, không làm hỏng màn
  it("reads a status / reason / channel / outcome the FE does not know as UNKNOWN", () => {
    const parsed = returnRequestDtoSchema.parse(
      returnJson({
        status: "QC_DONE",
        reasonCode: "NEW_REASON",
        channel: "EMAIL",
        outcome: "PARTLY",
        refusalReason: "SOMETHING",
      }),
    );
    expect(parsed).toMatchObject({
      status: "UNKNOWN",
      reasonCode: "UNKNOWN",
      channel: "UNKNOWN",
      outcome: "UNKNOWN",
      refusalReason: "UNKNOWN",
    });
    const receipt = returnReceiptDtoSchema.parse({
      id: "gr-1",
      number: "GR-1",
      status: "ARCHIVED",
      warehouseId: "wh-1",
      cartons: [],
      expectedCartons: [],
      version: 0,
    });
    expect(receipt.status).toBe("UNKNOWN");
  });

  it("WF-05 F-20 / F-21: outcome, refusal reason, receipt flags, carton stockEntered, loose photo", () => {
    const parsed = returnRequestDtoSchema.parse(
      returnJson({
        status: "RESOLVED",
        outcome: "REFUSED",
        refusalReason: "CUSTOMER_DAMAGE",
        refusalNote: "Ly bị ướt do bảo quản",
        receiptOpenable: false,
        receiptDraftOpen: false,
      }),
    );
    expect(parsed).toMatchObject({
      outcome: "REFUSED",
      refusalReason: "CUSTOMER_DAMAGE",
      refusalNote: "Ly bị ướt do bảo quản",
      receiptOpenable: false,
      receiptDraftOpen: false,
    });
    const receipt = returnReceiptDtoSchema.parse({
      id: "gr-1",
      number: "GR-1",
      status: "CLOSED",
      warehouseId: "wh-1",
      cartons: [
        {
          lpn: "L1",
          sku: "S",
          quantity: 10,
          countedQuantity: 8,
          opened: true,
          stockEntered: false,
          countedBy: "u-3",
        },
      ],
      looseLines: [{ id: "ll-1", sku: "S", quantity: 2, recordedBy: "u-4", photoId: "ph-1" }],
      expectedCartons: [],
      managerConfirmationRequired: false,
      version: 1,
    });
    expect(receipt.cartons[0]).toMatchObject({ stockEntered: false, countedBy: "u-3" });
    expect(receipt.looseLines?.[0]).toMatchObject({ photoId: "ph-1", recordedBy: "u-4" });
    expect(receipt.managerConfirmationRequired).toBe(false);
  });

  it("WF-05 Q-11: a CUSTODY photo carries what is kept for the customer", () => {
    const parsed = returnRequestDtoSchema.parse(
      returnJson({
        evidence: [
          {
            id: "ev-9",
            stage: "CUSTODY",
            uploadedAt: "2026-11-24T03:00:00Z",
            custody: { sku: "SKU-X", lpn: null, quantity: 3, note: "Khách nhờ huỷ hộ" },
          },
        ],
      }),
    );
    expect(parsed.evidence?.[0]?.custody).toMatchObject({ sku: "SKU-X", quantity: 3 });
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

describe("proposeInputSchema (WF-05 Q-4: 0 refund needs a fixed reason)", () => {
  const propose = (quantities: number[], over: Record<string, unknown> = {}) => ({
    lines: quantities.map((quantity, index) => ({ lineId: `l-${index}`, quantity, cap: 5 })),
    note: "",
    refusalReason: "",
    refusalNote: "",
    ...over,
  });

  it("refunding at least one unit needs no reason", () => {
    expect(proposeInputSchema.safeParse(propose([0, 2])).success).toBe(true);
  });

  it("every line at 0 while units are refundable: the reason is required", () => {
    const result = proposeInputSchema.safeParse(propose([0, 0]));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["refusalReason"]);
    expect(
      proposeInputSchema.safeParse(propose([0, 0], { refusalReason: "CUSTOMER_DAMAGE" })).success,
    ).toBe(true);
  });

  it("the reason comes from the fixed list; the public note is at most 500 characters", () => {
    expect(proposeInputSchema.safeParse(propose([0, 0], { refusalReason: "BAD" })).success).toBe(
      false,
    );
    expect(
      proposeInputSchema.safeParse(
        propose([0, 0], { refusalReason: "OTHER", refusalNote: "x".repeat(501) }),
      ).success,
    ).toBe(false);
  });

  it("withholding some units may give a reason; OTHER needs a note for the customer", () => {
    expect(
      proposeInputSchema.safeParse(propose([0, 2], { refusalReason: "NOT_DEFECTIVE" })).success,
    ).toBe(true);
    const other = proposeInputSchema.safeParse(propose([0, 0], { refusalReason: "OTHER" }));
    expect(other.success).toBe(false);
    expect(other.error?.issues[0]?.path).toEqual(["refusalNote"]);
    expect(
      proposeInputSchema.safeParse(
        propose([0, 0], { refusalReason: "OTHER", refusalNote: "Khách tự in thêm logo" }),
      ).success,
    ).toBe(true);
  });

  it("a line above its cap is still refused", () => {
    expect(proposeInputSchema.safeParse(propose([6], { refusalReason: "OTHER" })).success).toBe(
      false,
    );
  });
});
