/**
 * Giữ hoàn tất đơn (WF-05 GH-2; BE `OrderCompletionHolds`): action-gating theo cờ BE + quyền, schema DTO / input, và
 * lỗi BE → câu tiếng Việt (không hiện message tiếng Anh).
 */
import { describe, expect, it } from "vitest";

import { ORDER_PERMISSIONS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import {
  allowedCompletionHoldActions,
  isCompletionHoldApplicable,
} from "./completion-hold-lifecycle";
import {
  currentCompletionHoldSchema,
  holdCompletionInputSchema,
  releaseCompletionHoldInputSchema,
} from "./completion-hold-schemas";
import { COMPLETION_HOLD_STALE_CODES, completionHoldErrorView } from "./errors";
import { settlementReadinessDtoSchema } from "./schemas";

import type { PermissionCode } from "@/lib/auth";
import type { CompletionHoldGate } from "./completion-hold-lifecycle";

const has =
  (codes: readonly string[]) =>
  (code: PermissionCode): boolean =>
    codes.includes(code);
const SALES = has([ORDER_PERMISSIONS.viewPage, ORDER_PERMISSIONS.read, ORDER_PERMISSIONS.hold]);
const COORDINATOR = has([
  ORDER_PERMISSIONS.viewPage,
  ORDER_PERMISSIONS.read,
  ORDER_PERMISSIONS.cancel,
]);
const WAREHOUSE_MANAGER = has([ORDER_PERMISSIONS.read, ORDER_PERMISSIONS.release]);

const openHold = { releasedAt: null };

/** Đơn mà BE nói giữ hoàn tất được / không được (`settlementReadiness.completionHoldable`). */
const holdable = (value: boolean): CompletionHoldGate => ({
  settlementReadiness: { completionHoldable: value },
});

describe("allowedCompletionHoldActions (audit r2 M-4: BE settlementReadiness.completionHoldable)", () => {
  it("Sale, BE nói giữ được, chưa giữ → chỉ hold", () => {
    expect(isCompletionHoldApplicable(holdable(true))).toBe(true);
    expect(allowedCompletionHoldActions(holdable(true), null, SALES)).toEqual(["hold"]);
  });

  it("BE nói không giữ được (đơn đã hoàn tất, chưa giao gì, trạng thái BE đổi luật…) → không nút; FE không tự đoán", () => {
    expect(allowedCompletionHoldActions(holdable(false), null, SALES)).toEqual([]);
    // Chưa giao gì: BE không gửi khối điều kiện
    expect(allowedCompletionHoldActions({ settlementReadiness: null }, null, SALES)).toEqual([]);
  });

  it("Sale, đơn đang giữ → chỉ release, bất kể cờ (BE release chỉ kiểm có giữ hay không)", () => {
    expect(allowedCompletionHoldActions(holdable(false), openHold, SALES)).toEqual(["release"]);
    expect(allowedCompletionHoldActions({ settlementReadiness: null }, openHold, SALES)).toEqual([
      "release",
    ]);
  });

  it("lần giữ đã gỡ (releasedAt có) không tính là đang giữ", () => {
    expect(
      allowedCompletionHoldActions(holdable(true), { releasedAt: "2026-11-19T01:00:00Z" }, SALES),
    ).toEqual(["hold"]);
  });

  it("schema: cờ BE vắng (BE cũ) → false, không mở nút", () => {
    const parsed = settlementReadinessDtoSchema.parse({ branch: "COMPLETION" });
    expect(parsed.completionHoldable).toBe(false);
    expect(
      settlementReadinessDtoSchema.parse({ branch: "NONE", completionHoldable: true })
        .completionHoldable,
    ).toBe(true);
  });

  it("Điều phối / Quản lý kho (không có sales-order-holds:UPDATE) → không nút nào", () => {
    expect(allowedCompletionHoldActions(holdable(true), null, COORDINATOR)).toEqual([]);
    expect(allowedCompletionHoldActions(holdable(true), openHold, WAREHOUSE_MANAGER)).toEqual([]);
  });
});

describe("completion hold schemas", () => {
  it("GET data null → null; field vắng → null; lý do lạ → UNKNOWN", () => {
    expect(currentCompletionHoldSchema.parse(null)).toBeNull();
    expect(currentCompletionHoldSchema.parse(undefined)).toBeNull();
    expect(
      currentCompletionHoldSchema.parse({
        id: "h1",
        orderId: "o1",
        reasonCode: "CARRIER_AUDIT",
        heldAt: "2026-11-19T01:00:00Z",
      }),
    ).toMatchObject({ reasonCode: "UNKNOWN", note: null, heldBy: null, releasedAt: null });
  });

  it("giữ: lý do bắt buộc; OTHER cần ghi chú; ghi chú trống không gửi; tối đa 1000 ký tự", () => {
    expect(holdCompletionInputSchema.safeParse({ reasonCode: "", note: "" }).success).toBe(false);
    expect(holdCompletionInputSchema.safeParse({ reasonCode: "OTHER", note: "  " }).success).toBe(
      false,
    );
    expect(holdCompletionInputSchema.parse({ reasonCode: "DELIVERY_DISPUTED", note: " " })).toEqual(
      { reasonCode: "DELIVERY_DISPUTED", note: undefined },
    );
    expect(holdCompletionInputSchema.parse({ reasonCode: "OTHER", note: " Hãng kiểm " })).toEqual({
      reasonCode: "OTHER",
      note: "Hãng kiểm",
    });
    expect(
      holdCompletionInputSchema.safeParse({
        reasonCode: "DELIVERY_DISPUTED",
        note: "x".repeat(1001),
      }).success,
    ).toBe(false);
  });

  it("gỡ giữ: ghi chú bắt buộc", () => {
    expect(releaseCompletionHoldInputSchema.safeParse({ note: " " }).success).toBe(false);
    expect(releaseCompletionHoldInputSchema.parse({ note: " Đã giao " })).toEqual({
      note: "Đã giao",
    });
  });
});

describe("completionHoldErrorView", () => {
  it("ba mã 409 của BE → câu tiếng Việt, là dữ liệu cũ (đóng hộp thoại, tải lại)", () => {
    for (const code of [
      "ORDER_COMPLETION_ALREADY_HELD",
      "ORDER_COMPLETION_HOLD_NOT_APPLICABLE",
      "ORDER_COMPLETION_NOT_HELD",
    ]) {
      const view = completionHoldErrorView(new ApiError(409, code, "English"), "hold");
      expect(view.detail).not.toContain("English");
      expect(view.detail.length).toBeGreaterThan(10);
      expect(COMPLETION_HOLD_STALE_CODES).toContain(code);
    }
    expect(
      completionHoldErrorView(new ApiError(409, "ORDER_COMPLETION_NOT_HELD", "x"), "release").title,
    ).toBe("Không gỡ giữ hoàn tất được");
  });

  it("VALIDATION_FAILED / mã lạ → câu chung, không lộ message máy chủ", () => {
    expect(
      completionHoldErrorView(new ApiError(400, "VALIDATION_FAILED", "OTHER needs a note"), "hold")
        .detail,
    ).toContain("lý do khác");
    expect(
      completionHoldErrorView(new ApiError(500, "INTERNAL_ERROR", "boom"), "release").detail,
    ).not.toContain("boom");
  });
});
