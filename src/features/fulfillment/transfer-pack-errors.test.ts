import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import {
  FULFILLMENT_ERROR_MESSAGES,
  PACKING_INVALID_RESPONSE_MESSAGE,
  TRANSFER_PACK_ERROR_MESSAGES,
  TRANSFER_PACK_STALE_ERROR_CODES,
  TRANSFER_PACK_VALIDATION_FIELD_MESSAGES,
  UI_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";

import { isStaleTransferPackError, transferPackErrorMessage } from "./transfer-pack-errors";

const api = (code: string, status = 409, fields: Record<string, string> = {}) =>
  new ApiError(status, code, "english", fields);

/** Mọi mã lỗi mới của BE PR #164 liên quan tới đóng gói chuyển kho phải có câu tiếng Việt riêng. */
const NEW_CODES = [
  "TRANSFER_NOT_FULL_TRUCKLOAD",
  "INVALID_TRANSFER_TRANSITION",
  "TRANSFER_ORDER_NOT_FOUND",
  "STOCK_CARTON_NOT_SHIPPABLE",
  "KIT_INCOMPLETE",
  "KIT_PART_COUNT_MISMATCH",
  "KIT_CONTENTS_INVALID",
  "KIT_ITEM_MISMATCH",
  "KIT_OVERRIDE_REASON_REQUIRED",
  "PACKING_TAKEN",
  "PACK_STATE_CONFLICT",
  "PACK_ITEM_NOT_IN_ORDER",
  "PACK_SCAN_AMBIGUOUS",
  "PACK_QUANTITY_EXCEEDS_ORDER",
  "PACKING_INCOMPLETE",
  "PACKAGE_NOT_SEALED",
  "OUT_OF_DATA_SCOPE",
  "NOT_FOUND",
  "RESERVATION_NOT_ACTIVE",
] as const;

describe("transferPackErrorMessage — mã BE → tiếng Việt", () => {
  it.each(NEW_CODES)("%s → câu của chuyển kho, không lộ message tiếng Anh", (code) => {
    const message = transferPackErrorMessage(api(code));
    expect(message).toBe(TRANSFER_PACK_ERROR_MESSAGES[code]);
    expect(message).not.toBe("english");
    expect(message).not.toBe(FULFILLMENT_ERROR_MESSAGES.generic);
  });

  it("chữ 'lệnh' thay 'đơn' ở các câu dùng chung với trạm đóng gói đơn", () => {
    for (const code of [
      "PACKING_TAKEN",
      "PACK_ITEM_NOT_IN_ORDER",
      "PACK_QUANTITY_EXCEEDS_ORDER",
    ] as const) {
      expect(TRANSFER_PACK_ERROR_MESSAGES[code]).toMatch(/lệnh/i);
    }
  });

  it("PACKING_TAKEN kèm tên người đang đóng → nêu tên", () => {
    expect(transferPackErrorMessage(api("PACKING_TAKEN"), { packerName: "Lan" })).toBe(
      UI_LABELS.transferPack.notice.takenByOther("Lan"),
    );
  });

  it("VALIDATION_FAILED: câu theo field BE nêu đầu tiên mà FE biết; không biết → câu chung", () => {
    expect(
      transferPackErrorMessage(api("VALIDATION_FAILED", 400, { lpn: "must not be blank" })),
    ).toBe(TRANSFER_PACK_VALIDATION_FIELD_MESSAGES.lpn);
    expect(transferPackErrorMessage(api("VALIDATION_FAILED", 400, { partCount: "x" }))).toBe(
      TRANSFER_PACK_VALIDATION_FIELD_MESSAGES.partCount,
    );
    expect(transferPackErrorMessage(api("VALIDATION_FAILED", 400, { note: "x" }))).toBe(
      TRANSFER_PACK_VALIDATION_FIELD_MESSAGES.note,
    );
    expect(transferPackErrorMessage(api("VALIDATION_FAILED", 400, { zzz: "x" }))).toBe(
      FULFILLMENT_ERROR_MESSAGES.VALIDATION_FAILED,
    );
  });

  it("mã chung: mạng, 403, khoá, khoá lạc quan; lỗi lạ → câu dự phòng; response hỏng (zod) → câu 'sai định dạng'", () => {
    expect(transferPackErrorMessage(api("NETWORK_ERROR", 0))).toBe(
      FULFILLMENT_ERROR_MESSAGES.NETWORK_ERROR,
    );
    expect(transferPackErrorMessage(api("FORBIDDEN", 403))).toBe(
      FULFILLMENT_ERROR_MESSAGES.FORBIDDEN,
    );
    expect(transferPackErrorMessage(api("LOCK_TIMEOUT"))).toBe(
      FULFILLMENT_ERROR_MESSAGES.LOCK_TIMEOUT,
    );
    expect(transferPackErrorMessage(api("OPTIMISTIC_LOCK"))).toBe(
      FULFILLMENT_ERROR_MESSAGES.OPTIMISTIC_LOCK,
    );
    expect(transferPackErrorMessage(api("SOMETHING_NEW", 500))).toBe(
      FULFILLMENT_ERROR_MESSAGES.generic,
    );
    expect(transferPackErrorMessage(new Error("boom"))).toBe(FULFILLMENT_ERROR_MESSAGES.generic);
    expect(transferPackErrorMessage(new ZodError([]))).toBe(PACKING_INVALID_RESPONSE_MESSAGE);
  });
});

describe("isStaleTransferPackError", () => {
  it("phiên / lệnh đã đổi ở nơi khác → tải lại; lỗi dữ liệu nhập thì không", () => {
    for (const code of TRANSFER_PACK_STALE_ERROR_CODES)
      expect(isStaleTransferPackError(api(code))).toBe(true);
    expect(isStaleTransferPackError(api("STOCK_CARTON_NOT_SHIPPABLE"))).toBe(false);
    expect(isStaleTransferPackError(api("KIT_PART_COUNT_MISMATCH", 422))).toBe(false);
    expect(isStaleTransferPackError(api("VALIDATION_FAILED", 400))).toBe(false);
    expect(isStaleTransferPackError(new ZodError([]))).toBe(true);
    expect(isStaleTransferPackError(new Error("x"))).toBe(false);
  });
});

describe("BE PR #164 final: mở phiên giữ hàng ở kho nguồn → INSUFFICIENT_STOCK", () => {
  it("INSUFFICIENT_STOCK có câu riêng; message BE nêu SKU thì kèm cần / khả dụng", () => {
    expect(transferPackErrorMessage(api("INSUFFICIENT_STOCK"))).toBe(
      TRANSFER_PACK_ERROR_MESSAGES.INSUFFICIENT_STOCK,
    );
    const detailed = new ApiError(
      409,
      "INSUFFICIENT_STOCK",
      "Insufficient stock for SKU TEE-BLK-M: requested 30, available 12",
    );
    expect(transferPackErrorMessage(detailed)).toBe(
      `${TRANSFER_PACK_ERROR_MESSAGES.INSUFFICIENT_STOCK} SKU TEE-BLK-M: cần 30, khả dụng 12.`,
    );
    expect(transferPackErrorMessage(detailed)).not.toMatch(/Insufficient/);
  });

  it("phần giữ hàng hết hiệu lực → tải lại phiên", () => {
    expect(isStaleTransferPackError(api("RESERVATION_NOT_ACTIVE"))).toBe(true);
    expect(isStaleTransferPackError(api("INSUFFICIENT_STOCK"))).toBe(false);
  });
});
