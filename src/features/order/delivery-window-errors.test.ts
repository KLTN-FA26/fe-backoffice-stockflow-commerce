/**
 * Lỗi dời cửa sổ giao → câu tiếng Việt (docs 17 BR-28, BE `DeliveryBatchService#changeWindow`).
 */
import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/error";

import { DirectUploadError } from "@/lib/api/direct-upload";

import {
  WINDOW_CHANGE_FIELD_ERRORS,
  evidenceUploadErrorMessage,
  WINDOW_CHANGE_STALE_CODES,
  windowChangeErrorView,
} from "./delivery-window-errors";

const apiError = (status: number, code: string, message = "English server message") =>
  new ApiError(status, code, message, undefined, "t-1");
const VIETNAMESE = /[ạảãàáâấầẩẫậăắằẳẵặẹẻẽèéêếềểễệỉĩịọỏõòóôốồổỗộơớờởỡợụủũùúưứừửữựỳỷỹýđ]/i;

describe("windowChangeErrorView", () => {
  it.each([
    ["DELIVERY_BATCH_WINDOW_LOCKED", 409, /đã có thùng bàn giao/, "BR-28"],
    ["DELIVERY_BATCH_NOT_FOUND", 404, /không còn thuộc đơn/, undefined],
    ["CONFLICT", 409, /đã huỷ, đã đóng hoặc đã hoàn tất/, undefined],
    ["VALIDATION_FAILED", 400, /tin nhắn do chính khách gửi/, "BR-28"],
  ])("%s → câu Việt đúng nghĩa, không lộ message tiếng Anh", (code, status, text, rule) => {
    const view = windowChangeErrorView(apiError(status, code));
    expect(view.detail).toMatch(text);
    expect(view.detail).toMatch(VIETNAMESE);
    expect(view.detail).not.toContain("English");
    expect(view.rule).toBe(rule);
    expect(view.title).toBe("Không dời được cửa sổ giao");
    expect(view.traceId).toBe("t-1");
  });

  it("400 liệt kê cả các điều kiện BE gộp chung một mã: quá khứ, thứ tự đợt, ghi chú, bằng chứng", () => {
    const { detail } = windowChangeErrorView(apiError(400, "VALIDATION_FAILED"));
    for (const part of [/quá khứ/, /đợt đứng trước/, /ghi chú/, /bằng chứng/])
      expect(detail).toMatch(part);
  });

  it("lỗi chung (quyền, tranh chấp, mạng, mã lạ) rơi về câu chung của thao tác", () => {
    expect(windowChangeErrorView(apiError(403, "FORBIDDEN")).detail).toBe(
      "Bạn không có quyền dời cửa sổ giao.",
    );
    expect(windowChangeErrorView(apiError(409, "OPTIMISTIC_LOCK")).detail).toMatch(
      /vừa được người khác cập nhật/,
    );
    expect(windowChangeErrorView(apiError(500, "SOMETHING_NEW")).detail).toBe(
      "Đã xảy ra lỗi khi dời cửa sổ giao. Vui lòng thử lại.",
    );
  });
});

describe("WINDOW_CHANGE_STALE_CODES / WINDOW_CHANGE_FIELD_ERRORS", () => {
  it("đợt đã khoá / không còn / đơn đã đóng → dữ liệu cũ (đóng hộp thoại + tải lại)", () => {
    for (const code of [
      "DELIVERY_BATCH_WINDOW_LOCKED",
      "DELIVERY_BATCH_NOT_FOUND",
      "CONFLICT",
      "NOT_FOUND",
    ]) {
      expect(WINDOW_CHANGE_STALE_CODES).toContain(code);
    }
    // 400 và tranh chấp khoá giữ hộp thoại + dữ liệu đã nhập
    expect(WINDOW_CHANGE_STALE_CODES).not.toContain("VALIDATION_FAILED");
    expect(WINDOW_CHANGE_STALE_CODES).not.toContain("LOCK_TIMEOUT");
  });

  it("fieldErrors của BE gắn đúng ô form bằng câu của FE", () => {
    expect(Object.keys(WINDOW_CHANGE_FIELD_ERRORS).sort()).toEqual([
      "note",
      "reasonCode",
      "windowEnd",
      "windowStart",
    ]);
    expect(WINDOW_CHANGE_FIELD_ERRORS.note.message).toMatch(/Ghi chú/);
  });
});

describe("windowChangeErrorView — gắn tệp bằng chứng", () => {
  it("415: byte không đúng loại tệp đã khai báo → chọn lại tệp", () => {
    const view = windowChangeErrorView(apiError(415, "UNSUPPORTED_MEDIA_TYPE"));
    expect(view.detail).toMatch(/không đúng loại tệp/);
    expect(view.detail).not.toContain("English");
  });

  it("CONFLICT nêu cả hai nghĩa: đơn đã đóng HOẶC tệp đang được gắn ở yêu cầu khác", () => {
    expect(windowChangeErrorView(apiError(409, "CONFLICT")).detail).toMatch(
      /đang được gắn ở một yêu cầu khác/,
    );
  });

  it("400 nhắc cả khả năng tệp chưa tải lên đầy đủ", () => {
    expect(windowChangeErrorView(apiError(400, "VALIDATION_FAILED")).detail).toMatch(
      /tệp đã tải lên đầy đủ/,
    );
  });
});

describe("evidenceUploadErrorMessage — tải tệp bằng chứng", () => {
  it.each([
    [415, "UNSUPPORTED_MEDIA_TYPE", /không nhận loại tệp/],
    [413, "PAYLOAD_TOO_LARGE", /quá lớn/],
    [400, "VALIDATION_FAILED", /Thông tin tệp không hợp lệ/],
    [429, "RATE_LIMITED", /quá nhiều tệp/],
    [404, "DELIVERY_BATCH_NOT_FOUND", /không còn nhận được bằng chứng/],
    [409, "CONFLICT", /không còn nhận được bằng chứng/],
    [403, "FORBIDDEN", /sales-contracts:UPDATE/],
    [0, "NETWORK_ERROR", /Không kết nối được/],
    [503, "STORAGE_ERROR", /Kho lưu trữ tệp tạm thời/],
    [500, "SOMETHING_NEW", /Kho lưu trữ tệp tạm thời/],
    [418, "SOMETHING_NEW", /Không tải lên được tệp/],
  ])("%s %s → câu tiếng Việt, không lộ message tiếng Anh", (status, code, text) => {
    const message = evidenceUploadErrorMessage(apiError(status, code));
    expect(message).toMatch(text);
    expect(message).toMatch(VIETNAMESE);
    expect(message).not.toContain("English");
  });

  it("kho từ chối (hết hạn / chữ ký / byte đổi) → chọn lại tệp; mất mạng khi PUT → kiểm tra mạng", () => {
    expect(evidenceUploadErrorMessage(new DirectUploadError("refused", 403))).toMatch(
      /Kho lưu trữ từ chối tệp/,
    );
    expect(evidenceUploadErrorMessage(new DirectUploadError("network"))).toMatch(/kiểm tra mạng/);
  });

  it("lỗi lạ (ZodError, Error thường) → câu chung, không lộ nội dung lỗi", () => {
    const message = evidenceUploadErrorMessage(new Error("boom internals"));
    expect(message).toMatch(/Không tải lên được tệp/);
    expect(message).not.toContain("boom");
  });
});
