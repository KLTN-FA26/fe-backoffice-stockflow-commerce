import { describe, expect, it } from "vitest";

import {
  createPoSchema,
  receiveGoodsInputSchema,
  recoverDeliveryInputSchema,
  sendPoInputSchema,
  supplierConfirmationInputSchema,
} from "./schemas";

const validPo = {
  supplierId: "22222222-2222-4222-8222-222222222222",
  currency: "VND",
  expectedAt: "2026-10-07",
  lines: [
    { sku: "SKU-001", description: null, quantityOrdered: 10, unitPrice: 50000 },
    { sku: "SKU-002", description: null, quantityOrdered: 5, unitPrice: 0 },
  ],
};

const pathsOf = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  r.success ? [] : (r.error?.issues ?? []).map((i) => i.path.join("."));
const issuePaths = (input: unknown) => pathsOf(createPoSchema.safeParse(input));

describe("createPoSchema — Input (BE CreatePurchaseOrderRequest)", () => {
  it("nhận PO hợp lệ (đơn giá 0 được phép — BE @PositiveOrZero)", () => {
    expect(createPoSchema.safeParse(validPo).success).toBe(true);
  });

  it("bắt buộc chọn NCC và ít nhất 1 dòng (BE @NotNull / @NotEmpty)", () => {
    expect(issuePaths({ ...validPo, supplierId: "  " })).toContain("supplierId");
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
      lines: [{ sku: "SKU-001", description: null, quantityOrdered: 1, unitPrice }],
    });
    expect(issuePaths(withPrice("VND", 1000.5))).toContain("lines.0.unitPrice");
    expect(createPoSchema.safeParse(withPrice("USD", 12.5)).success).toBe(true);
    expect(issuePaths(withPrice("USD", 12.345))).toContain("lines.0.unitPrice");
  });

  it("giới hạn BE: mô tả dòng ≤ 300 ký tự (VARCHAR(300)), SL đặt ≤ Java int", () => {
    const withLine = (line: Record<string, unknown>) => ({
      ...validPo,
      lines: [{ sku: "SKU-001", description: null, quantityOrdered: 1, unitPrice: 1, ...line }],
    });
    expect(issuePaths(withLine({ description: "a".repeat(301) }))).toContain("lines.0.description");
    expect(createPoSchema.safeParse(withLine({ description: "a".repeat(300) })).success).toBe(true);
    expect(issuePaths(withLine({ quantityOrdered: 2_147_483_648 }))).toContain(
      "lines.0.quantityOrdered",
    );
  });

  it("mã SKU theo định dạng BE `common.domain.Sku` (A-Z, 0-9, '-', 3–64 ký tự)", () => {
    const lines = [{ ...validPo.lines[0], sku: "ab" }];
    expect(issuePaths({ ...validPo, lines })).toContain("lines.0.sku");
  });

  it.each([0, -1, 1.5])("SL đặt %s bị chặn (BE int @Positive)", (q) => {
    const lines = [{ ...validPo.lines[0], quantityOrdered: q }];
    expect(issuePaths({ ...validPo, lines })).toContain("lines.0.quantityOrdered");
  });

  it("đơn giá âm bị chặn", () => {
    const lines = [{ ...validPo.lines[0], unitPrice: -1 }];
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

describe("receiveGoodsInputSchema (BE ReceiveGoodsRequest)", () => {
  it("nhận SL nguyên dương; chặn phiếu rỗng (BE @NotEmpty)", () => {
    expect(
      receiveGoodsInputSchema.safeParse({ lines: [{ lineId: "l", quantity: 3 }] }).success,
    ).toBe(true);
    expect(receiveGoodsInputSchema.safeParse({ lines: [] }).success).toBe(false);
  });

  it.each([0, 2.5])("chặn SL %s", (quantity) => {
    expect(receiveGoodsInputSchema.safeParse({ lines: [{ lineId: "l", quantity }] }).success).toBe(
      false,
    );
  });
});

describe("sendPoInputSchema (BE PurchaseOrder#confirmDeliveryDate)", () => {
  const today = "2026-10-02";

  it("giữ nguyên ngày giao đang lưu → không cần lý do", () => {
    const schema = sendPoInputSchema("2026-10-09", today);
    expect(schema.safeParse({ expectedAt: "2026-10-09", reason: "" }).success).toBe(true);
  });

  it("ngày giao trước hôm nay bị chặn (BE 409 CONFLICT)", () => {
    const schema = sendPoInputSchema("2026-09-20", today);
    expect(pathsOf(schema.safeParse({ expectedAt: "2026-09-20", reason: "" }))).toContain(
      "expectedAt",
    );
  });

  it("đổi ngày giao bắt buộc lý do", () => {
    const schema = sendPoInputSchema("2026-09-20", today);
    expect(pathsOf(schema.safeParse({ expectedAt: "2026-10-05", reason: "" }))).toContain("reason");
    expect(schema.safeParse({ expectedAt: "2026-10-05", reason: "NCC dời lịch" }).success).toBe(
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
