import { describe, expect, it } from "vitest";

import { UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import {
  adminCancelErrorView,
  creditDecisionErrorView,
  isProductionApiUnavailable,
  releaseErrorView,
} from "./errors";

function apiError(status: number, code: string, message = "server message in English") {
  return new ApiError(status, code, message, undefined, "corr-123");
}

describe("adminCancelErrorView — branch theo errorCode BE", () => {
  it.each(["ORDER_NOT_CANCELLABLE", "CONFLICT"])(
    "%s (BE BR-031; docs BR-03) → hướng dẫn luồng trả hàng",
    (code) => {
      const view = adminCancelErrorView(apiError(409, code));
      expect(view.title).toBe("Đơn không còn huỷ được");
      expect(view.detail).toBe(
        "Đơn đã bàn giao vận chuyển hoặc đã đóng. Vui lòng xử lý qua luồng trả hàng.",
      );
      // Mã BR tách riêng, không nhét vào câu; không bảo "tải lại" (trang tự tải lại)
      expect(view.detail).not.toMatch(/BR-|tải lại/);
      expect(view.traceId).toBe("corr-123");
    },
  );

  it("NOT_FOUND → không tìm thấy, không nói 'không có quyền'", () => {
    const view = adminCancelErrorView(apiError(404, "NOT_FOUND"));
    expect(view.title).toBe(UI_LABELS.order.notFoundTitle);
    expect(view.detail).toBe(UI_LABELS.order.notFoundDescription);
  });

  it("VALIDATION_FAILED → hướng dẫn tiếng Việt, không lộ message server", () => {
    const view = adminCancelErrorView(apiError(400, "VALIDATION_FAILED"));
    expect(view.detail).toContain("ghi chú");
    expect(view.detail).not.toContain("English");
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

describe("releaseErrorView — lý do từ chối release (SCRUM-423)", () => {
  it("DESIGN_SAMPLE_NOT_APPROVED → BR-PRD-08, giữ chi tiết SKU từ máy chủ", () => {
    const view = releaseErrorView(
      apiError(409, "DESIGN_SAMPLE_NOT_APPROVED", "No approved sample for: CUP-01"),
    );
    expect(view.rule).toBe("BR-PRD-08");
    expect(view.detail).toContain("mẫu");
    expect(view.serverDetail).toContain("CUP-01");
  });

  it("ORDER_DEPOSIT_NOT_RECEIVED → BR-PRD-09", () => {
    const view = releaseErrorView(apiError(409, "ORDER_DEPOSIT_NOT_RECEIVED"));
    expect(view.rule).toBe("BR-PRD-09");
    expect(view.detail).toContain("cọc");
  });

  it("CUSTOMER_CREDIT_OVERDUE → công nợ quá hạn", () => {
    expect(releaseErrorView(apiError(409, "CUSTOMER_CREDIT_OVERDUE")).detail).toContain("quá hạn");
  });

  it("WAREHOUSE_NOT_FOUND / CONFLICT có câu riêng, không dùng câu chung", () => {
    expect(releaseErrorView(apiError(404, "WAREHOUSE_NOT_FOUND")).detail).toContain("Kho");
    expect(releaseErrorView(apiError(409, "CONFLICT")).detail).toContain("trạng thái");
  });

  it("FORBIDDEN → không có quyền release", () => {
    expect(releaseErrorView(apiError(403, "FORBIDDEN")).detail).toContain("không có quyền");
  });
});

describe("creditDecisionErrorView (SCRUM-427)", () => {
  it("ORDER_NOT_ON_CREDIT_HOLD → đã có người xử lý", () => {
    expect(creditDecisionErrorView(apiError(409, "ORDER_NOT_ON_CREDIT_HOLD")).detail).toContain(
      "không còn chờ duyệt",
    );
  });

  it("PAYMENT_TERM_NOT_ALLOWED → docs 14 BR-05", () => {
    expect(creditDecisionErrorView(apiError(409, "PAYMENT_TERM_NOT_ALLOWED")).rule).toBe("BR-05");
  });
});

describe("isProductionApiUnavailable — contract pending", () => {
  it.each([404, 405, 501])("HTTP %i → coi là chưa có API", (status) => {
    expect(isProductionApiUnavailable(apiError(status, "NOT_FOUND"))).toBe(true);
  });

  it("5xx / mạng → lỗi thật, không che đi", () => {
    expect(isProductionApiUnavailable(apiError(500, "INTERNAL_ERROR"))).toBe(false);
    expect(isProductionApiUnavailable(apiError(0, "NETWORK_ERROR"))).toBe(false);
  });
});
