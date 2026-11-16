"use client";

import Link from "next/link";

import { ADMIN_ROUTES, CANCELLATION_REQUEST_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { StatusDot } from "@/components/shared/StatusDot";

import { cancellationRequestDisplayStatus } from "../../cancellation-request-schemas";
import { useOrder } from "../../queries";
import { cancellationReasonLabel } from "../../selectors";

import { CancellationApproveAction, CancellationRejectAction } from "./CancellationDecisionActions";

import type { ReactNode } from "react";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { CancellationRequest } from "../../cancellation-request-schemas";

const L = CANCELLATION_REQUEST_LABELS.columns;
type RequestColumn = ColumnDef<CancellationRequest> & { key: string };

/** Mã rút gọn khi chưa biết số đơn (đang tải / thiếu quyền đọc đơn) — không bịa mã đơn. */
const shortId = (id: string) => id.slice(0, 8);

/**
 * Mã đơn của một yêu cầu: BE `CancellationRequestResponse` chỉ có `orderId` nên đọc đơn (đã cache khi mở chi tiết). Thiếu
 * quyền đọc đơn → chỉ hiện mã rút gọn của id, không link. UI-only — Backend phải re-check (sales-orders:READ).
 */
export function OrderNumberLink({
  orderId,
  canOpenOrder,
}: {
  orderId: string;
  canOpenOrder: boolean;
}) {
  const query = useOrder(orderId, { enabled: canOpenOrder });
  const label = query.data?.orderNumber ?? shortId(orderId);
  return canOpenOrder ? (
    <Link
      href={ADMIN_ROUTES.orders.detail(orderId)}
      className="text-accent font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium hover:underline"
    >
      {label}
    </Link>
  ) : (
    <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.8125rem]">
      {label}
    </span>
  );
}

/** Nút Duyệt / Từ chối của một hàng: mã đơn lấy từ đơn đã cache (xem `OrderNumberLink`). */
export function RequestRowActions({
  row,
  canOpenOrder,
}: {
  row: CancellationRequest;
  canOpenOrder: boolean;
}) {
  const order = useOrder(row.orderId, { enabled: canOpenOrder });
  const orderNumber = order.data?.orderNumber ?? null;
  return (
    <div className="flex justify-end gap-1.5">
      <CancellationApproveAction
        compact
        orderId={row.orderId}
        orderNumber={orderNumber}
        requestId={row.requestId}
      />
      <CancellationRejectAction
        compact
        orderId={row.orderId}
        orderNumber={orderNumber}
        requestId={row.requestId}
      />
    </div>
  );
}

/** Cột hàng đợi yêu cầu huỷ — mới nhất trước (BE `requestedAt` DESC). */
export function buildCancellationRequestColumns(
  renderActions: (row: CancellationRequest) => ReactNode,
  canOpenOrder: boolean,
): RequestColumn[] {
  return [
    {
      key: "order",
      header: L.order,
      cell: (row) => <OrderNumberLink orderId={row.orderId} canOpenOrder={canOpenOrder} />,
    },
    {
      key: "reason",
      header: L.reason,
      cell: (row) => (
        <div className="flex max-w-72 flex-col">
          <span className="text-ink-primary text-[0.8125rem]">
            {cancellationReasonLabel(row.reasonCode)}
          </span>
          {row.note && <span className="text-ink-tertiary truncate text-xs">{row.note}</span>}
        </div>
      ),
    },
    {
      key: "requestedAt",
      header: L.requestedAt,
      cell: (row) => (
        <span className="text-ink-secondary text-xs tabular-nums">
          {formatDateTime(row.requestedAt)}
        </span>
      ),
    },
    {
      key: "status",
      header: L.status,
      cell: (row) => (
        <StatusDot domain="order" status={cancellationRequestDisplayStatus(row.status)} />
      ),
    },
    { key: "actions", header: "", align: "right", cell: renderActions },
  ];
}
