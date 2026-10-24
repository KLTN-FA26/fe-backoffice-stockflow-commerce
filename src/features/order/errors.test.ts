import { describe, expect, it } from "vitest";

import { UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { ORDER_ERROR_MESSAGES } from "@/constants";

import { ORDER_STALE_ERROR_CODES, adminCancelErrorView, orderActionErrorView } from "./errors";

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

describe("adminCancelErrorView — mã lỗi mới của BE PR #133", () => {
  it.each(["ORDER_NOT_CANCELLABLE", "ORDER_INVALID_TRANSITION", "ORDER_CANCELLED"] as const)(
    "%s → câu tiếng Việt riêng của mã",
    (code) => {
      const view = adminCancelErrorView(apiError(409, code));
      expect(view.title).toBe("Đơn không còn huỷ được");
      expect(view.detail).toBe(ORDER_ERROR_MESSAGES[code]);
    },
  );
});

describe("orderActionErrorView — mọi mã ORDER_* mới đều có câu tiếng Việt", () => {
  const NEW_CODES = [
    "ORDER_INVALID_TRANSITION",
    "ORDER_NOT_ON_HOLD",
    "ORDER_CREDIT_HOLD_USE_APPROVAL",
    "ORDER_DESIGN_HOLD_USE_REVERIFICATION",
    "ORDER_DELIVERY_VIA_SHIPMENT",
    "ORDER_BALANCE_NOT_PAID",
    "ORDER_SHIPMENT_NOT_FOUND",
    "ORDER_SHIPMENT_CONFLICT",
    "ORDER_SHIPMENT_QUANTITY_EXCEEDED",
    "ORDER_SHIPMENT_INVALID_TRANSITION",
  ] as const;

  it.each(NEW_CODES)("%s → câu riêng, không lộ message tiếng Anh của server", (code) => {
    const view = orderActionErrorView(apiError(409, code), "hold");
    expect(view.detail).toBe(ORDER_ERROR_MESSAGES[code]);
    expect(view.detail).not.toContain("English");
    expect(view.detail).toMatch(
      /[ạảãàáâấầẩẫậăắằẳẵặẹẻẽèéêếềểễệỉĩịọỏõòóôốồổỗộơớờởỡợụủũùúưứừửữựỳỷỹýđ]/i,
    );
    expect(view.title).toBe("Không giữ được đơn");
    expect(view.traceId).toBe("corr-123");
  });

  it("gỡ giữ CREDIT / DESIGN_MISMATCH → chỉ dẫn xử lý ở màn khác", () => {
    expect(
      orderActionErrorView(apiError(409, "ORDER_CREDIT_HOLD_USE_APPROVAL"), "resolveHold").detail,
    ).toContain("duyệt công nợ");
    expect(
      orderActionErrorView(apiError(409, "ORDER_DESIGN_HOLD_USE_REVERIFICATION"), "resolveHold")
        .detail,
    ).toContain("bàn đóng gói");
  });

  it("tiêu đề theo thao tác", () => {
    const error = apiError(500, "INTERNAL_ERROR");
    expect(orderActionErrorView(error, "resolveHold").title).toBe("Không gỡ giữ được đơn");
    expect(orderActionErrorView(error, "deliveryFailure").title).toBe(
      "Không ghi được giao thất bại",
    );
    expect(orderActionErrorView(error, "remainderClosure").title).toBe(
      "Không đóng được phần còn lại",
    );
  });

  it("VALIDATION_FAILED / FORBIDDEN / NETWORK_ERROR / NOT_FOUND / mã lạ → câu chung tiếng Việt", () => {
    expect(orderActionErrorView(apiError(400, "VALIDATION_FAILED"), "hold").detail).toContain(
      "chọn lý do",
    );
    expect(
      orderActionErrorView(apiError(400, "VALIDATION_FAILED"), "resolveHold").detail,
    ).toContain("cách đã xử lý");
    expect(orderActionErrorView(apiError(403, "FORBIDDEN"), "hold").detail).toContain(
      "không có quyền",
    );
    expect(orderActionErrorView(apiError(0, "NETWORK_ERROR"), "hold").detail).toContain("kết nối");
    expect(orderActionErrorView(apiError(404, "NOT_FOUND"), "hold").title).toBe(
      UI_LABELS.order.notFoundTitle,
    );
    expect(orderActionErrorView(apiError(500, "WHATEVER"), "hold").detail).not.toContain("English");
  });

  it("mã nghiệp vụ cho thấy dữ liệu đã cũ → tải lại; lỗi 400/500 thì không", () => {
    for (const code of [
      "ORDER_INVALID_TRANSITION",
      "ORDER_NOT_ON_HOLD",
      "ORDER_DELIVERY_VIA_SHIPMENT",
    ]) {
      expect(ORDER_STALE_ERROR_CODES).toContain(code);
    }
    expect(ORDER_STALE_ERROR_CODES).not.toContain("VALIDATION_FAILED");
    expect(ORDER_STALE_ERROR_CODES).not.toContain("ORDER_BALANCE_NOT_PAID");
  });
});

describe("orderActionErrorView — mã lỗi mới của BE PR #150", () => {
  const NEW_CODES = [
    "ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED",
    "ORDER_PARTIAL_SHIPMENT_LOCKED",
    "BALANCE_CREDIT_LIMIT_EXCEEDED",
    "CUSTOMER_CREDIT_OVERDUE",
    "BALANCE_POLICY_NOT_ALLOWED",
    "CREDIT_PROFILE_INVALID",
    "CANCELLATION_FEE_BEFORE_PRINTING",
  ] as const;

  it.each(NEW_CODES)("%s → câu tiếng Việt riêng, không lộ message server", (code) => {
    const view = orderActionErrorView(apiError(409, code), "remainderClosure");
    expect(view.detail).toBe(ORDER_ERROR_MESSAGES[code]);
    expect(view.detail).not.toContain("English");
    expect(view.detail).toMatch(
      /[ạảãàáâấầẩẫậăắằẳẵặẹẻẽèéêếềểễệỉĩịọỏõòóôốồổỗộơớờởỡợụủũùúưứừửữựỳỷỹýđ]/i,
    );
  });

  it("ORDER_PARTIAL_SHIPMENT_LOCKED có tiêu đề riêng của giao một phần và buộc tải lại đơn", () => {
    const view = orderActionErrorView(
      apiError(409, "ORDER_PARTIAL_SHIPMENT_LOCKED"),
      "partialShipment",
    );
    expect(view.title).toBe("Không cập nhật được giao một phần");
    expect(view.detail).toContain("Không đổi được cách giao");
    expect(ORDER_STALE_ERROR_CODES).toContain("ORDER_PARTIAL_SHIPMENT_LOCKED");
  });

  it("CANCELLATION_FEE_BEFORE_PRINTING không phải lỗi 'dữ liệu cũ' — dialog giữ nguyên để bỏ phí rồi gửi lại", () => {
    expect(ORDER_STALE_ERROR_CODES).not.toContain("CANCELLATION_FEE_BEFORE_PRINTING");
    expect(
      orderActionErrorView(apiError(409, "CANCELLATION_FEE_BEFORE_PRINTING"), "remainderClosure")
        .detail,
    ).toContain("chưa bắt đầu in");
  });

  it("400 khi phí vượt giá trị hàng in (VALIDATION_FAILED) → câu về phí, không lộ message tiếng Anh", () => {
    const view = orderActionErrorView(apiError(400, "VALIDATION_FAILED"), "remainderClosure");
    expect(view.detail).toContain("không vượt giá trị phần hàng in bị đóng");
    expect(view.detail).not.toContain("English");
  });

  it("VALIDATION_FAILED của giao một phần → nhắc giới hạn ghi chú", () => {
    expect(
      orderActionErrorView(apiError(400, "VALIDATION_FAILED"), "partialShipment").detail,
    ).toContain("500");
  });
});
