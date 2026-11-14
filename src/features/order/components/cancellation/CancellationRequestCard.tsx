"use client";

import {
  CANCELLATION_REQUEST_LABELS,
  CANCELLATION_REQUEST_PERMISSIONS,
  PAGE_SIZE,
  PAYMENT_REFUND_PERMISSIONS,
} from "@/constants";

import { allowedCancellationRequestActions } from "../../cancellation-request-lifecycle";
import { useCancellationRequests } from "../../queries";

import { CancellationApproveAction, CancellationRejectAction } from "./CancellationDecisionActions";
import { CancellationRequestSummary } from "./CancellationRequestSummary";
import { CancellationSettlementPanel } from "./CancellationSettlementPanel";

import type { PermissionCode } from "@/lib/auth";
import type { Order } from "../../types";

const L = CANCELLATION_REQUEST_LABELS.card;

interface CancellationRequestCardProps {
  order: Pick<Order, "orderId" | "orderNumber" | "status" | "currency">;
  can: (code: PermissionCode) => boolean;
}

/**
 * Yêu cầu huỷ của khách cho đơn này (docs 17 §4.8 bước 28, §5.4): yêu cầu đang chờ có nút Duyệt / Từ chối (Sale), các
 * yêu cầu đã quyết hiện kèm ghi chú; đơn đã duyệt huỷ hiện kết quả tất toán BE tính. Chỉ hiện với người có
 * `sales-order-cancellations:READ` và khi đơn CÓ yêu cầu (không chiếm chỗ ở đơn khách chưa yêu cầu huỷ). UI-only — Backend
 * phải re-check (@RequiresPermission READ / UPDATE).
 */
export function CancellationRequestCard({ order, can }: CancellationRequestCardProps) {
  const canRead = can(CANCELLATION_REQUEST_PERMISSIONS.read);
  const query = useCancellationRequests(
    { orderId: order.orderId, size: PAGE_SIZE.sm },
    { enabled: canRead },
  );
  if (!canRead || query.isPending) return null;
  if (query.isError) {
    return (
      <section
        aria-label={L.title}
        className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]"
      >
        <h2 className="text-ink-primary mb-2 text-[0.9375rem] font-semibold">{L.title}</h2>
        <p className="text-ink-tertiary text-xs">{L.failed}</p>
      </section>
    );
  }
  const requests = query.data.items;
  if (requests.length === 0) return null;
  const approved = requests.some((r) => r.status === "APPROVED");
  return (
    <section
      aria-label={L.title}
      className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]"
    >
      <h2 className="text-ink-primary mb-3 text-[0.9375rem] font-semibold">{L.title}</h2>
      <ul className="divide-border-default divide-y">
        {requests.map((request) => (
          <li key={request.requestId} className="space-y-2 py-3 first:pt-0 last:pb-0">
            <CancellationRequestSummary request={request} />
            {allowedCancellationRequestActions(request.status, can).length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <CancellationApproveAction
                  orderId={order.orderId}
                  orderNumber={order.orderNumber}
                  requestId={request.requestId}
                />
                <CancellationRejectAction
                  orderId={order.orderId}
                  orderNumber={order.orderNumber}
                  requestId={request.requestId}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
      {approved && (
        <CancellationSettlementPanel
          orderId={order.orderId}
          currency={order.currency}
          enabled={can(PAYMENT_REFUND_PERMISSIONS.read)}
        />
      )}
    </section>
  );
}
