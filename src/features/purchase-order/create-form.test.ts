import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/error";

import { poCreateFieldErrors } from "./create-form-errors";
import { poCreateFormSchema } from "./create-form-schema";

const valid = {
  supplierId: "22222222-2222-4222-8222-222222222222",
  currency: "VND" as const,
  expectedDate: "",
  lines: [{ skuId: "SKU-001", description: "Sofa 3 chỗ", orderedQty: "2", unitPrice: "1000" }],
};
const paths = (input: unknown) => {
  const r = poCreateFormSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("poCreateFormSchema — lỗi gắn đúng path ô form", () => {
  it("form hợp lệ", () => {
    expect(paths(valid)).toEqual([]);
  });

  it("SKU trùng / đơn giá lẻ theo tiền tệ → lỗi ở đúng dòng", () => {
    const line = valid.lines[0];
    expect(paths({ ...valid, lines: [line, line] })).toContain("lines.1.skuId");
    expect(paths({ ...valid, lines: [{ ...line, unitPrice: "10.5" }] })).toContain(
      "lines.0.unitPrice",
    );
  });

  it("thiếu mô tả dòng → lỗi ở ô mô tả (BE #36 PO_LINE_DESCRIPTION_REQUIRED)", () => {
    expect(paths({ ...valid, lines: [{ ...valid.lines[0], description: "  " }] })).toContain(
      "lines.0.description",
    );
  });

  it("SL không phải số nguyên dương → lỗi ở ô SL", () => {
    expect(paths({ ...valid, lines: [{ ...valid.lines[0], orderedQty: "1.5" }] })).toContain(
      "lines.0.orderedQty",
    );
  });
});

describe("poCreateFieldErrors — lỗi BE → ô form", () => {
  it("field dòng của Spring (`lines[0].quantityOrdered`) → `lines.0.orderedQty`", () => {
    const err = new ApiError(400, "VALIDATION_FAILED", "x", {
      "lines[0].quantityOrdered": "must be positive",
      "lines[1].sku": "must not be blank",
      expectedAt: "bad",
    });
    expect(poCreateFieldErrors(err).map((e) => e.field)).toEqual([
      "lines.0.orderedQty",
      "lines.1.skuId",
      "expectedDate",
    ]);
  });

  it("NCC không tồn tại / ngừng hợp tác → ô Nhà cung cấp", () => {
    expect(poCreateFieldErrors(new ApiError(409, "SUPPLIER_INACTIVE", "x"))[0]?.field).toBe(
      "supplierId",
    );
    expect(poCreateFieldErrors(new ApiError(404, "SUPPLIER_NOT_FOUND", "x"))[0]?.field).toBe(
      "supplierId",
    );
  });

  it("lỗi không gắn field (IllegalArgumentException → 400 chung) → mảng rỗng, nơi gọi toast", () => {
    expect(poCreateFieldErrors(new ApiError(400, "VALIDATION_FAILED", "x"))).toEqual([]);
  });
});
