import Link from "next/link";

import { ADMIN_ROUTES, DELIVERY_FAILURE_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";

import { allowedDeliveryFailureActions } from "../../delivery-failure-lifecycle";

import { CancelUndeliveredAction } from "./CancelUndeliveredAction";
import { DeliveryFailureStatus, failureReasonLabel } from "./DeliveryFailureStatus";
import { RedeliverAction } from "./RedeliverAction";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { PermissionCode } from "@/lib/auth";
import type { DeliveryFailureCase } from "../../delivery-failure-schemas";

const C = DELIVERY_FAILURE_LABELS.columns;
const MONO = "font-[family-name:var(--font-mono)] text-[0.8125rem]";

/** Nút quyết định của một hồ sơ — gate qua `allowedDeliveryFailureActions` (không if/else rải trong JSX). */
function CaseActions({
  row,
  can,
}: {
  row: DeliveryFailureCase;
  can: (code: PermissionCode) => boolean;
}) {
  const actions = allowedDeliveryFailureActions(row, can);
  if (actions.length === 0) return null;
  return (
    <div className="flex justify-end gap-1.5">
      {actions.includes("redeliver") && <RedeliverAction failure={row} compact />}
      {actions.includes("cancel-undelivered") && (
        <CancelUndeliveredAction
          compact
          target={{ orderId: row.orderId, orderNumber: row.orderNumber, caseId: row.caseId }}
        />
      )}
    </div>
  );
}

/** Cột hàng đợi giao thất bại — cũ nhất trước (BE trả `openedAt` ASC). */
export function buildDeliveryFailureColumns(
  can: (code: PermissionCode) => boolean,
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
            className={`text-accent font-medium hover:underline ${MONO}`}
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
      cell: (row) => <DeliveryFailureStatus status={row.status} />,
    },
    {
      key: "actions",
      header: C.actions,
      align: "right",
      cell: (row) => <CaseActions row={row} can={can} />,
    },
  ];
}
