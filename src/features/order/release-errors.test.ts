import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/error";

import {
  isReleaseConcurrencyError,
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

describe("releaseErrorView — mã quy tắc + chi tiết (BE OrderReleaseService, docs 17)", () => {
  it.each([
    ["CUSTOMER_CREDIT_OVERDUE", "BR-02", 409],
    ["ORDER_SHIPPING_WAREHOUSE_MISMATCH", "BR-22", 409],
    ["ORDER_STOCK_NOT_HELD", "BR-21", 409],
    ["DELIVERY_BATCH_NOT_NEXT", "BR-29", 409],
    ["DELIVERY_BATCH_NOT_FOUND", "BR-29", 404],
    ["ORDER_PRINT_GOODS_NOT_RECEIVED", "docs 07 / 11", 409],
    ["OUT_OF_DATA_SCOPE", "BR-03", 403],
    ["CONFLICT", "BR-02", 409],
    ["ORDER_INVALID_TRANSITION", "BR-02", 409],
  ])("%s → quy tắc %s, tiếng Việt, không lộ message tiếng Anh", (code, rule, status) => {
    const view = releaseErrorView(apiError(status, code, "Order X cannot do it"));
    expect(view.rule).toBe(rule);
    expect(view.detail).toMatch(VIETNAMESE);
    expect(view.detail).not.toContain("English");
    expect(view.traceId).toBe("t-1");
    expect(view.title).toBe("Không release được đơn");
  });

  it("mã của luồng cũ (mẫu thiết kế, tiền cọc, FTL + COD) đã bỏ — rơi về lỗi chung, không còn mã quy tắc riêng", () => {
    for (const code of [
      "DESIGN_SAMPLE_NOT_APPROVED",
      "ORDER_DEPOSIT_NOT_RECEIVED",
      "DELIVERY_MODE_FTL_NO_COD",
    ]) {
      expect(releaseErrorView(apiError(409, code)).rule).toBeUndefined();
    }
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
    expect(releaseErrorView(apiError(403, "FORBIDDEN")).detail).toMatch(/Bạn không có quyền/);
    expect(releaseErrorView(apiError(0, "NETWORK_ERROR")).detail).toMatch(
      /Không kết nối được máy chủ/,
    );
    expect(releaseErrorView(apiError(500, "HTTP_500")).detail).toMatch(/Vui lòng thử lại/);
  });

  it("mã 'dữ liệu cũ'", () => {
    expect(RELEASE_STALE_CODES).toEqual(
      expect.arrayContaining(["CONFLICT", "NOT_FOUND", "DELIVERY_BATCH_NOT_FOUND"]),
    );
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

  it("form: kho bắt buộc; đợt giao tuỳ chọn; không còn hình thức giao (field thừa bị bỏ, không gửi)", () => {
    expect(releaseFormSchema.safeParse({ warehouseId: "" }).success).toBe(false);
    expect(releaseFormSchema.safeParse({ warehouseId: "wh-1" }).success).toBe(true);
    expect(releaseFormSchema.parse({ warehouseId: "wh-1", deliveryBatchId: "b-1" })).toEqual({
      warehouseId: "wh-1",
      deliveryBatchId: "b-1",
    });
    expect(
      releaseFormSchema.parse({ warehouseId: "wh-1", deliveryMode: "FULL_TRUCKLOAD" }),
    ).toEqual({ warehouseId: "wh-1" });
    const empty = releaseFormSchema.safeParse({ warehouseId: "" });
    expect(empty.success ? "" : empty.error.issues[0]?.message).toBe("Chọn kho xuất hàng.");
  });
});
