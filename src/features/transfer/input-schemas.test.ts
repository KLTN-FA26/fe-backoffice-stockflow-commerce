import { describe, expect, it } from "vitest";

import { TRANSFER_FIELD_MESSAGES as MSG } from "@/constants";

import {
  buildDispatchSchema,
  transferFormSchema,
  transferReasonInputSchema,
} from "./input-schemas";

const valid = {
  fromWarehouseId: "wh-a",
  toWarehouseId: "wh-b",
  reason: "",
  expectedDate: "",
  lines: [{ sku: "CUP-PP-500", lotNumber: "", quantity: 10 }],
};

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((i) => i.message) ?? [];

describe("transferFormSchema (CreateTransferOrderRequest + BR docs 10 §6)", () => {
  it("form hợp lệ", () => {
    expect(transferFormSchema.safeParse(valid).success).toBe(true);
  });

  it.each(["CUP_12", "A.B", "x", "cup-pp.500_a"])(
    "SKU %s hợp lệ theo BE @ValidSku (có '_' / '.', 1 ký tự, chữ thường)",
    (sku) => {
      const result = transferFormSchema.safeParse({
        ...valid,
        lines: [{ sku, lotNumber: "", quantity: 1 }],
      });
      expect(result.success).toBe(true);
    },
  );

  it("BR-01: kho nguồn trùng kho đích → lỗi ở kho đích", () => {
    const result = transferFormSchema.safeParse({ ...valid, toWarehouseId: "wh-a" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["toWarehouseId"]);
    expect(messages(result)).toContain(MSG.sameWarehouse);
  });

  it("trùng SKU (không phân biệt hoa thường) + cùng lô → lỗi dòng sau", () => {
    const result = transferFormSchema.safeParse({
      ...valid,
      lines: [
        { sku: "CUP-PP-500", lotNumber: "lot-1", quantity: 1 },
        { sku: "cup-pp-500", lotNumber: "lot-1", quantity: 2 },
      ],
    });
    expect(result.error?.issues[0]?.path).toEqual(["lines", 1, "sku"]);
  });

  it("lô so đúng nguyên văn như BE: cùng SKU, lô khác hoa thường → hai dòng hợp lệ", () => {
    const result = transferFormSchema.safeParse({
      ...valid,
      lines: [
        { sku: "CUP-PP-500", lotNumber: "lot-a", quantity: 1 },
        { sku: "CUP-PP-500", lotNumber: "LOT-A", quantity: 2 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("cùng SKU khác lô thì hợp lệ", () => {
    const result = transferFormSchema.safeParse({
      ...valid,
      lines: [
        { sku: "CUP-PP-500", lotNumber: "LOT-1", quantity: 1 },
        { sku: "CUP-PP-500", lotNumber: "LOT-2", quantity: 2 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("SKU sai định dạng BE, SL ngoài 1..1.000.000, không có dòng", () => {
    expect(
      messages(
        transferFormSchema.safeParse({
          ...valid,
          lines: [{ sku: "a b", lotNumber: "", quantity: 1 }],
        }),
      ),
    ).toContain(MSG.skuFormat);
    expect(
      messages(
        transferFormSchema.safeParse({
          ...valid,
          lines: [{ sku: "SKU-1", lotNumber: "", quantity: 0 }],
        }),
      ),
    ).toContain(MSG.quantity);
    expect(
      messages(
        transferFormSchema.safeParse({
          ...valid,
          lines: [{ sku: "SKU-1", lotNumber: "", quantity: 1_000_001 }],
        }),
      ),
    ).toContain(MSG.quantityMax);
    expect(messages(transferFormSchema.safeParse({ ...valid, lines: [] }))).toContain(
      MSG.linesRequired,
    );
  });
});

describe("transferFormSchema.deliveryMode (LP2-8, BE PR #164)", () => {
  it("mặc định nguyên chuyến (FULL_TRUCKLOAD) như BE; nhận PARCEL; giá trị lạ → lỗi", () => {
    expect(transferFormSchema.parse(valid).deliveryMode).toBe("FULL_TRUCKLOAD");
    expect(transferFormSchema.parse({ ...valid, deliveryMode: "PARCEL" }).deliveryMode).toBe(
      "PARCEL",
    );
    const bad = transferFormSchema.safeParse({ ...valid, deliveryMode: "DRONE" });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.path).toEqual(["deliveryMode"]);
  });
});

describe("buildDispatchSchema (TransferOrderServiceImpl#dispatch)", () => {
  const schema = buildDispatchSchema([
    { lineId: "l-1", requested: 40 },
    { lineId: "l-2", requested: 20 },
  ]);

  it("xuất thiếu (0..SL yêu cầu) được phép", () => {
    const result = schema.safeParse({
      lines: [
        { lineId: "l-1", shippedQuantity: 40 },
        { lineId: "l-2", shippedQuantity: 0 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("vượt SL yêu cầu → lỗi ở đúng dòng", () => {
    const result = schema.safeParse({
      lines: [
        { lineId: "l-1", shippedQuantity: 41 },
        { lineId: "l-2", shippedQuantity: 0 },
      ],
    });
    expect(result.error?.issues[0]?.path).toEqual(["lines", 0, "shippedQuantity"]);
  });

  it("tổng 0 đơn vị → phải xuất ít nhất 1", () => {
    const result = schema.safeParse({
      lines: [
        { lineId: "l-1", shippedQuantity: 0 },
        { lineId: "l-2", shippedQuantity: 0 },
      ],
    });
    expect(messages(result)).toContain(MSG.shippedTotal);
  });
});

describe("transferReasonInputSchema (BE ReasonRequest)", () => {
  it("bắt buộc lý do, tối đa 500 ký tự", () => {
    expect(transferReasonInputSchema.safeParse({ reason: "  " }).success).toBe(false);
    expect(transferReasonInputSchema.safeParse({ reason: "x".repeat(501) }).success).toBe(false);
    expect(transferReasonInputSchema.safeParse({ reason: "Sai kho đích" }).success).toBe(true);
  });
});
