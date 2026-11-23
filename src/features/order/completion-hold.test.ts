/**
 * Giữ hoàn tất đơn (WF-05 GH-2; BE `OrderCompletionHolds`): action-gating theo trạng thái + quyền, schema DTO / input, và
 * lỗi BE → câu tiếng Việt (không hiện message tiếng Anh).
 */
import { describe, expect, it } from "vitest";

import { ORDER_PERMISSIONS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import {
  PAST_COMPLETION_STATUSES,
  allowedCompletionHoldActions,
  isCompletionHoldApplicable,
} from "./completion-hold-lifecycle";
import {
  currentCompletionHoldSchema,
  holdCompletionInputSchema,
  releaseCompletionHoldInputSchema,
} from "./completion-hold-schemas";
import { COMPLETION_HOLD_STALE_CODES, completionHoldErrorView } from "./errors";

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

/** Đơn đã giao (lô DELIVERED), chưa từng hoàn tất — đúng chỗ BE nhận giữ hoàn tất. */
const order = (
  status: CompletionHoldGate["status"],
  over: Partial<CompletionHoldGate> = {},
): CompletionHoldGate => ({
  status,
  deliveredAt: "2026-11-18T03:00:00Z",
  completedAt: null,
  shipments: [{ status: "DELIVERED" }],
  ...over,
});

describe("allowedCompletionHoldActions (BE OrderCompletionHolds @ 18d4cf88)", () => {
  it("Sale, đơn đã giao chưa giữ, còn tự hoàn tất được → chỉ hold", () => {
    expect(allowedCompletionHoldActions(order("Delivered"), null, SALES)).toEqual(["hold"]);
    // một lô đã giao, lô sau còn trên đường
    expect(
      allowedCompletionHoldActions(
        order("Partially Fulfilled", { deliveredAt: null }),
        null,
        SALES,
      ),
    ).toEqual(["hold"]);
  });

  it("Sale, đơn đang giữ → chỉ release (kể cả khi đơn đã đóng — BE release chỉ kiểm có giữ hay không)", () => {
    expect(allowedCompletionHoldActions(order("Delivered"), openHold, SALES)).toEqual(["release"]);
    expect(allowedCompletionHoldActions(order("Closed"), openHold, SALES)).toEqual(["release"]);
  });

  it("lần giữ đã gỡ (releasedAt có) không tính là đang giữ", () => {
    expect(
      allowedCompletionHoldActions(
        order("Delivered"),
        { releasedAt: "2026-11-19T01:00:00Z" },
        SALES,
      ),
    ).toEqual(["hold"]);
  });

  it("audit r2 M-4: RETURNED / REFUNDED / PARTIALLY_REFUNDED vẫn giữ được (Q-17: chặn cả đóng đơn)", () => {
    for (const status of [
      "Returned",
      "Refunded",
      "Partially Refunded",
      "Return Requested",
    ] as const) {
      expect(isCompletionHoldApplicable(order(status))).toBe(true);
      expect(allowedCompletionHoldActions(order(status), null, SALES)).toEqual(["hold"]);
    }
  });

  it("audit r2 M-4: chưa giao gì (CONFIRMED, PICKING, SHIPPED, lô chỉ thất bại / hoàn) → không nút", () => {
    const nothing = { deliveredAt: null, shipments: [] };
    for (const status of ["Confirmed", "Picking", "Packed", "Shipped"] as const) {
      expect(allowedCompletionHoldActions(order(status, nothing), null, SALES)).toEqual([]);
    }
    expect(
      allowedCompletionHoldActions(
        order("Partially Fulfilled", {
          deliveredAt: null,
          shipments: [
            { status: "DELIVERY_FAILED" },
            { status: "RETURNED" },
            { status: "HANDED_OVER" },
          ],
        }),
        null,
        SALES,
      ),
    ).toEqual([]);
  });

  it("PAST_COMPLETION (COMPLETED/CLOSED/CANCELLED), đơn từng hoàn tất, và UNKNOWN → không nút", () => {
    expect(PAST_COMPLETION_STATUSES).toEqual(["Completed", "Closed", "Cancelled"]);
    for (const status of PAST_COMPLETION_STATUSES) {
      expect(isCompletionHoldApplicable(order(status))).toBe(false);
      expect(allowedCompletionHoldActions(order(status), null, SALES)).toEqual([]);
    }
    // khiếu nại muộn trên đơn đã hoàn tất: RETURN_REQUESTED nhưng completedAt có → BE từ chối
    expect(
      allowedCompletionHoldActions(
        order("Return Requested", { completedAt: "2026-11-10T17:30:00Z" }),
        null,
        SALES,
      ),
    ).toEqual([]);
    expect(allowedCompletionHoldActions(order("UNKNOWN"), null, SALES)).toEqual([]);
  });

  it("Điều phối / Quản lý kho (không có sales-order-holds:UPDATE) → không nút nào", () => {
    expect(allowedCompletionHoldActions(order("Delivered"), null, COORDINATOR)).toEqual([]);
    expect(allowedCompletionHoldActions(order("Delivered"), openHold, WAREHOUSE_MANAGER)).toEqual(
      [],
    );
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
