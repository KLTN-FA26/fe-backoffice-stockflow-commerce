import { describe, expect, it } from "vitest";

import { UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { adminCancelErrorView } from "./errors";

function apiError(status: number, code: string, message = "server message in English") {
  return new ApiError(status, code, message, undefined, "corr-123");
}

describe("adminCancelErrorView — branch theo errorCode BE", () => {
  it("CONFLICT (BE BR-031; docs BR-03) → hướng dẫn luồng trả hàng", () => {
    const view = adminCancelErrorView(apiError(409, "CONFLICT"));
    expect(view.title).toBe("Đơn không còn huỷ được");
    expect(view.detail).toBe(
      "Đơn đã bàn giao vận chuyển hoặc đã đóng. Vui lòng xử lý qua luồng trả hàng.",
    );
    // Không lộ ký hiệu nội bộ, không bảo "tải lại" (trang tự tải lại)
    expect(view.detail).not.toMatch(/BR-|tải lại/);
    expect(view.traceId).toBe("corr-123");
  });

  it("NOT_FOUND → không tìm thấy, không nói 'không có quyền'", () => {
    const view = adminCancelErrorView(apiError(404, "NOT_FOUND"));
    expect(view.title).toBe(UI_LABELS.order.notFoundTitle);
    expect(view.detail).toBe(UI_LABELS.order.notFoundDescription);
  });

  it("VALIDATION_FAILED → lý do bắt buộc (tiếng Việt, không lộ message server)", () => {
    const view = adminCancelErrorView(apiError(400, "VALIDATION_FAILED"));
    expect(view.detail).toBe("Lý do huỷ là bắt buộc và tối đa 500 ký tự.");
  });

  it.each(["FORBIDDEN", "OUT_OF_DATA_SCOPE"])("%s → không có quyền", (code) => {
    expect(adminCancelErrorView(apiError(403, code)).detail).toContain("không có quyền");
  });

  it("mã lạ → câu tiếng Việt chung, không hiện thẳng message tiếng Anh của server", () => {
    const view = adminCancelErrorView(apiError(500, "INTERNAL_ERROR"));
    expect(view.detail).not.toContain("English");
    expect(view.traceId).toBe("corr-123");
  });
});
