import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { PO_ERROR_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { poCreateFieldErrors } from "./create-form-errors";
import { isStalePoError, poErrorMessage } from "./errors";

import type { PoCreateFormLine } from "./create-form-schema";

describe("poErrorMessage — lỗi BE → câu tiếng Việt", () => {
  it("response sai hợp đồng (ZodError) / lỗi lạ → câu chung, không lộ message thô", () => {
    expect(poErrorMessage(new ZodError([]))).toBe(PO_ERROR_MESSAGES.CONTRACT_MISMATCH);
    expect(poErrorMessage(new Error("boom"))).toBe(PO_ERROR_MESSAGES.generic);
  });

  it("fieldErrors của dòng → 'Dòng n — <nhãn field>'", () => {
    const err = new ApiError(400, "VALIDATION_FAILED", "x", {
      "lines[1].quantityOrdered": "must be positive",
    });
    expect(poErrorMessage(err)).toBe(`${PO_ERROR_MESSAGES.VALIDATION_FAILED}: Dòng 2 — SL đặt`);
  });

  it("duyệt chính đơn mình gửi → 409 SELF_APPROVAL_NOT_ALLOWED có câu riêng (BR-PO-002)", () => {
    const err = new ApiError(409, "SELF_APPROVAL_NOT_ALLOWED", "x");
    expect(poErrorMessage(err)).toBe(PO_ERROR_MESSAGES.SELF_APPROVAL_NOT_ALLOWED);
  });

  it("gửi NCC bị 409 CONFLICT → giải thích ngày giao / NCC", () => {
    const err = new ApiError(409, "CONFLICT", "Confirm a delivery date…");
    expect(poErrorMessage(err, "send")).toBe(PO_ERROR_MESSAGES.sendSupplierUnavailable);
    expect(poErrorMessage(err)).toBe(PO_ERROR_MESSAGES.CONFLICT);
  });

  it("mã lạ: 403 → không có quyền, 404 → không tìm thấy PO, còn lại → câu chung", () => {
    expect(poErrorMessage(new ApiError(403, "SOMETHING_NEW", "x"))).toBe(
      PO_ERROR_MESSAGES.FORBIDDEN,
    );
    expect(poErrorMessage(new ApiError(404, "SOMETHING_NEW", "x"))).toBe(
      PO_ERROR_MESSAGES.PURCHASE_ORDER_NOT_FOUND,
    );
    expect(poErrorMessage(new ApiError(500, "SOMETHING_NEW", "x"))).toBe(PO_ERROR_MESSAGES.generic);
  });
});

describe("poErrorMessage — mã lỗi nghiệp vụ BE #36 (9fbb90f)", () => {
  const codes = [
    ["PO_DELIVERY_DATE_REQUIRED", 400],
    ["PO_REASON_REQUIRED", 400],
    ["PO_SUPPLIER_RESPONSE_INVALID", 400],
    ["PO_COMMUNICATION_NOT_CONFIGURED", 409],
    ["PO_LINE_DESCRIPTION_REQUIRED", 400],
    ["SUPPLIER_DELIVERY_CONTACT_INVALID", 400],
    ["SUPPLIER_PROFILE_INVALID", 400],
    ["INVALID_SUPPLIER_CONFIRMATION", 409],
  ] as const;

  it.each(codes)("%s → câu riêng, không rơi vào câu chung 'thử lại'", (code, status) => {
    const message = poErrorMessage(new ApiError(status, code, "x"), "send");
    expect(message).toBe(PO_ERROR_MESSAGES[code]);
    expect(message).not.toBe(PO_ERROR_MESSAGES.generic);
  });

  it("gửi NCC 409 CONFLICT chung (không phải mã cụ thể) → câu NCC không nhận được PO", () => {
    expect(poErrorMessage(new ApiError(409, "CONFLICT", "x"), "send")).toBe(
      PO_ERROR_MESSAGES.sendSupplierUnavailable,
    );
  });

  it("khôi phục gửi 409 CONFLICT → câu riêng của khôi phục, không phải câu xung đột chung", () => {
    const err = new ApiError(
      409,
      "CONFLICT",
      "An active supplier with a delivery contact is required",
    );
    expect(poErrorMessage(err, "recover")).toBe(PO_ERROR_MESSAGES.recoverConflict);
    // Mã cụ thể vẫn thắng ngữ cảnh
    expect(poErrorMessage(new ApiError(400, "PO_REASON_REQUIRED", "x"), "recover")).toBe(
      PO_ERROR_MESSAGES.PO_REASON_REQUIRED,
    );
  });
});

describe("isStalePoError — dữ liệu trên màn đã cũ, cần tải lại PO", () => {
  it("409 và 400 không field → cũ; 400 có field / lỗi khác → không", () => {
    expect(isStalePoError(new ApiError(409, "INVALID_PURCHASE_ORDER_TRANSITION", "x"))).toBe(true);
    expect(isStalePoError(new ApiError(400, "VALIDATION_FAILED", "x"))).toBe(true);
    expect(isStalePoError(new ApiError(400, "VALIDATION_FAILED", "x", { reason: "blank" }))).toBe(
      false,
    );
    expect(isStalePoError(new Error("x"))).toBe(false);
  });
});

function lineWithTerms(moq: number, packSize: number): PoCreateFormLine {
  return {
    skuId: "sku",
    description: "",
    orderedQty: "1",
    unitPrice: "",
    taxRate: "",
    lineId: "",
    terms: { moq, packSize, price: 1, currency: "VND", effectiveLeadTimeDays: 1 },
  };
}

describe("poCreateFieldErrors — SUPPLIER_TERMS_VIOLATED / SKU_NOT_PURCHASABLE (#30)", () => {
  it("SUPPLIER_TERMS_VIOLATED: 3 dòng lỗi → 3 lỗi đúng lines.i.<ô>", () => {
    const err = new ApiError(409, "SUPPLIER_TERMS_VIOLATED", "x", {
      "lines[0].sku": "SUPPLIER_ITEM_NOT_LISTED",
      "lines[1].quantityOrdered": "PO_LINE_BELOW_MOQ",
      "lines[2].unitPrice": "PO_LINE_PRICE_REQUIRED",
    });
    const lines = [lineWithTerms(1, 1), lineWithTerms(10, 5), lineWithTerms(1, 1)];
    expect(poCreateFieldErrors(err, lines)).toEqual([
      { field: "lines.0.skuId", message: PO_ERROR_MESSAGES.SUPPLIER_ITEM_NOT_LISTED },
      { field: "lines.1.orderedQty", message: "SL tối thiểu 10, theo bội số 5" },
      { field: "lines.2.unitPrice", message: PO_ERROR_MESSAGES.PO_LINE_PRICE_REQUIRED },
    ]);
  });

  it("lỗi SL hiện số MOQ/quy cách của chính dòng đó; không có terms → câu MOQ chung", () => {
    const err = new ApiError(409, "SUPPLIER_TERMS_VIOLATED", "x", {
      "lines[0].quantityOrdered": "PO_LINE_BELOW_MOQ",
      "lines[1].quantityOrdered": "PO_LINE_BELOW_MOQ",
    });
    const noTerms: PoCreateFormLine = { ...lineWithTerms(1, 1), terms: null };
    const result = poCreateFieldErrors(err, [lineWithTerms(24, 12), noTerms]);
    expect(result[0]?.message).toBe("SL tối thiểu 24, theo bội số 12");
    expect(result[1]?.message).toBe(PO_ERROR_MESSAGES.PO_LINE_BELOW_MOQ);
  });

  it("SKU_NOT_PURCHASABLE → lines.0.skuId", () => {
    const err = new ApiError(409, "SKU_NOT_PURCHASABLE", "x", { "lines[0].sku": "x" });
    expect(poCreateFieldErrors(err, [lineWithTerms(1, 1)])).toEqual([
      { field: "lines.0.skuId", message: PO_ERROR_MESSAGES.SKU_NOT_PURCHASABLE },
    ]);
  });

  it("poErrorMessage(SUPPLIER_TERMS_VIOLATED / PURCHASE_ORDER_NOT_EDITABLE) là câu tiếng Việt", () => {
    for (const code of ["SUPPLIER_TERMS_VIOLATED", "PURCHASE_ORDER_NOT_EDITABLE"] as const) {
      const message = poErrorMessage(new ApiError(409, code, "english"));
      expect(message).toBe(PO_ERROR_MESSAGES[code]);
      expect(message).not.toBe(PO_ERROR_MESSAGES.generic);
    }
  });
});
