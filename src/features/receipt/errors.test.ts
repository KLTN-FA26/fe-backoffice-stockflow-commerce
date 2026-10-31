import { describe, expect, it } from "vitest";

import {
  RECEIPT_CARTON_ERROR_MESSAGES,
  RECEIPT_CARTON_VALIDATION_MESSAGES,
  RECEIPT_DECISION_ERROR_MESSAGES,
  RECEIPT_ERROR_MESSAGES,
} from "@/constants";
import { ApiError } from "@/lib/api/error";

import {
  isStaleReceiptError,
  receiptDecisionErrorMessage,
  receiptErrorMessage,
  receiptLineFieldErrors,
} from "./errors";

describe("receipt errors", () => {
  it("mã lỗi nghiệp vụ BE → câu tiếng Việt, không lộ message tiếng Anh", () => {
    const error = new ApiError(
      409,
      "OVER_RECEIPT_TOLERANCE",
      "Line 2 of PO-HCM-DEMO-0002 would be received 7 of 6",
    );
    expect(receiptErrorMessage(error)).toBe(RECEIPT_ERROR_MESSAGES.OVER_RECEIPT_TOLERANCE);
  });

  it("lỗi không phải ApiError → câu chung", () => {
    expect(receiptErrorMessage(new Error("boom"))).toBe(RECEIPT_ERROR_MESSAGES.generic);
  });

  it("lỗi trạng thái đã đổi → cần tải lại dữ liệu", () => {
    expect(isStaleReceiptError(new ApiError(409, "INVALID_RECEIPT_TRANSITION", "x"))).toBe(true);
    expect(isStaleReceiptError(new ApiError(409, "LOCATION_AREA_MISMATCH", "x"))).toBe(false);
  });

  it("fieldErrors lines[i].field của @Valid → lỗi theo dòng form", () => {
    const error = new ApiError(400, "VALIDATION_FAILED", "invalid", {
      "lines[1].locationCode": "không được để trống",
      deliveryNote: "quá dài",
    });
    expect(receiptLineFieldErrors(error)).toEqual([
      { index: 1, field: "locationCode", message: "không được để trống" },
    ]);
  });
});

describe("receipt errors — duyệt nhận vượt dung sai (BR-RCP-001)", () => {
  it.each([
    "RECEIPT_SELF_APPROVAL",
    "RECEIPT_APPROVAL_REASON_REQUIRED",
    "RECEIPT_PACKAGES_EXCEED_LINE",
  ])("%s → câu tiếng Việt, không lộ message tiếng Anh của BE", (code) => {
    const message = receiptErrorMessage(new ApiError(409, code, "English message from BE"));
    expect(message).toBe(RECEIPT_ERROR_MESSAGES[code as keyof typeof RECEIPT_ERROR_MESSAGES]);
    expect(message).not.toContain("English");
  });

  it("RECEIPT_SELF_APPROVAL không phải lỗi dữ liệu cũ: dialog giữ nguyên, không tải lại", () => {
    expect(isStaleReceiptError(new ApiError(409, "RECEIPT_SELF_APPROVAL", "x"))).toBe(false);
  });
});

describe("receipt errors — phiếu không có PO (BR-RCP-002)", () => {
  it.each([
    "BLIND_RECEIPT_REASON_REQUIRED",
    "RECEIPT_REFERENCE_SUPPLIER_MISMATCH",
    "SUPPLIER_NOT_FOUND",
    "INVENTORY_ITEM_NOT_FOUND",
    "RECEIPT_LINE_NOT_ON_PO",
  ])("%s → câu tiếng Việt, không lộ message tiếng Anh của BE", (code) => {
    const message = receiptErrorMessage(new ApiError(409, code, "English message from BE"));
    expect(message).toBe(RECEIPT_ERROR_MESSAGES[code as keyof typeof RECEIPT_ERROR_MESSAGES]);
    expect(message).not.toContain("English");
  });

  it("lỗi theo ô của dòng gọi bằng SKU map về đúng ô", () => {
    const error = new ApiError(409, "INVENTORY_ITEM_NOT_FOUND", "x", {
      "lines[1].sku": "No inventory item with SKU NOPE",
    });
    expect(receiptLineFieldErrors(error)).toEqual([
      { index: 1, field: "sku", message: "No inventory item with SKU NOPE" },
    ]);
  });
});

describe("receipt errors — thùng có LPN (SCRUM-473)", () => {
  it("field error lồng nhau lines[i].packages[j].x → đường dẫn form packages.j.x", () => {
    const error = new ApiError(
      400,
      "VALIDATION_FAILED",
      "invalid",
      {
        "lines[0].packages[1].lpn": "LPN-1 is listed twice",
        "lines[2].packages": "The cartons hold 101 units, more than the line's 100",
        "lines[2].unitOfMeasure": "Cartons need the packing unit they are in",
      },
      undefined,
      {
        "lines[0].packages[1].lpn": "VALIDATION_FAILED",
        "lines[2].packages": "RECEIPT_PACKAGES_EXCEED_LINE",
        "lines[2].unitOfMeasure": "VALIDATION_FAILED",
      },
    );
    expect(receiptLineFieldErrors(error)).toEqual([
      { index: 0, field: "packages.1.lpn", message: RECEIPT_CARTON_VALIDATION_MESSAGES.lpn },
      {
        index: 2,
        field: "packages",
        message: RECEIPT_CARTON_ERROR_MESSAGES.RECEIPT_PACKAGES_EXCEED_LINE,
      },
      {
        index: 2,
        field: "unitOfMeasure",
        message: RECEIPT_CARTON_VALIDATION_MESSAGES.unitOfMeasure,
      },
    ]);
  });

  it.each([
    "RECEIPT_LINE_UNIT_INVALID",
    "UOM_CONVERSION_NOT_FOUND",
    "RECEIPT_PACKAGES_NOT_SUPPORTED",
    "RECEIPT_LINE_HAS_PACKAGES",
    "STOCK_PACKAGE_LABELS_TOO_MANY",
  ])("%s → câu tiếng Việt khi lưu kiểm đếm / in nhãn", (code) => {
    const message = receiptErrorMessage(new ApiError(409, code, "English message from BE"));
    expect(message).toBe(
      RECEIPT_CARTON_ERROR_MESSAGES[code as keyof typeof RECEIPT_CARTON_ERROR_MESSAGES],
    );
  });

  it("thùng đã đổi ở nơi khác → tải lại dữ liệu", () => {
    expect(isStaleReceiptError(new ApiError(404, "STOCK_PACKAGE_NOT_FOUND", "x"))).toBe(true);
    expect(isStaleReceiptError(new ApiError(409, "INVALID_STOCK_PACKAGE_TRANSITION", "x"))).toBe(
      true,
    );
  });

  it("ngữ cảnh duyệt phiếu: cùng mã thùng nhưng câu nói về việc cắt phần vượt", () => {
    const error = new ApiError(422, "RECEIPT_PACKAGES_EXCEED_LINE", "x");
    expect(receiptDecisionErrorMessage(error)).toBe(
      RECEIPT_DECISION_ERROR_MESSAGES.RECEIPT_PACKAGES_EXCEED_LINE,
    );
    expect(receiptDecisionErrorMessage(new ApiError(409, "RECEIPT_SELF_APPROVAL", "x"))).toBe(
      RECEIPT_ERROR_MESSAGES.RECEIPT_SELF_APPROVAL,
    );
  });
});
