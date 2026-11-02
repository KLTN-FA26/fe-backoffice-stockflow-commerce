import { describe, expect, it } from "vitest";

import { ORDER_ERROR_MESSAGES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import {
  ADMIN_CANCEL_FIELD_ERRORS,
  CREDIT_REJECTION_FIELD_ERRORS,
  ORDER_STALE_ERROR_CODES,
  adminCancelErrorView,
  creditDecisionErrorView,
  isOrderConcurrencyError,
  isProductionForbidden,
  mapServerFieldErrors,
  orderActionErrorView,
  orderErrorCategory,
} from "./errors";

function apiError(status: number, code: string, message = "server message in English") {
  return new ApiError(status, code, message, undefined, "corr-123");
}

describe("adminCancelErrorView — branch theo errorCode BE", () => {
  it.each(["ORDER_NOT_CANCELLABLE", "CONFLICT"])(
    "%s (BE BR-031 + BR-ORD-004: đơn đã huỷ / đã đóng gói / không còn cạnh huỷ) → câu trung lập, không đoán lý do",
    (code) => {
      const view = adminCancelErrorView(apiError(409, code));
      expect(view.title).toBe("Đơn không còn huỷ được");
      expect(view.detail).toBe(ORDER_ERROR_MESSAGES.ORDER_NOT_CANCELLABLE);
      // Live BE 5683fe14: huỷ đơn ĐÃ huỷ cũng trả mã này — câu nêu các khả năng, không khẳng định đã đóng gói
      expect(view.detail).toMatch(/trạng thái hiện tại/);
      expect(view.detail).toMatch(/đã được huỷ/);
      expect(view.detail).not.toMatch(/^Đơn hàng không thể huỷ nữa — hàng đã đóng gói/);
      // Mã BR tách riêng, không nhét vào câu; không bảo "tải lại" (trang tự tải lại)
      expect(view.detail).not.toMatch(/BR-|tải lại/);
      expect(view.rule).toBe("BR-ORD-004");
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

describe("isProductionForbidden — GET /production/orders", () => {
  it.each(["FORBIDDEN", "OUT_OF_DATA_SCOPE"])("403 %s → không có quyền xem LSX", (code) => {
    expect(isProductionForbidden(apiError(403, code))).toBe(true);
  });

  it("404 / 5xx / mạng → lỗi thật (endpoint đã có — không còn coi 404 là 'chưa có API')", () => {
    expect(isProductionForbidden(apiError(404, "NOT_FOUND"))).toBe(false);
    expect(isProductionForbidden(apiError(500, "INTERNAL_ERROR"))).toBe(false);
    expect(isProductionForbidden(apiError(0, "NETWORK_ERROR"))).toBe(false);
  });
});

describe("tranh chấp đồng thời — OPTIMISTIC_LOCK / LOCK_TIMEOUT (BE 409, isRetryable)", () => {
  // Release: `release-errors.test.ts` (PR #74)
  const VIEWS = [adminCancelErrorView, creditDecisionErrorView];

  it("phân loại đúng hai mã khoá; mã 409 khác KHÔNG phải tranh chấp đồng thời", () => {
    expect(isOrderConcurrencyError(apiError(409, "OPTIMISTIC_LOCK"))).toBe(true);
    expect(isOrderConcurrencyError(apiError(409, "LOCK_TIMEOUT"))).toBe(true);
    for (const code of ["CONFLICT", "PAYMENT_TERM_NOT_ALLOWED", "ORDER_NOT_ON_CREDIT_HOLD"]) {
      expect(isOrderConcurrencyError(apiError(409, code))).toBe(false);
    }
  });

  it.each(VIEWS)(
    "OPTIMISTIC_LOCK → 'đã được người khác cập nhật… tải lại', mọi thao tác",
    (view) => {
      const v = view(apiError(409, "OPTIMISTIC_LOCK"));
      expect(v.detail).toMatch(/người khác cập nhật/);
      expect(v.detail).toMatch(/tải lại/);
      expect(v.detail).not.toMatch(/English/);
    },
  );

  it.each(VIEWS)("LOCK_TIMEOUT → 'đang được xử lý ở nơi khác… thử lại', mọi thao tác", (view) => {
    const v = view(apiError(409, "LOCK_TIMEOUT"));
    expect(v.detail).toMatch(/đang được xử lý ở nơi khác/);
    expect(v.detail).toMatch(/thử lại/);
  });

  it("C. mã nghiệp vụ 409 vẫn có câu riêng, không bị nuốt bởi nhánh khoá", () => {
    expect(creditDecisionErrorView(apiError(409, "PAYMENT_TERM_NOT_ALLOWED")).rule).toBe("BR-05");
    expect(creditDecisionErrorView(apiError(409, "ORDER_NOT_ON_CREDIT_HOLD")).detail).toMatch(
      /người khác xử lý/,
    );
    expect(adminCancelErrorView(apiError(409, "ORDER_NOT_CANCELLABLE")).rule).toBe("BR-ORD-004");
  });

  it("D. 409 / mã lạ → câu chung như cũ", () => {
    const v = creditDecisionErrorView(apiError(409, "SOMETHING_NEW"));
    expect(v.detail).toBe("Đã xảy ra lỗi khi xử lý đơn. Vui lòng thử lại.");
  });
});

describe("mapServerFieldErrors — fieldErrors BE → ô form (map riêng từng form)", () => {
  const withFields = (fieldErrors: Record<string, string> | undefined) =>
    new ApiError(400, "VALIDATION_FAILED", "Invalid request data", fieldErrors);

  it("A. một field nhận ra → đúng ô, câu tiếng Việt", () => {
    expect(
      mapServerFieldErrors(
        withFields({ reasonCode: "must not be null" }),
        ADMIN_CANCEL_FIELD_ERRORS,
      ),
    ).toEqual({ mapped: [ADMIN_CANCEL_FIELD_ERRORS.reasonCode], unmapped: [] });
  });

  it("B. nhiều field nhận ra → giữ tất cả", () => {
    const { mapped } = mapServerFieldErrors(
      withFields({ note: "note is required", depositPercent: "must be below 100" }),
      CREDIT_REJECTION_FIELD_ERRORS,
    );
    expect(mapped.map((m) => m.field)).toEqual(["note", "depositPercent"]);
  });

  it("C. field lạ (vd field cấp lớp, `reason` cũ) → không gắn ô, trả message để báo chung", () => {
    expect(
      mapServerFieldErrors(
        withFields({ reason: "reason is at most 500 characters", note: "too long" }),
        ADMIN_CANCEL_FIELD_ERRORS,
      ),
    ).toEqual({
      mapped: [ADMIN_CANCEL_FIELD_ERRORS.note],
      unmapped: ["reason is at most 500 characters"],
    });
    // Tên trùng thuộc tính Object.prototype không bị coi là field biết
    expect(
      mapServerFieldErrors(withFields({ toString: "x" }), ADMIN_CANCEL_FIELD_ERRORS).mapped,
    ).toEqual([]);
  });

  it("D. không có fieldErrors → không gì để gắn", () => {
    expect(mapServerFieldErrors(withFields(undefined), ADMIN_CANCEL_FIELD_ERRORS)).toEqual({
      mapped: [],
      unmapped: [],
    });
  });
});

describe("mã idempotency (BE IdempotencyFilter)", () => {
  // Release: `release-errors.test.ts` (PR #74)
  const VIEWS = [adminCancelErrorView, creditDecisionErrorView];

  it("IDEMPOTENT_REQUEST_IN_PROGRESS (409) → nhóm 'thử lại sau', câu riêng, không phải lỗi ô", () => {
    expect(isOrderConcurrencyError(apiError(409, "IDEMPOTENT_REQUEST_IN_PROGRESS"))).toBe(true);
    for (const view of VIEWS) {
      expect(view(apiError(409, "IDEMPOTENT_REQUEST_IN_PROGRESS")).detail).toMatch(
        /vẫn đang được máy chủ xử lý/,
      );
    }
  });

  it("IDEMPOTENCY_KEY_REUSED (422) → câu riêng mức dialog, KHÔNG thuộc nhóm khoá / thử lại", () => {
    expect(isOrderConcurrencyError(apiError(422, "IDEMPOTENCY_KEY_REUSED"))).toBe(false);
    for (const view of VIEWS) {
      const v = view(apiError(422, "IDEMPOTENCY_KEY_REUSED"));
      expect(v.detail).toMatch(/chưa được gửi đi/);
      expect(v.detail).not.toMatch(/English/);
    }
  });
});

describe("adminCancelErrorView — mã lỗi mới của BE PR #133", () => {
  it("ORDER_NOT_CANCELLABLE (BE Order#cancel / requireNotPacked) → không còn huỷ được, BR-ORD-004", () => {
    const view = adminCancelErrorView(apiError(409, "ORDER_NOT_CANCELLABLE"));
    expect(view.title).toBe("Đơn không còn huỷ được");
    expect(view.detail).toBe(ORDER_ERROR_MESSAGES.ORDER_NOT_CANCELLABLE);
    expect(view.rule).toBe("BR-ORD-004");
  });

  // BE huỷ admin không trả hai mã này (Order#cancel → ORDER_NOT_CANCELLABLE) — vẫn có câu riêng
  // phòng khi đường khác trả, nhưng KHÔNG gắn tiêu đề "không còn huỷ được".
  it.each(["ORDER_INVALID_TRANSITION", "ORDER_CANCELLED"] as const)(
    "%s → câu tiếng Việt riêng của mã, tiêu đề huỷ thất bại chung",
    (code) => {
      const view = adminCancelErrorView(apiError(409, code));
      expect(view.title).toBe(UI_LABELS.order.cancelFailedTitle);
      expect(view.detail).toBe(ORDER_ERROR_MESSAGES[code]);
    },
  );

  it("CANCELLATION_FEE_BEFORE_PRINTING → chưa in thì không áp phí, bỏ phí rồi gửi lại (BR-ORD-004)", () => {
    const view = adminCancelErrorView(apiError(409, "CANCELLATION_FEE_BEFORE_PRINTING"));
    expect(view.detail).toMatch(/phí huỷ trước khi bắt đầu in/);
    expect(view.detail).toMatch(/bỏ thông tin phí huỷ và gửi lại yêu cầu huỷ đơn/);
    // BE chỉ tạo refund PENDING khi huỷ → lỗi này không được hứa hoàn tiền
    expect(view.detail).not.toMatch(/hoàn/);
    expect(view.rule).toBe("BR-ORD-004");
    expect(view.traceId).toBe("corr-123");
  });
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

describe("orderActionErrorView — tranh chấp / idempotency / nghiệp vụ", () => {
  it("gỡ giữ PAYMENT chưa đủ tiền (ORDER_BALANCE_NOT_PAID) → ghi nhận thanh toán trước, không phải dữ liệu cũ", () => {
    const view = orderActionErrorView(apiError(409, "ORDER_BALANCE_NOT_PAID"), "resolveHold");
    expect(view.detail).toMatch(/Ghi nhận thanh toán/);
    expect(orderErrorCategory(apiError(409, "ORDER_BALANCE_NOT_PAID"))).toBe("business");
  });

  it.each([
    ["OPTIMISTIC_LOCK", /người khác cập nhật/],
    ["LOCK_TIMEOUT", /đang được xử lý ở nơi khác/],
    ["IDEMPOTENT_REQUEST_IN_PROGRESS", /vẫn đang được máy chủ xử lý/],
    ["IDEMPOTENCY_KEY_REUSED", /chưa được gửi đi/],
  ] as const)("%s → câu dùng chung cho bốn thao tác trạng thái", (code, pattern) => {
    for (const action of ["hold", "resolveHold", "deliveryFailure", "remainderClosure"] as const) {
      const view = orderActionErrorView(apiError(409, code), action);
      expect(view.detail).toMatch(pattern);
      expect(view.traceId).toBe("corr-123");
    }
  });

  it("UNSUPPORTED_PARAMETER → câu tiếng Việt, không lộ message server", () => {
    for (const view of [
      orderActionErrorView(apiError(400, "UNSUPPORTED_PARAMETER"), "hold"),
      adminCancelErrorView(apiError(400, "UNSUPPORTED_PARAMETER")),
    ]) {
      expect(view.detail).toContain("không hợp lệ");
      expect(view.detail).not.toContain("English");
    }
  });

  it("mã lạ → câu chung theo thao tác + traceId, không bao giờ hiện message server", () => {
    const view = orderActionErrorView(apiError(409, "SOMETHING_NEW"), "remainderClosure");
    expect(view.detail).toBe("Đã xảy ra lỗi khi đóng phần còn lại của đơn. Vui lòng thử lại.");
    expect(view.traceId).toBe("corr-123");
    expect(view.serverDetail).toBeUndefined();
  });
});

describe("orderErrorCategory — không gộp mọi 409", () => {
  it.each([
    ["OPTIMISTIC_LOCK", 409, "stale"],
    ["ORDER_INVALID_TRANSITION", 409, "stale"],
    ["ORDER_NOT_CANCELLABLE", 409, "stale"],
    ["ORDER_NOT_ON_HOLD", 409, "stale"],
    ["NOT_FOUND", 404, "stale"],
    ["LOCK_TIMEOUT", 409, "retry-later"],
    ["INTERNAL_ERROR", 500, "retry-later"],
    ["IDEMPOTENT_REQUEST_IN_PROGRESS", 409, "in-progress"],
    ["IDEMPOTENCY_KEY_REUSED", 422, "idempotency-misuse"],
    ["ORDER_BALANCE_NOT_PAID", 409, "business"],
    ["PAYMENT_TERM_NOT_ALLOWED", 409, "business"],
    ["CANCELLATION_FEE_BEFORE_PRINTING", 409, "business"],
    ["CUSTOMER_CREDIT_OVERDUE", 409, "business"],
    ["DESIGN_SAMPLE_NOT_APPROVED", 409, "business"],
    ["ORDER_DEPOSIT_NOT_RECEIVED", 409, "business"],
    ["WAREHOUSE_NOT_FOUND", 404, "business"],
    ["VALIDATION_FAILED", 400, "validation"],
    ["UNSUPPORTED_PARAMETER", 400, "validation"],
    ["FORBIDDEN", 403, "forbidden"],
    ["OUT_OF_DATA_SCOPE", 403, "forbidden"],
    ["NETWORK_ERROR", 0, "network"],
    ["SOMETHING_NEW", 409, "unknown"],
  ] as const)("%s (%i) → %s", (code, status, category) => {
    expect(orderErrorCategory(apiError(status, code))).toBe(category);
  });

  it("mã nghiệp vụ / đang chạy / khoá không bị coi là dữ liệu cũ", () => {
    for (const code of [
      "LOCK_TIMEOUT",
      "IDEMPOTENT_REQUEST_IN_PROGRESS",
      "IDEMPOTENCY_KEY_REUSED",
      "ORDER_BALANCE_NOT_PAID",
      "PAYMENT_TERM_NOT_ALLOWED",
    ]) {
      expect(ORDER_STALE_ERROR_CODES).not.toContain(code);
    }
  });
});

describe("ADMIN_CANCEL_FIELD_ERRORS — agreedFee (BE CancellationFeeRequest)", () => {
  it("field lồng của agreedFee → đúng ô, câu tiếng Việt; reason cũ vẫn không gắn ô", () => {
    const error = new ApiError(400, "VALIDATION_FAILED", "Invalid request data", {
      "agreedFee.amount": "amount is more than zero",
      "agreedFee.detail": "detail is required",
      reason: "reason is at most 500 characters",
    });
    const { mapped, unmapped } = mapServerFieldErrors(error, ADMIN_CANCEL_FIELD_ERRORS);
    expect(mapped.map((m) => m.field)).toEqual(["agreedFee.amount", "agreedFee.detail"]);
    expect(mapped.every((m) => !/is required|more than/.test(m.message))).toBe(true);
    expect(unmapped).toEqual(["reason is at most 500 characters"]);
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
