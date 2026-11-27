/**
 * Kho mock giữ hoàn tất đơn (WF-05 GH-2, BE `ordering.order_completion_hold`): mỗi đơn tối đa một lần giữ đang mở
 * (`releasedAt` null), lần đã gỡ được giữ lại. Chỉ trạng thái — route ở `mock-routes-order-completion-holds.ts`. Chỉ dùng
 * khi USE_MOCK=true.
 */

export interface MockCompletionHold {
  id: string;
  orderId: string;
  reasonCode: "DELIVERY_DISPUTED" | "OTHER";
  note: string | null;
  heldAt: string;
  heldBy: string | null;
  /** Tên người giữ / người gỡ BE kèm cạnh id (issue #286). */
  heldByName: string | null;
  releasedAt: string | null;
  releasedBy: string | null;
  releasedByName: string | null;
  releaseNote: string | null;
}

const holds: MockCompletionHold[] = [];

export function resetCompletionHoldMockStore(): void {
  holds.length = 0;
}

/** Lần giữ đang mở của đơn (BE `OrderCompletionHolds#current`). */
export function openCompletionHoldOf(orderId: string): MockCompletionHold | undefined {
  return holds.find((hold) => hold.orderId === orderId && hold.releasedAt === null);
}

export function addCompletionHold(hold: MockCompletionHold): void {
  holds.push(hold);
}
