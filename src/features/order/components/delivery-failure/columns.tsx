import Link from "next/link";

import { ADMIN_ROUTES, DELIVERY_FAILURE_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";

import { DeliveryFailureStatus, failureReasonLabel } from "./DeliveryFailureStatus";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { DeliveryFailureCase } from "../../delivery-failure-schemas";

const C = DELIVERY_FAILURE_LABELS.columns;
const MONO = "font-[family-name:var(--font-mono)] text-[0.8125rem]";

/**
 * Cột lịch sử lô hàng hoàn về (WF-05 BO-01) — chỉ đọc: không còn "Giao lại"; "Huỷ phần chưa giao" của đơn cũ nằm trong
 * chi tiết đơn (cần lý do giữ của đơn, dòng ở đây không có).
 */
export function buildDeliveryFailureColumns(
  canOpenOrder: boolean,
): ColumnDef<DeliveryFailureCase>[] {
  return [
    {
      key: "order",
      header: C.order,
      cell: (row) =>
        canOpenOrder ? (
          <Link
            href={ADMIN_ROUTES.orders.detail(row.orderId)}
            className={`text-accent-text font-medium hover:underline ${MONO}`}
          >
            {row.orderNumber}
          </Link>
        ) : (
          <span className={`text-ink-primary ${MONO}`}>{row.orderNumber}</span>
        ),
    },
    {
      key: "receipt",
      header: C.receipt,
      cell: (row) => <span className={`text-ink-primary ${MONO}`}>{row.receiptNumber ?? "—"}</span>,
    },
    {
      key: "reason",
      header: C.reason,
      cell: (row) => (
        <div className="flex max-w-72 flex-col">
          <span className="text-ink-primary text-[0.8125rem]">
            {failureReasonLabel(row.failureReason)}
          </span>
          {row.failureNote && (
            <span className="text-ink-tertiary truncate text-xs">{row.failureNote}</span>
          )}
        </div>
      ),
    },
    {
      key: "openedAt",
      header: C.openedAt,
      cell: (row) => (
        <span className="text-ink-secondary text-xs tabular-nums">
          {formatDateTime(row.openedAt)}
        </span>
      ),
    },
    {
      key: "status",
      header: C.status,
      cell: (row) => <DeliveryFailureStatus failure={row} />,
    },
  ];
}
