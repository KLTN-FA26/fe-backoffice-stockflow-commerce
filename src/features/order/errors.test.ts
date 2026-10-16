import { describe, expect, it } from "vitest";

import { UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import {
  ADMIN_CANCEL_FIELD_ERRORS,
  CREDIT_REJECTION_FIELD_ERRORS,
  RELEASE_FIELD_ERRORS,
  adminCancelErrorView,
  creditDecisionErrorView,
  isOrderConcurrencyError,
  isProductionApiUnavailable,
  mapServerFieldErrors,
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

describe("tranh chấp đồng thời — OPTIMISTIC_LOCK / LOCK_TIMEOUT (BE 409, isRetryable)", () => {
  const VIEWS = [adminCancelErrorView, releaseErrorView, creditDecisionErrorView];

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
    expect(releaseErrorView(apiError(409, "CONFLICT")).rule).toBe("BR-02");
    expect(adminCancelErrorView(apiError(409, "ORDER_NOT_CANCELLABLE")).rule).toBe("BR-03");
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
      mapServerFieldErrors(withFields({ warehouseId: "must not be null" }), RELEASE_FIELD_ERRORS),
    ).toEqual({ mapped: [{ field: "warehouseId", message: "Chọn kho xuất." }], unmapped: [] });
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
      mapServerFieldErrors(withFields({ toString: "x" }), RELEASE_FIELD_ERRORS).mapped,
    ).toEqual([]);
  });

  it("D. không có fieldErrors → không gì để gắn", () => {
    expect(mapServerFieldErrors(withFields(undefined), RELEASE_FIELD_ERRORS)).toEqual({
      mapped: [],
      unmapped: [],
    });
  });
});

describe("mã idempotency (BE IdempotencyFilter)", () => {
  const VIEWS = [adminCancelErrorView, releaseErrorView, creditDecisionErrorView];

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
