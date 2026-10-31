import { describe, expect, it } from "vitest";

import { RECEIPT_CARTON_FIELD_MESSAGES, RECEIPT_FIELD_MESSAGES as MSG } from "@/constants";

import { SOFA_PO_LINE_ID, TABLE_PO_LINE_ID } from "./__fixtures__/receipt";
import {
  buildBlindLinesSchema,
  buildReceiptLinesSchema,
  receiptCreateInputSchema,
  receiptCreateWithoutPoInputSchema,
  receiptDecisionInputSchema,
} from "./input-schemas";
import { buildQcDecisionSchema } from "./qc-input-schemas";

const line = (overrides: Record<string, unknown> = {}) => ({
  purchaseOrderLineId: TABLE_PO_LINE_ID,
  quantity: 6,
  lotNumber: "LOT-1",
  expiryDate: "2027-10-01",
  locationCode: " hcm-rcv01 ",
  note: "",
  ...overrides,
});

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe("receiptLinesSchema (docs 03 §6)", () => {
  const schema = buildReceiptLinesSchema({ receivedOn: "2026-10-09" });

  it("hợp lệ: mã vị trí được trim + viết hoa như BE", () => {
    const parsed = schema.parse({ lines: [line()] });
    expect(parsed.lines[0]?.locationCode).toBe("HCM-RCV01");
  });

  it("cần ít nhất một dòng; SL phải là số nguyên > 0; mã vị trí bắt buộc", () => {
    expect(messages(schema.safeParse({ lines: [] }))).toContain(MSG.linesRequired);
    expect(messages(schema.safeParse({ lines: [line({ quantity: 0 })] }))).toContain(MSG.quantity);
    expect(messages(schema.safeParse({ lines: [line({ quantity: 1.5 })] }))).toContain(
      MSG.quantity,
    );
    expect(messages(schema.safeParse({ lines: [line({ locationCode: "  " })] }))).toContain(
      MSG.locationRequired,
    );
  });

  it("BR-06: hạn dùng phải sau ngày nhận", () => {
    expect(messages(schema.safeParse({ lines: [line({ expiryDate: "2026-10-09" })] }))).toContain(
      MSG.expiryNotAfterReceipt,
    );
    expect(schema.safeParse({ lines: [line({ expiryDate: "2026-10-10" })] }).success).toBe(true);
  });

  it("BR-03: SKU theo dõi lô / hạn dùng thì bắt buộc nhập", () => {
    const tracked = buildReceiptLinesSchema({
      receivedOn: "2026-10-09",
      trackingByPoLine: { [TABLE_PO_LINE_ID]: { lotTracked: true, expiryTracked: true } },
    });
    const result = tracked.safeParse({ lines: [line({ lotNumber: "", expiryDate: "" })] });
    expect(messages(result)).toEqual(expect.arrayContaining([MSG.lotRequired, MSG.expiryRequired]));
    // SKU chưa biết cách theo dõi → không ép ở FE (BE chặn bằng RECEIPT_LOT_DATA_INVALID)
    expect(schema.safeParse({ lines: [line({ lotNumber: "", expiryDate: "" })] }).success).toBe(
      true,
    );
  });

  it("BR-02: tổng các lô của một dòng PO không vượt giới hạn", () => {
    const limited = buildReceiptLinesSchema({
      receivedOn: "2026-10-09",
      limitByPoLine: { [TABLE_PO_LINE_ID]: 6 },
    });
    const split = [line({ quantity: 4, lotNumber: "A" }), line({ quantity: 3, lotNumber: "B" })];
    expect(messages(limited.safeParse({ lines: split }))).toContain(MSG.overLimit);
    const ok = [
      line({ quantity: 4, lotNumber: "A" }),
      line({ quantity: 2, lotNumber: "B" }),
      line({ purchaseOrderLineId: SOFA_PO_LINE_ID, quantity: 99 }),
    ];
    expect(limited.safeParse({ lines: ok }).success).toBe(true);
  });

  it("BE requireDistinctLines: một dòng PO không được có hai dòng cùng số lô", () => {
    const same = [line({ quantity: 4, lotNumber: "A" }), line({ quantity: 2, lotNumber: "A" })];
    expect(messages(schema.safeParse({ lines: same }))).toContain(MSG.duplicateLot);
    // SKU không theo lô: hai dòng không lô của cùng dòng PO cũng bị BE coi là trùng
    const noLot = [line({ lotNumber: "", quantity: 1 }), line({ lotNumber: "", quantity: 1 })];
    expect(messages(schema.safeParse({ lines: noLot }))).toContain(MSG.duplicateLot);
  });
});

