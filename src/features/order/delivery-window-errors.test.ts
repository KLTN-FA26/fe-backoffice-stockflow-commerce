/**
 * Lỗi dời cửa sổ giao → câu tiếng Việt (docs 17 BR-28, BE `DeliveryBatchService#changeWindow`).
 */
import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/error";

import {
  WINDOW_CHANGE_FIELD_ERRORS,
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
