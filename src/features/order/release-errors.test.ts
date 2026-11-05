import { describe, expect, it } from "vitest";

import { ORDER_DELIVERY_MODE_UI } from "@/constants";
import { ApiError } from "@/lib/api/error";

import {
  isReleaseConcurrencyError,
  missingSampleSkus,
  RELEASE_STALE_CODES,
  releaseErrorView,
  releaseFieldErrors,
} from "./release-errors";
import { releaseFormSchema } from "./release-schemas";

const apiError = (
  status: number,
  code: string,
  message = "English server message",
  fields?: Record<string, string>,
) => new ApiError(status, code, message, fields, "t-1");
const VIETNAMESE = /[ạảãàáâấầẩẫậăắằẳẵặẹẻẽèéêếềểễệỉĩịọỏõòóôốồổỗộơớờởỡợụủũùúưứừửữựỳỷỹýđ]/i;

describe("releaseErrorView — mã quy tắc + chi tiết", () => {
  it.each([
    ["DESIGN_SAMPLE_NOT_APPROVED", "BR-PRD-08"],
    ["ORDER_DEPOSIT_NOT_RECEIVED", "BR-PRD-09"],
    ["CUSTOMER_CREDIT_OVERDUE", "BR-02"],
    ["DELIVERY_MODE_FTL_NO_COD", "LP-2"],
    ["CONFLICT", "BR-02"],
  ])("%s → quy tắc %s, tiếng Việt, không lộ message tiếng Anh", (code, rule) => {
    const view = releaseErrorView(apiError(409, code, "Order X cannot do it"));
    expect(view.rule).toBe(rule);
    expect(view.detail).toMatch(VIETNAMESE);
    expect(view.detail).not.toContain("English");
    expect(view.traceId).toBe("t-1");
    expect(view.title).toBe("Không release được đơn");
  });

  it("FTL + COD dùng đúng câu 'Sale đổi cách thu trước'", () => {
    expect(releaseErrorView(apiError(409, "DELIVERY_MODE_FTL_NO_COD")).detail).toBe(
      ORDER_DELIVERY_MODE_UI.ftlNoCod,
    );
  });

  it("BR-PRD-08 rút SKU từ câu BE; không khớp → chi tiết gốc", () => {
    const sku = releaseErrorView(
      apiError(
        409,
        "DESIGN_SAMPLE_NOT_APPROVED",
        "Order SO-1 has new designs without an approved sample on A-1, B-2 (BR-PRD-08)",
      ),
    );
    expect(sku.serverDetail).toBe("SKU chưa có mẫu duyệt: A-1, B-2");
    expect(
      releaseErrorView(apiError(409, "DESIGN_SAMPLE_NOT_APPROVED", "weird")).serverDetail,
    ).toBe("weird");
    expect(missingSampleSkus("nothing")).toBeUndefined();
  });

  it.each([
    ["OPTIMISTIC_LOCK", /người khác cập nhật/],
    ["LOCK_TIMEOUT", /xử lý ở nơi khác/],
    ["IDEMPOTENT_REQUEST_IN_PROGRESS", /vẫn đang được máy chủ xử lý/],
  ])("tranh chấp %s → câu riêng và được coi là tranh chấp đồng thời", (code, pattern) => {
    const error = apiError(409, code);
    expect(releaseErrorView(error).detail).toMatch(pattern);
    expect(isReleaseConcurrencyError(error)).toBe(true);
  });

  it("IDEMPOTENCY_KEY_REUSED (422) → chưa được gửi đi; mã khác không phải tranh chấp", () => {
    expect(releaseErrorView(apiError(422, "IDEMPOTENCY_KEY_REUSED")).detail).toMatch(
      /chưa được gửi đi/,
    );
    expect(isReleaseConcurrencyError(apiError(409, "CONFLICT"))).toBe(false);
  });

  it("mã khác rơi về lỗi chung của thao tác release (403, mạng, 500)", () => {
    expect(releaseErrorView(apiError(403, "FORBIDDEN")).detail).toMatch(/quyền đổi hình thức giao/);
    expect(releaseErrorView(apiError(0, "NETWORK_ERROR")).detail).toMatch(
      /Không kết nối được máy chủ/,
    );
    expect(releaseErrorView(apiError(500, "HTTP_500")).detail).toMatch(/Vui lòng thử lại/);
  });

  it("mã 'dữ liệu cũ'", () => {
    expect(RELEASE_STALE_CODES).toEqual(expect.arrayContaining(["CONFLICT", "NOT_FOUND"]));
  });
});

describe("releaseFieldErrors + releaseFormSchema", () => {
  it("fieldErrors.warehouseId của BE → câu FE cho ô kho; trường khác không", () => {
    expect(
      releaseFieldErrors(apiError(400, "VALIDATION_FAILED", "x", { warehouseId: "en" })),
    ).toEqual({
      warehouseId: "Chọn kho xuất hàng.",
    });
    expect(releaseFieldErrors(apiError(400, "VALIDATION_FAILED", "x", { other: "en" }))).toEqual(
      {},
    );
    expect(releaseFieldErrors(apiError(400, "VALIDATION_FAILED"))).toEqual({});
  });

  it("form: kho bắt buộc, hình thức giao thuộc PARCEL | FULL_TRUCKLOAD", () => {
    expect(releaseFormSchema.safeParse({ warehouseId: "", deliveryMode: "PARCEL" }).success).toBe(
      false,
    );
    expect(
      releaseFormSchema.safeParse({ warehouseId: "wh-1", deliveryMode: "TRUCK" }).success,
    ).toBe(false);
    expect(
      releaseFormSchema.safeParse({ warehouseId: "wh-1", deliveryMode: "FULL_TRUCKLOAD" }).success,
    ).toBe(true);
    const empty = releaseFormSchema.safeParse({ warehouseId: "", deliveryMode: "PARCEL" });
    expect(empty.success ? "" : empty.error.issues[0]?.message).toBe("Chọn kho xuất hàng.");
  });
});
