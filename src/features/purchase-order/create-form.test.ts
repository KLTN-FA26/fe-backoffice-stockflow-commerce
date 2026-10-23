import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/error";

import { poCreateFieldErrors } from "./create-form-errors";
import { poCreateFormSchema, poFormSchema } from "./create-form-schema";
import { orderQuantityIssues } from "./line-terms";

const valid = {
  supplierId: "22222222-2222-4222-8222-222222222222",
  warehouseId: "d99123fd-2997-4751-6bb9-e10a2e6d9949",
  currency: "VND" as const,
  expectedDate: "",
  note: "",
  lines: [
    {
      skuId: "SKU-001",
      description: "Sofa 3 chỗ",
      orderedQty: "2",
      unitPrice: "1000",
      taxRate: "",
      lineId: "",
      terms: { moq: 1, packSize: 1, price: 900, currency: "VND", effectiveLeadTimeDays: 7 },
    },
  ],
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

  it("chưa chọn kho nhận → lỗi ở ô kho (SCRUM-390)", () => {
    expect(paths({ ...valid, warehouseId: "" })).toContain("warehouseId");
  });

  it("mô tả dòng để trống được (BE PR #71 lấy tên sản phẩm); quá 255 ký tự → lỗi ở ô mô tả", () => {
    expect(paths({ ...valid, lines: [{ ...valid.lines[0], description: "  " }] })).toEqual([]);
    expect(
      paths({ ...valid, lines: [{ ...valid.lines[0], description: "a".repeat(256) }] }),
    ).toContain("lines.0.description");
  });

  it("đơn giá 0 → lỗi ở ô đơn giá (BE > 0)", () => {
    expect(paths({ ...valid, lines: [{ ...valid.lines[0], unitPrice: "0" }] })).toContain(
      "lines.0.unitPrice",
    );
  });

  it("thuế suất ngoài 0–100 → lỗi ở ô thuế; để trống được (= 0)", () => {
    expect(paths({ ...valid, lines: [{ ...valid.lines[0], taxRate: "101" }] })).toContain(
      "lines.0.taxRate",
    );
    expect(paths({ ...valid, lines: [{ ...valid.lines[0], taxRate: "8" }] })).toEqual([]);
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

  it("kho nhận (requireReceivingWarehouse): 404 / 409 WAREHOUSE_INACTIVE / 403 ngoài phạm vi → ô Kho nhận", () => {
    for (const [status, code] of [
      [404, "WAREHOUSE_NOT_FOUND"],
      [409, "WAREHOUSE_INACTIVE"],
      [403, "OUT_OF_DATA_SCOPE"],
    ] as const) {
      const [first] = poCreateFieldErrors(new ApiError(status, code, "x"));
      expect(first?.field).toBe("warehouseId");
      expect(first?.message).toBeTruthy();
    }
  });

  it("lỗi không gắn field (IllegalArgumentException → 400 chung) → mảng rỗng, nơi gọi toast", () => {
    expect(poCreateFieldErrors(new ApiError(400, "VALIDATION_FAILED", "x"))).toEqual([]);
  });
});

const catalogLine = (over: Record<string, unknown>) => ({ ...valid.lines[0], ...over });
const withLine = (over: Record<string, unknown>, form: object = {}) => ({
  ...valid,
  ...form,
  lines: [catalogLine(over)],
});

describe("điều khoản danh mục NCC trên dòng PO", () => {
  it("orderQuantityIssues(3, {moq:10, packSize:5}) → cả hai lỗi; 15 → []; 12 → NOT_PACK_MULTIPLE", () => {
    const t = { moq: 10, packSize: 5 };
    expect(orderQuantityIssues(3, t)).toEqual(["BELOW_MOQ", "NOT_PACK_MULTIPLE"]);
    expect(orderQuantityIssues(15, t)).toEqual([]);
    expect(orderQuantityIssues(12, t)).toEqual(["NOT_PACK_MULTIPLE"]);
  });

  it("SL 3 với moq 10 → lỗi orderedQty có chữ 10 và 5", () => {
    const terms = { moq: 10, packSize: 5, price: 900, currency: "VND", effectiveLeadTimeDays: 7 };
    const r = poCreateFormSchema.safeParse(withLine({ orderedQty: "3", terms }));
    const msg = r.success
      ? ""
      : r.error.issues.find((i) => i.path.join(".") === "lines.0.orderedQty")?.message;
    expect(msg).toContain("10");
    expect(msg).toContain("5");
  });

  it("giá trống, cùng tiền tệ, dòng mới → hợp lệ", () => {
    expect(paths(withLine({ unitPrice: "" }))).toEqual([]);
  });

  it("giá trống, danh mục USD còn PO VND → lỗi unitPrice", () => {
    const terms = { moq: 1, packSize: 1, price: 9, currency: "USD", effectiveLeadTimeDays: 7 };
    expect(paths(withLine({ unitPrice: "", terms }))).toContain("lines.0.unitPrice");
  });

  it("giá trống ở dòng có lineId → lỗi unitPrice", () => {
    expect(paths(withLine({ unitPrice: "", lineId: "line-1" }))).toContain("lines.0.unitPrice");
  });

  it("có skuId mà không có terms → lỗi skuId", () => {
    expect(paths(withLine({ terms: null }))).toContain("lines.0.skuId");
  });

  it("tiền tệ: màn tạo chỉ VND/USD/CNY; màn sửa (cố định, BR-07) nhận đúng tiền tệ của PO", () => {
    const eur = {
      ...valid,
      currency: "EUR",
      lines: valid.lines.map((l) => ({ ...l, terms: null })),
    };
    const issuesOf = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
      r.success ? [] : (r.error?.issues ?? []).map((i) => i.path.join("."));
    expect(issuesOf(poCreateFormSchema.safeParse(eur))).toContain("currency");
    const edit = poFormSchema({ requireExpectedDate: true, currencyFixed: true });
    expect(issuesOf(edit.safeParse({ ...eur, expectedDate: "2026-11-01" }))).not.toContain(
      "currency",
    );
  });

  it("maxLines (màn sửa nháp, BE @Size(max = 200)) → quá trần báo ở `lines`; màn tạo không giới hạn", () => {
    const many = { ...valid, lines: Array.from({ length: 3 }, () => valid.lines[0]) };
    const capped = poFormSchema({ requireExpectedDate: false, maxLines: 2 }).safeParse(many);
    expect(capped.success ? [] : capped.error.issues.map((i) => i.path.join("."))).toContain(
      "lines",
    );
    expect(paths(many)).not.toContain("lines");
  });

  it("savedLinesWithoutTerms (sửa nháp thiếu quyền danh mục) → dòng đã lưu không báo BR-01; dòng mới vẫn báo", () => {
    const saved = {
      ...valid.lines[0],
      lineId: "33333333-3333-4333-8333-333333333333",
      terms: null,
    };
    const fresh = { ...valid.lines[0], skuId: "SKU-NEW", terms: null };
    const r = poFormSchema({ requireExpectedDate: false, savedLinesWithoutTerms: true }).safeParse({
      ...valid,
      lines: [saved, fresh],
    });
    const issues = r.success ? [] : r.error.issues.map((i) => i.path.join("."));
    expect(issues).not.toContain("lines.0.skuId");
    expect(issues).toContain("lines.1.skuId");
    expect(paths({ ...valid, lines: [saved] })).toContain("lines.0.skuId");
  });

  it("requireExpectedDate: true + ngày trống → lỗi expectedDate", () => {
    const r = poFormSchema({ requireExpectedDate: true }).safeParse(valid);
    expect(r.success ? [] : r.error.issues.map((i) => i.path.join("."))).toContain("expectedDate");
    expect(paths(valid)).not.toContain("expectedDate");
  });
});