describe("receiptCreateInputSchema — BR-01", () => {
  it("phải chọn PO", () => {
    expect(messages(receiptCreateInputSchema.safeParse({ purchaseOrderId: "" }))).toContain(
      MSG.purchaseOrderRequired,
    );
  });
});

describe("qcDecisionSchema — BR-08", () => {
  const schema = buildQcDecisionSchema({ quantity: 6, looseQuantity: 6, packages: [] });
  const empty = { quantity: 0, locationCode: "", reason: "" };

  it("tổng ba phần phải bằng SL đã chuyển sang khu QC", () => {
    expect(schema.safeParse({ accepted: 6, quarantined: empty, rejected: empty }).success).toBe(
      true,
    );
    expect(
      messages(schema.safeParse({ accepted: 5, quarantined: empty, rejected: empty })),
    ).toContain(MSG.qcSum);
  });

  it("phần cách ly / không đạt bắt buộc có vị trí và lý do", () => {
    const result = schema.safeParse({
      accepted: 4,
      quarantined: empty,
      rejected: { quantity: 2, locationCode: "", reason: "" },
    });
    expect(messages(result)).toEqual(
      expect.arrayContaining([MSG.qcLocationRequired, MSG.qcReasonRequired]),
    );
  });

  it("cách ly và không đạt không được chung một vị trí", () => {
    const result = schema.safeParse({
      accepted: 2,
      quarantined: { quantity: 2, locationCode: "HCM-QC01", reason: "Nghi trầy" },
      rejected: { quantity: 2, locationCode: "hcm-qc01", reason: "Nứt" },
    });
    expect(messages(result)).toContain(MSG.qcSameLocation);
  });
});

