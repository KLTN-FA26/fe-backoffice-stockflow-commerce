import { describe, expect, it } from "vitest";

import { TRANSFER_ERROR_MESSAGES, TRANSFER_FIELD_MESSAGES as MSG } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { isStaleTransferError, stockErrorsByLine, transferErrorMessage } from "./errors";

describe("transferErrorMessage", () => {
  it("INSUFFICIENT_STOCK nói rõ SKU + SL cần / khả dụng (từ message BE InsufficientStockException)", () => {
    const error = new ApiError(
      409,
      "INSUFFICIENT_STOCK",
      "Insufficient stock for SKU SOFA-3S-GREY: requested 300, available 223",
    );
    expect(transferErrorMessage(error)).toBe(
      `${TRANSFER_ERROR_MESSAGES.INSUFFICIENT_STOCK} SKU SOFA-3S-GREY: cần 300, khả dụng 223.`,
    );
  });

  it("message BE đổi định dạng → vẫn có câu tiếng Việt chung, không lộ tiếng Anh", () => {
    const error = new ApiError(409, "INSUFFICIENT_STOCK", "Not enough");
    expect(transferErrorMessage(error)).toBe(TRANSFER_ERROR_MESSAGES.INSUFFICIENT_STOCK);
  });

  it("VALIDATION_FAILED không chỉ ra dòng nào → câu chung, không bảo 'xem ô được đánh dấu'", () => {
    const error = new ApiError(400, "VALIDATION_FAILED", "x", { lines: "size must be ≤ 200" });
    expect(transferErrorMessage(error)).toBe(TRANSFER_ERROR_MESSAGES.validationGeneral);
    const lineError = new ApiError(400, "VALIDATION_FAILED", "x", { "lines[0].sku": "bad" });
    expect(transferErrorMessage(lineError)).toBe(TRANSFER_ERROR_MESSAGES.VALIDATION_FAILED);
  });

  it("mã lạ → câu chung", () => {
    expect(transferErrorMessage(new ApiError(500, "BOOM", "x"))).toBe(
      TRANSFER_ERROR_MESSAGES.generic,
    );
  });

  it("lỗi dữ liệu cũ → cần tải lại", () => {
    expect(isStaleTransferError(new ApiError(409, "OPTIMISTIC_LOCK", ""))).toBe(true);
    expect(isStaleTransferError(new ApiError(409, "INSUFFICIENT_STOCK", ""))).toBe(false);
  });
});

describe("stockErrorsByLine — thiếu tồn theo dòng (SKU + lô)", () => {
  const lines = [
    { sku: "SOFA-3S-GREY", lotNumber: "" },
    { sku: "TABLE-OAK-160", lotNumber: "LOT-1" },
    { sku: "TABLE-OAK-160", lotNumber: "LOT-2" },
  ];
  const message = (sku: string) => `Insufficient stock for SKU ${sku}: requested 300, available 12`;

  it("contract đề xuất: BE trả fieldErrors theo dòng → đánh dấu đúng dòng, đúng lô, kèm số", () => {
    const error = new ApiError(409, "INSUFFICIENT_STOCK", message("TABLE-OAK-160"), {
      "lines[2].quantity": "requested 30, available 7",
    });
    expect(stockErrorsByLine(error, lines, "quantity")).toEqual({
      2: `${MSG.notEnoughStock} 7`,
    });
  });

  it("BE hiện tại (chỉ có SKU): đúng một dòng khớp → kèm số khả dụng", () => {
    const error = new ApiError(409, "INSUFFICIENT_STOCK", message("SOFA-3S-GREY"));
    expect(stockErrorsByLine(error, lines, "quantity")).toEqual({ 0: `${MSG.notEnoughStock} 12` });
  });

  it("BE hiện tại, nhiều dòng cùng SKU khác lô → đánh dấu các dòng đó, không gắn số", () => {
    const error = new ApiError(409, "INSUFFICIENT_STOCK", message("TABLE-OAK-160"));
    expect(stockErrorsByLine(error, lines, "quantity")).toEqual({
      1: MSG.notEnoughStockNoQty,
      2: MSG.notEnoughStockNoQty,
    });
  });

  it("xuất kho: dòng xuất 0 không trừ tồn → không bị đánh dấu khi dự phòng theo SKU", () => {
    const error = new ApiError(409, "INSUFFICIENT_STOCK", message("TABLE-OAK-160"));
    const dispatchLines = lines.map((line, i) => ({ ...line, skip: i === 1 }));
    expect(stockErrorsByLine(error, dispatchLines, "shippedQuantity")).toEqual({
      2: `${MSG.notEnoughStock} 12`,
    });
  });

  it("xuất kho đánh dấu theo shippedQuantity; lỗi khác → không đánh dấu", () => {
    const error = new ApiError(409, "INSUFFICIENT_STOCK", message("SOFA-3S-GREY"), {
      "lines[0].shippedQuantity": "requested 40, available 25",
    });
    expect(stockErrorsByLine(error, lines, "shippedQuantity")).toEqual({
      0: `${MSG.notEnoughStock} 25`,
    });
    expect(stockErrorsByLine(new ApiError(409, "OPTIMISTIC_LOCK", ""), lines, "quantity")).toEqual(
      {},
    );
  });
});

describe("lỗi mới của BE PR #164 (đóng gói chuyển kho, kế hoạch xe)", () => {
  it.each([
    "TRANSFER_DISPATCH_BY_LOAD_PLAN",
    "TRANSFER_GOODS_LEFT",
    "LOAD_PLAN_LOADING_STARTED",
    "TRANSFER_NOT_FULL_TRUCKLOAD",
    "TRANSFER_NOT_PACKED",
  ] as const)("%s → câu tiếng Việt riêng, không lộ message tiếng Anh", (code) => {
    const message = transferErrorMessage(new ApiError(409, code, "english message"));
    expect(message).toBe(TRANSFER_ERROR_MESSAGES[code]);
    expect(message).not.toBe(TRANSFER_ERROR_MESSAGES.generic);
  });

  it("xuất tay lệnh nguyên chuyến / dừng lấy hàng khi hàng đã rời kho / xe đang xếp → lệnh đã đổi: tải lại", () => {
    for (const code of [
      "TRANSFER_DISPATCH_BY_LOAD_PLAN",
      "TRANSFER_GOODS_LEFT",
      "LOAD_PLAN_LOADING_STARTED",
    ]) {
      expect(isStaleTransferError(new ApiError(409, code, ""))).toBe(true);
    }
    expect(isStaleTransferError(new ApiError(409, "TRANSFER_NOT_FULL_TRUCKLOAD", ""))).toBe(false);
  });
});
