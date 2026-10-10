import { describe, expect, it } from "vitest";

import {
  createPoSchema,
  recoverDeliveryInputSchema,
  sendPoInputSchema,
  supplierConfirmationInputSchema,
} from "./schemas";

const validPo = {
  supplierId: "22222222-2222-4222-8222-222222222222",
  warehouseId: "d99123fd-2997-4751-6bb9-e10a2e6d9949",
  currency: "VND",
  expectedAt: "2026-10-07",
  lines: [
    { sku: "SKU-001", description: "Sofa 3 chỗ", quantityOrdered: 10, unitPrice: 50000 },
    { sku: "SKU-002", description: "", quantityOrdered: 5, unitPrice: 1, taxRate: 10 },
  ],
};

const pathsOf = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  r.success ? [] : (r.error?.issues ?? []).map((i) => i.path.join("."));
const issuePaths = (input: unknown) => pathsOf(createPoSchema.safeParse(input));

describe("createPoSchema — Input (BE CreatePurchaseOrderRequest)", () => {
  it("nhận PO hợp lệ (mô tả dòng để trống được — BE lấy tên sản phẩm)", () => {
    expect(createPoSchema.safeParse(validPo).success).toBe(true);
  });

  it("bắt buộc chọn NCC, kho nhận và ít nhất 1 dòng (BE @NotNull / @NotEmpty)", () => {
    expect(issuePaths({ ...validPo, supplierId: "  " })).toContain("supplierId");
    expect(issuePaths({ ...validPo, warehouseId: "" })).toContain("warehouseId");
    expect(issuePaths({ ...validPo, lines: [] })).toContain("lines");
  });

  it("BR-07 (docs 02 §6): một tiền tệ cho cả PO, chỉ VND/USD/CNY (open-question A4)", () => {
    expect(issuePaths({ ...validPo, currency: "EUR" })).toContain("currency");
    expect(createPoSchema.safeParse({ ...validPo, currency: "USD" }).success).toBe(true);
  });

  it("BE Money làm tròn theo tiền tệ: VND không có phần lẻ, USD tối đa 2 chữ số", () => {
    const withPrice = (currency: string, unitPrice: number) => ({
      ...validPo,
      currency,
      lines: [{ sku: "SKU-001", description: "Sofa 3 chỗ", quantityOrdered: 1, unitPrice }],
    });
    expect(issuePaths(withPrice("VND", 1000.5))).toContain("lines.0.unitPrice");
    expect(createPoSchema.safeParse(withPrice("USD", 12.5)).success).toBe(true);
    expect(issuePaths(withPrice("USD", 12.345))).toContain("lines.0.unitPrice");
  });

  it("thuế suất dòng 0..100%", () => {
    const lines = [{ ...validPo.lines[0], taxRate: 101 }];
    expect(issuePaths({ ...validPo, lines })).toContain("lines.0.taxRate");
  });

  it("giới hạn BE: mô tả dòng ≤ 255 ký tự (VARCHAR(255)), SL đặt ≤ Java int", () => {
    const withLine = (line: Record<string, unknown>) => ({
      ...validPo,
      lines: [
        { sku: "SKU-001", description: "Sofa 3 chỗ", quantityOrdered: 1, unitPrice: 1, ...line },
      ],
    });
    expect(issuePaths(withLine({ description: "a".repeat(256) }))).toContain("lines.0.description");
    expect(createPoSchema.safeParse(withLine({ description: "a".repeat(255) })).success).toBe(true);
    expect(issuePaths(withLine({ quantityOrdered: 2_147_483_648 }))).toContain(
      "lines.0.quantityOrdered",
    );
  });

  it("mã SKU theo định dạng BE `ck_variants_sku` (A-Z, 0-9, '.', '_', '-', ≤ 64 ký tự)", () => {
    expect(issuePaths({ ...validPo, lines: [{ ...validPo.lines[0], sku: "ab" }] })).toContain(
      "lines.0.sku",
    );
    expect(issuePaths({ ...validPo, lines: [{ ...validPo.lines[0], sku: "-AB" }] })).toContain(
      "lines.0.sku",
    );
    const dotted = [{ ...validPo.lines[0], sku: "CUP.12_OZ" }];
    expect(createPoSchema.safeParse({ ...validPo, lines: dotted }).success).toBe(true);
  });

  it.each([0, -1, 1.5])("SL đặt %s bị chặn (BE int @Positive)", (q) => {
    const lines = [{ ...validPo.lines[0], quantityOrdered: q }];
    expect(issuePaths({ ...validPo, lines })).toContain("lines.0.quantityOrdered");
  });

  it.each([0, -1])("đơn giá %s bị chặn (BE `ck_purchase_order_lines_price` > 0)", (unitPrice) => {
    const lines = [{ ...validPo.lines[0], unitPrice }];
    expect(issuePaths({ ...validPo, lines })).toContain("lines.0.unitPrice");
  });

  it("BR-06 (docs 02 §6): ngày giao đã qua KHÔNG bị schema chặn (chỉ cảnh báo)", () => {
    expect(createPoSchema.safeParse({ ...validPo, expectedAt: "2020-01-01" }).success).toBe(true);
    expect(issuePaths({ ...validPo, expectedAt: "07/10/2026" })).toContain("expectedAt");
  });

  it("ASSUMPTION: SKU trùng trong một PO bị chặn", () => {
    const lines = [validPo.lines[0], { ...validPo.lines[0], quantityOrdered: 1 }];
    expect(issuePaths({ ...validPo, lines })).toContain("lines");
  });
});