describe("qcDecisionSchema — QC theo nguyên thùng (BR-08 + BE spec SCRUM-473 §5)", () => {
  // Ví dụ issue #104: 4.990 = thùng …001 (1.000) + …002 (980) + 3.010 lẻ
  const line = {
    quantity: 4990,
    looseQuantity: 3010,
    packages: [
      { lpn: "LPN-20261024-000001", receivedQty: 1000 },
      { lpn: "LPN-20261024-000002", receivedQty: 980 },
    ],
  };
  const schema = buildQcDecisionSchema(line);
  const CARTON = RECEIPT_CARTON_FIELD_MESSAGES;
  const issues = (result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
    result.error?.issues.map((i) => `${i.path.join(".")}:${i.message}`) ?? [];

  it("phần lẻ chia đủ 3.010 + thùng …002 cách ly → hợp lệ", () => {
    const result = schema.safeParse({
      accepted: 3005,
      quarantined: { quantity: 3, locationCode: "HCM-QC01", reason: "Móp" },
      rejected: { quantity: 2, locationCode: "HCM-RTV01", reason: "Rách" },
      cartons: { "LPN-20261024-000002": "QUARANTINE" },
    });
    expect(result.success).toBe(true);
  });

  it("phần lẻ phải chia đủ SL lẻ của dòng (thùng tính nguyên thùng)", () => {
    const result = schema.safeParse({
      accepted: 3010,
      quarantined: { quantity: 3, locationCode: "HCM-QC01", reason: "Móp" },
      rejected: { quantity: 0, locationCode: "", reason: "" },
      cartons: {},
    });
    expect(issues(result)).toContain(`accepted:${CARTON.qcLooseSum(3010)}`);
  });

  it("chọn thùng Không đạt mà phần đó chưa có khu / lý do → lỗi như phần có hàng lẻ", () => {
    const result = schema.safeParse({
      accepted: 3010,
      quarantined: { quantity: 0, locationCode: "", reason: "" },
      rejected: { quantity: 0, locationCode: "", reason: "" },
      cartons: { "LPN-20261024-000001": "REJECTED" },
    });
    expect(issues(result)).toEqual(
      expect.arrayContaining([
        `rejected.locationCode:${MSG.qcLocationRequired}`,
        `rejected.reason:${MSG.qcReasonRequired}`,
      ]),
    );
  });
});

describe("receiptDecisionInputSchema (BR-RCP-001: duyệt / từ chối phần vượt đều cần lý do)", () => {
  it("lý do được trim; để trống hoặc chỉ khoảng trắng → lỗi", () => {
    expect(receiptDecisionInputSchema.parse({ reason: "  hàng tặng  " })).toEqual({
      reason: "hàng tặng",
    });
    for (const reason of ["", "   "]) {
      const result = receiptDecisionInputSchema.safeParse({ reason });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(MSG.approvalReasonRequired);
    }
  });

  it("tối đa 500 ký tự như BE `@Size(max = 500)`", () => {
    expect(receiptDecisionInputSchema.safeParse({ reason: "a".repeat(500) }).success).toBe(true);
    expect(receiptDecisionInputSchema.safeParse({ reason: "a".repeat(501) }).success).toBe(false);
  });
});

describe("receiptCreateWithoutPoInputSchema (BR-RCP-002: NCC + kho + lý do bắt buộc)", () => {
  const valid = { supplierId: "s-1", warehouseId: "w-1", reason: "  hàng mẫu  " };

  it("hợp lệ: lý do được trim, phiếu giao / ghi chú mặc định rỗng", () => {
    expect(receiptCreateWithoutPoInputSchema.parse(valid)).toEqual({
      supplierId: "s-1",
      warehouseId: "w-1",
      reason: "hàng mẫu",
      deliveryNote: "",
      note: "",
    });
  });

  it.each([
    ["supplierId", MSG.supplierRequired],
    ["warehouseId", MSG.warehouseRequired],
    ["reason", MSG.blindReasonRequired],
  ])("thiếu %s → lỗi đúng ô", (field, message) => {
    // Ô chọn NCC / kho trả "" khi chưa chọn; ô lý do có thể chỉ toàn khoảng trắng
    const result = receiptCreateWithoutPoInputSchema.safeParse({
      ...valid,
      [field]: field === "reason" ? "  " : "",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.find((i) => i.path[0] === field)?.message).toBe(message);
  });

  it("lý do tối đa 500 ký tự như BE", () => {
    expect(
      receiptCreateWithoutPoInputSchema.safeParse({ ...valid, reason: "a".repeat(501) }).success,
    ).toBe(false);
  });
});

describe("buildBlindLinesSchema (kiểm đếm phiếu không có PO: gọi hàng bằng SKU)", () => {
  const schema = buildBlindLinesSchema({ receivedOn: "2026-10-09" });
  const line = (overrides: Record<string, unknown> = {}) => ({
    sku: " sofa-3s-grey ",
    quantity: 3,
    lotNumber: "",
    expiryDate: "",
    locationCode: " hcm-rcv01 ",
    note: "",
    ...overrides,
  });

  it("SKU được trim + viết hoa, mã khu viết hoa", () => {
    const parsed = schema.parse({ lines: [line()] });
    expect(parsed.lines[0]).toMatchObject({ sku: "SOFA-3S-GREY", locationCode: "HCM-RCV01" });
  });

  it("thiếu SKU / SL không hợp lệ / thiếu khu → lỗi từng ô", () => {
    const result = schema.safeParse({
      lines: [line({ sku: "", quantity: 0, locationCode: "" })],
    });
    expect(result.error?.issues.map((i) => `${i.path.join(".")}:${i.message}`)).toEqual([
      `lines.0.sku:${MSG.skuRequired}`,
      `lines.0.quantity:${MSG.quantity}`,
      `lines.0.locationCode:${MSG.locationRequired}`,
    ]);
  });

  it("cùng SKU + lô hai lần bị chặn (BE uk_goods_receipt_lines_blind_lot); khác lô thì được", () => {
    const dup = schema.safeParse({ lines: [line(), line({ sku: "SOFA-3S-GREY" })] });
    expect(dup.error?.issues[0]).toMatchObject({
      path: ["lines", 1, "lotNumber"],
      message: MSG.duplicateLot,
    });
    expect(schema.safeParse({ lines: [line(), line({ lotNumber: "L2" })] }).success).toBe(true);
  });

  it("hạn dùng phải sau ngày nhận (BR-06); cần ít nhất một dòng", () => {
    const expired = schema.safeParse({ lines: [line({ expiryDate: "2026-10-09" })] });
    expect(expired.error?.issues[0]?.message).toBe(MSG.expiryNotAfterReceipt);
    expect(schema.safeParse({ lines: [] }).success).toBe(false);
  });
});

describe("chia thùng trên dòng kiểm đếm (BE spec SCRUM-473 §3)", () => {
  const schema = buildReceiptLinesSchema({ receivedOn: "2026-10-09" });
  const blind = buildBlindLinesSchema({ receivedOn: "2026-10-09" });
  const CARTON = RECEIPT_CARTON_FIELD_MESSAGES;
  const issues = (result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
    result.error?.issues.map((i) => `${i.path.join(".")}:${i.message}`) ?? [];
  const cartons = (packages: { lpn?: string; quantity: number }[], unitOfMeasure = "CARTON") =>
    line({ quantity: 4990, unitOfMeasure, packages });

  it("ví dụ issue #104 hợp lệ: thùng có LPN đếm lại + thùng mới; mặc định dòng lẻ không thùng", () => {
    const parsed = schema.parse({
      lines: [cartons([{ lpn: "LPN-20261024-000001", quantity: 1000 }, { quantity: 980 }])],
    });
    expect(parsed.lines[0]?.packages).toEqual([
      { lpn: "LPN-20261024-000001", quantity: 1000 },
      { lpn: "", quantity: 980 },
    ]);
    expect(schema.parse({ lines: [line()] }).lines[0]).toMatchObject({
      unitOfMeasure: "",
      packages: [],
    });
  });

  it("rule 3: có thùng thì phải có đơn vị thùng", () => {
    expect(issues(schema.safeParse({ lines: [cartons([{ quantity: 10 }], "")] }))).toContain(
      `lines.0.unitOfMeasure:${CARTON.unitRequired}`,
    );
  });

  it("rule 4: mỗi thùng ít nhất 1 đơn vị", () => {
    expect(issues(schema.safeParse({ lines: [cartons([{ quantity: 0 }])] }))).toContain(
      `lines.0.packages.0.quantity:${CARTON.cartonQuantity}`,
    );
  });

  it("rule 5: tổng các thùng không vượt SL dòng", () => {
    const over = line({ quantity: 100, unitOfMeasure: "CARTON", packages: [{ quantity: 101 }] });
    expect(issues(schema.safeParse({ lines: [over] }))).toContain(
      `lines.0.packages:${CARTON.cartonsExceedLine}`,
    );
  });

  it("một LPN chỉ một lần trên dòng (BE VALIDATION_FAILED packages[j].lpn)", () => {
    const twice = [
      { lpn: "LPN-20261024-000001", quantity: 1 },
      { lpn: "lpn-20261024-000001", quantity: 1 },
    ];
    expect(issues(schema.safeParse({ lines: [cartons(twice)] }))).toContain(
      `lines.0.packages.1.lpn:${CARTON.duplicateLpn}`,
    );
  });

  it("phiếu không có PO dùng cùng luật thùng", () => {
    const blindLine = {
      sku: "SOFA-3S-GREY",
      quantity: 5,
      lotNumber: "",
      expiryDate: "",
      locationCode: "HCM-RCV01",
      note: "",
      unitOfMeasure: "CARTON",
      packages: [{ quantity: 6 }],
    };
    expect(issues(blind.safeParse({ lines: [blindLine] }))).toContain(
      `lines.0.packages:${CARTON.cartonsExceedLine}`,
    );
  });
});
