/**
 * Mock routes — giữ hoàn tất đơn (WF-05 GH-2, BE `OrderCompletionHoldController` / `OrderCompletionHolds`). Chỉ dùng
 * khi USE_MOCK=true.
 *
 * - GET  /orders/:id/completion-hold — `sales-orders:READ`; data null khi không giữ.
 * - POST /orders/:id/completion-hold {reasonCode, note?} — `sales-order-holds:UPDATE`. Thứ tự kiểm như BE: body (lý do,
 *   ghi chú ≤ 1000, OTHER cần ghi chú) → 404 → đơn đã qua hoàn tất, chưa giao gì hoặc từng hoàn tất (409
 *   ORDER_COMPLETION_HOLD_NOT_APPLICABLE) → đang giữ
 *   (409 ORDER_COMPLETION_ALREADY_HELD).
 * - POST /orders/:id/completion-hold/release {note} — ghi chú bắt buộc ≤ 1000; không có lần giữ mở → 409
 *   ORDER_COMPLETION_NOT_HELD.
 * Giữ hoàn tất không đổi trạng thái đơn hay lô nào.
 */

import { ORDER_PERMISSIONS } from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import { addCompletionHold, openCompletionHoldOf } from "./mock-order-completion-holds";
import { bodyOf, fail, ok, pathParams, text } from "./mock-route-utils";
import { hasMockPermission } from "./mock-routes-order-schedule";
import { backendStatus, deliveredSomething, findOrder } from "./mock-routes-orders-store";

import type { MockCompletionHold } from "./mock-order-completion-holds";

const NOTE_MAX = 1000;
/** BE `OrderCompletionHolds.PAST_COMPLETION` (fix/wf05-full 18d4cf88). */
const PAST_COMPLETION = ["COMPLETED", "CLOSED", "CANCELLED"];

const forbidden = () => fail(403, "FORBIDDEN", "Access denied");
const notFound = () => fail(404, "NOT_FOUND", "Resource not found");
const invalid = (field: string, message: string) =>
  fail(400, "VALIDATION_FAILED", "Invalid request data", [{ field, message }]);

async function actorId(): Promise<string | null> {
  const { useAuthStore } = await import("@/lib/auth/auth-store");
  return useAuthStore.getState().user?.userId ?? null;
}

export function registerOrderCompletionHoldMockRoutes(): void {
  registerMockRoute("GET", "/orders/:id/completion-hold", async (config) => {
    if (!(await hasMockPermission(ORDER_PERMISSIONS.read))) return forbidden();
    const order = await findOrder(pathParams(config).id ?? "");
    if (!order) return notFound();
    return ok(openCompletionHoldOf(order.orderId) ?? null);
  });

  registerMockRoute("POST", "/orders/:id/completion-hold", async (config) => {
    if (!(await hasMockPermission(ORDER_PERMISSIONS.hold))) return forbidden();
    const body = bodyOf(config);
    const reasonCode = text(body.reasonCode);
    const note = text(body.note) || null;
    if (reasonCode !== "DELIVERY_DISPUTED" && reasonCode !== "OTHER")
      return invalid("reasonCode", "reasonCode is required");
    if (note && note.length > NOTE_MAX) return invalid("note", "note is at most 1000 characters");
    if (reasonCode === "OTHER" && !note) return invalid("note", "OTHER needs a note");
    const order = await findOrder(pathParams(config).id ?? "");
    if (!order) return notFound();
    const status = backendStatus(order);
    if (PAST_COMPLETION.includes(status))
      return fail(
        409,
        "ORDER_COMPLETION_HOLD_NOT_APPLICABLE",
        `Order ${order.orderId} is ${status}: it will not be completed`,
      );
    // BE: không có gì đã giao để xác minh, hoặc đơn từng hoàn tất (khiếu nại muộn)
    if (!deliveredSomething(order) || order.completedAt)
      return fail(
        409,
        "ORDER_COMPLETION_HOLD_NOT_APPLICABLE",
        `Order ${order.orderId} has no delivery to verify`,
      );
    if (openCompletionHoldOf(order.orderId))
      return fail(409, "ORDER_COMPLETION_ALREADY_HELD", "The order's completion is already held");
    const hold: MockCompletionHold = {
      id: crypto.randomUUID(),
      orderId: order.orderId,
      reasonCode,
      note,
      heldAt: new Date().toISOString(),
      heldBy: await actorId(),
      releasedAt: null,
      releasedBy: null,
      releaseNote: null,
    };
    addCompletionHold(hold);
    return ok(hold);
  });

  registerMockRoute("POST", "/orders/:id/completion-hold/release", async (config) => {
    if (!(await hasMockPermission(ORDER_PERMISSIONS.hold))) return forbidden();
    const note = text(bodyOf(config).note);
    if (!note) return invalid("note", "note is required");
    if (note.length > NOTE_MAX) return invalid("note", "note is at most 1000 characters");
    const order = await findOrder(pathParams(config).id ?? "");
    if (!order) return notFound();
    const hold = openCompletionHoldOf(order.orderId);
    if (!hold) return fail(409, "ORDER_COMPLETION_NOT_HELD", "The order's completion is not held");
    hold.releasedAt = new Date().toISOString();
    hold.releasedBy = await actorId();
    hold.releaseNote = note;
    return ok(hold);
  });
}