describe("sendPoInputSchema (BE PurchaseOrder#confirm, PR #71)", () => {
  it("ngày giao trước ngày đặt → chặn ở ô ngày (BE 400)", () => {
    const schema = sendPoInputSchema("2026-10-09", "2026-10-05");
    expect(pathsOf(schema.safeParse({ expectedAt: "2026-10-04", reason: "dời" }))).toContain(
      "expectedAt",
    );
    expect(schema.safeParse({ expectedAt: "2026-10-05", reason: "dời" }).success).toBe(true);
  });

  it("giữ nguyên ngày giao đang lưu → không cần lý do", () => {
    const schema = sendPoInputSchema("2026-10-09");
    expect(schema.safeParse({ expectedAt: "2026-10-09", reason: "" }).success).toBe(true);
  });

  it("BR-06: ngày giao đã qua KHÔNG bị chặn (BE chỉ cảnh báo qua warnings)", () => {
    const schema = sendPoInputSchema("2020-09-20");
    expect(schema.safeParse({ expectedAt: "2020-09-20", reason: "" }).success).toBe(true);
  });

  it("thiếu ngày giao → lỗi ô ngày (BE PO_DELIVERY_DATE_REQUIRED)", () => {
    expect(pathsOf(sendPoInputSchema(null).safeParse({ expectedAt: "", reason: "" }))).toContain(
      "expectedAt",
    );
  });

  it("đổi ngày giao bắt buộc lý do (BE PO_REASON_REQUIRED)", () => {
    const schema = sendPoInputSchema("2026-10-09");
    expect(pathsOf(schema.safeParse({ expectedAt: "2026-10-12", reason: "" }))).toContain("reason");
    expect(schema.safeParse({ expectedAt: "2026-10-12", reason: "NCC dời lịch" }).success).toBe(
      true,
    );
  });
});

describe("recoverDeliveryInputSchema (BE requireDeliveryRecovery)", () => {
  const ok = { reason: "NCC báo chưa nhận email", reconciled: true, acknowledgePastDue: false };

  it("bắt buộc lý do và xác nhận đã đối chiếu", () => {
    expect(recoverDeliveryInputSchema(false).safeParse(ok).success).toBe(true);
    expect(pathsOf(recoverDeliveryInputSchema(false).safeParse({ ...ok, reason: " " }))).toContain(
      "reason",
    );
    expect(
      pathsOf(recoverDeliveryInputSchema(false).safeParse({ ...ok, reconciled: false })),
    ).toContain("reconciled");
  });

  it("ngày giao đã qua → phải xác nhận acknowledgePastDue", () => {
    expect(pathsOf(recoverDeliveryInputSchema(true).safeParse(ok))).toContain("acknowledgePastDue");
    expect(
      recoverDeliveryInputSchema(true).safeParse({ ...ok, acknowledgePastDue: true }).success,
    ).toBe(true);
  });
});

describe("supplierConfirmationInputSchema (BE SupplierConfirmationRequest)", () => {
  it("NCC xác nhận: ghi chú tuỳ chọn", () => {
    const v = { status: "CONFIRMED", supplierReference: "", note: "" };
    expect(supplierConfirmationInputSchema.safeParse(v).success).toBe(true);
  });

  it("NCC từ chối: bắt buộc ghi lý do", () => {
    const v = { status: "REJECTED", supplierReference: "", note: "" };
    expect(pathsOf(supplierConfirmationInputSchema.safeParse(v))).toContain("note");
  });
});
