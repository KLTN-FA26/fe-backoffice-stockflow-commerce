/**
 * Mock yêu cầu huỷ của khách (BE `CancellationRequest`, docs 17 §4.8 bước 28, §5.4) — store in-memory + seed, không đăng
 * ký route (route: `mock-routes-order-cancellation-requests.ts`). Khách gửi yêu cầu ở cổng portal (không có trong FE
 * back-office) nên mock SEED vài yêu cầu trên đơn có sẵn — ASSUMPTION (mock-only), không thêm đơn mới.
 */

import type { Order } from "@/lib/mock-data";

export type MockRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export interface MockCancellationRequest {
  requestId: string;
  orderId: string;
  requestedBy: string;
  reasonCode: string;
  note: string | null;
  requestedAt: string;
  status: MockRequestStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  retainedPercent: number | null;
  version: number;
}

/** Trạng thái đơn mock → yêu cầu seed (đơn đã release cho sản xuất / kho: khách không tự huỷ được nữa). */
const SEED_BY_STATUS: Readonly<
  Record<
    string,
    { reasonCode: string; note: string | null; status: MockRequestStatus; decisionNote?: string }
  >
> = {
  "In Production": {
    reasonCode: "OTHER",
    note: "Khách đổi thiết kế, không in nữa",
    status: "PENDING",
  },
  "Ready to Fulfill": { reasonCode: "DUPLICATE_ORDER", note: null, status: "PENDING" },
  Picking: { reasonCode: "CUSTOMER_REQUEST", note: "Khách hoãn dự án", status: "PENDING" },
  // BE: đơn đã có thùng dán nhãn giao hàng → yêu cầu tự hết hiệu lực (docs 17 §5.4)
  Packed: {
    reasonCode: "CUSTOMER_REQUEST",
    note: null,
    status: "EXPIRED",
    decisionNote: "The order was packed and can no longer be cancelled; raise a return instead",
  },
};

const requests = new Map<string, MockCancellationRequest>();
let seeded = false;

/** Seed một lần từ mock-data (đơn theo trạng thái ở bảng trên). */
export function ensureCancellationRequestsSeeded(orders: readonly Order[]): void {
  if (seeded) return;
  seeded = true;
  for (const order of orders) {
    const seed = SEED_BY_STATUS[order.status];
    if (!seed) continue;
    const requestedAt = order.confirmedAt ?? order.placedAt;
    const requestId = `CREQ-${order.orderId}`;
    requests.set(requestId, {
      requestId,
      orderId: order.orderId,
      requestedBy: order.customerId,
      reasonCode: seed.reasonCode,
      note: seed.note,
      requestedAt,
      status: seed.status,
      decidedBy: null,
      decidedAt: seed.status === "EXPIRED" ? requestedAt : null,
      decisionNote: seed.decisionNote ?? null,
      retainedPercent: null,
      version: 0,
    });
  }
}

export const allCancellationRequests = (): MockCancellationRequest[] => [...requests.values()];
export const cancellationRequestById = (id: string) => requests.get(id);

export function saveCancellationRequest(request: MockCancellationRequest): void {
  requests.set(request.requestId, request);
}

/** Xoá mọi yêu cầu của phiên (và seed lại ở lần đọc sau) — test gọi giữa các ca (cùng `resetOrderMockStore`). */
export function resetCancellationRequestMockStore(): void {
  requests.clear();
  seeded = false;
}
