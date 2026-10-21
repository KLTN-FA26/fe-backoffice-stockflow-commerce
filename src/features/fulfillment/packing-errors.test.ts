import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  FULFILLMENT_ERROR_MESSAGES,
  PACKING_ERROR_MESSAGES,
  PACKING_INVALID_RESPONSE_MESSAGE,
  PACKING_VALIDATION_FIELD_MESSAGES,
  UI_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";

import {
  isRetryablePackingError,
  isStalePackingError,
  packingErrorMessage,
} from "./packing-errors";

/** Mã lỗi BE PR #136 (ErrorCode.java) mà trạm đóng gói phải dịch. */
const BE_CODES = [
  ["PACKING_NOT_READY", 409],
  ["PACKING_TAKEN", 409],
  ["PACK_STATE_CONFLICT", 409],
  ["PACK_ITEM_NOT_IN_ORDER", 409],
  ["PACK_SCAN_AMBIGUOUS", 409],
  ["PACK_SCAN_ID_CONFLICT", 409],
  ["PACK_QUANTITY_EXCEEDS_ORDER", 409],
  ["PACK_QUANTITY_EXCEEDS_PICKED", 409],
  ["PACK_LOT_MISMATCH", 409],
  ["PACK_SERIAL_MISMATCH", 409],
  ["PACKAGE_SEALED", 409],
  ["PACKAGE_EMPTY", 409],
  ["PACKAGE_NOT_SEALED", 409],
  ["PACKAGE_SHIPPED", 409],
  ["PACKING_INCOMPLETE", 409],
  ["PACK_PARTIAL_NOT_ALLOWED", 409],
  ["PACK_NOTHING_TO_SHIP", 409],
  ["PACKAGE_NOT_FOUND", 404],
  ["OUT_OF_DATA_SCOPE", 403],
] as const;

const zodError = () => {
  const result = z.object({ wanted: z.number() }).safeParse({});
  if (result.success) throw new Error("expected a parse failure");
  return result.error;
};

const err = (code: string, status = 409, fieldErrors?: Record<string, string>) =>
  new ApiError(status, code, "English message from BE with a uuid 3f2c9a10", fieldErrors);

describe("packingErrorMessage — mọi mã lỗi BE PR #136 → tiếng Việt, không lộ message tiếng Anh của BE", () => {
  it.each(BE_CODES)("%s", (code, status) => {
    const message = packingErrorMessage(err(code, status));
    expect(message).toBe(PACKING_ERROR_MESSAGES[code]);
    expect(message).not.toMatch(/English message|uuid/);
    // Có dấu tiếng Việt: không phải câu tiếng Anh
    expect(message).toMatch(/[àáâãèéêìíòóôõùúăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữự]/i);
  });

  it("PACKING_TAKEN nêu tên người đang đóng khi biết (BE không kèm tên)", () => {
    expect(packingErrorMessage(err("PACKING_TAKEN"), { packerName: "Nguyễn Văn Đạt" })).toBe(
      UI_LABELS.packing.notice.takenTitle("Nguyễn Văn Đạt"),
    );
    expect(packingErrorMessage(err("PACKING_TAKEN"))).toBe(PACKING_ERROR_MESSAGES.PACKING_TAKEN);
  });

  it("VALIDATION_FAILED: câu theo field BE nêu (số đo, lô, serial, ghi chú); không biết field → câu chung", () => {
    expect(
      packingErrorMessage(err("VALIDATION_FAILED", 400, { weightKg: "must be greater than 0" })),
    ).toBe(PACKING_VALIDATION_FIELD_MESSAGES.weightKg);
    expect(packingErrorMessage(err("VALIDATION_FAILED", 400, { lotNumber: "required" }))).toMatch(
      /lô/,
    );
    expect(
      packingErrorMessage(err("VALIDATION_FAILED", 400, { serialNumber: "required" })),
    ).toMatch(/serial/);
    expect(packingErrorMessage(err("VALIDATION_FAILED", 400, { note: "required" }))).toMatch(
      /lý do/,
    );
    expect(packingErrorMessage(err("VALIDATION_FAILED", 400, { other: "x" }))).toBe(
      FULFILLMENT_ERROR_MESSAGES.VALIDATION_FAILED,
    );
  });

  it("lỗi chung của BE (mất mạng, khoá bận, 404 task) và lỗi không phải ApiError", () => {
    expect(packingErrorMessage(new ApiError(0, "NETWORK_ERROR", "x"))).toBe(
      FULFILLMENT_ERROR_MESSAGES.NETWORK_ERROR,
    );
    expect(packingErrorMessage(err("LOCK_TIMEOUT"))).toBe(FULFILLMENT_ERROR_MESSAGES.LOCK_TIMEOUT);
    expect(packingErrorMessage(err("NOT_FOUND", 404))).toBe(PACKING_ERROR_MESSAGES.NOT_FOUND);
    expect(packingErrorMessage(new Error("boom"))).toBe(FULFILLMENT_ERROR_MESSAGES.generic);
  });
});

describe("isStalePackingError — mã làm phiên cũ → tải lại", () => {
  it.each([
    "PACKING_NOT_READY",
    "PACKING_TAKEN",
    "PACK_STATE_CONFLICT",
    "PACK_QUANTITY_EXCEEDS_ORDER",
    "PACK_QUANTITY_EXCEEDS_PICKED",
    "PACKAGE_SEALED",
    "PACKAGE_EMPTY",
    "PACKAGE_NOT_SEALED",
    "PACKAGE_SHIPPED",
    "PACKAGE_NOT_FOUND",
    "PACK_LOT_MISMATCH",
    "PACKING_INCOMPLETE",
    "PACK_NOTHING_TO_SHIP",
    "CONFLICT",
    "OPTIMISTIC_LOCK",
  ])("%s → tải lại", (code) => {
    expect(isStalePackingError(err(code))).toBe(true);
  });

  it.each([
    "PACK_ITEM_NOT_IN_ORDER",
    "PACK_SCAN_AMBIGUOUS",
    "PACK_SCAN_ID_CONFLICT",
    "PACK_SERIAL_MISMATCH",
    "PACK_PARTIAL_NOT_ALLOWED",
    "VALIDATION_FAILED",
    "OUT_OF_DATA_SCOPE",
  ])("%s → lỗi đầu vào / cấu hình, không cần tải lại", (code) => {
    expect(isStalePackingError(err(code))).toBe(false);
  });

  it("không phải ApiError → không coi là phiên cũ; phản hồi sai hợp đồng (zod) thì tải lại phiên", () => {
    expect(isStalePackingError(new Error("x"))).toBe(false);
    expect(isStalePackingError(zodError())).toBe(true);
  });
});

describe("isRetryablePackingError — giữ nguyên scanId / requestId khi gửi lại", () => {
  it("mất mạng, 5xx, khoá bận / xung đột phiên bản → gửi lại cùng id", () => {
    expect(isRetryablePackingError(new ApiError(0, "NETWORK_ERROR", "x"))).toBe(true);
    expect(isRetryablePackingError(new ApiError(503, "HTTP_503", "x"))).toBe(true);
    expect(isRetryablePackingError(err("LOCK_TIMEOUT"))).toBe(true);
    expect(isRetryablePackingError(err("OPTIMISTIC_LOCK"))).toBe(true);
  });

  it("phản hồi sai hợp đồng (zod) hoặc lỗi lạ → KHÔNG gửi lại cùng id (thử lại thủ công dùng id mới)", () => {
    expect(isRetryablePackingError(zodError())).toBe(false);
    expect(isRetryablePackingError(new Error("boom"))).toBe(false);
    expect(packingErrorMessage(zodError())).toBe(PACKING_INVALID_RESPONSE_MESSAGE);
  });

  it("lỗi nghiệp vụ 4xx (BE không ghi gì) → lần sau dùng id mới", () => {
    expect(isRetryablePackingError(err("PACK_LOT_MISMATCH"))).toBe(false);
    expect(isRetryablePackingError(err("VALIDATION_FAILED", 400))).toBe(false);
  });
});
