"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleCheck, CircleX } from "lucide-react";

import { ADMIN_ROUTES, CANCELLATION_REQUEST_LABELS, ORDER_STATUS_UNKNOWN } from "@/constants";
import { formatMoney } from "@/lib/format";
import { formatDateTime } from "@/lib/format/date";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";
import { StatusDot } from "@/components/shared/StatusDot";

import { useOrder } from "../../queries";
import { cancellationReasonLabel } from "../../selectors";
import { BACKEND_TO_FE_ORDER_STATUS } from "../../status-map";

import {
  useCancellationApproveDialog,
  useCancellationRejectDialog,
} from "./CancellationDecisionActions";

import type { ReactNode } from "react";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { CancellationRequest } from "../../cancellation-request-schemas";

const L = CANCELLATION_REQUEST_LABELS.columns;
const Q = CANCELLATION_REQUEST_LABELS.queue;
type RequestColumn = ColumnDef<CancellationRequest> & { key: string };
const MONO = "font-[family-name:var(--font-mono)] text-[0.8125rem] tabular-nums";
const DASH = <span className="text-ink-tertiary">—</span>;

export const CANCELLATION_QUEUE_COLUMNS = [
  "order",
  "customer",
  "orderTotal",
  "paid",
  "orderStatus",
  "printing",
  "reason",
  "requestedAt",
  "actions",
] as const;
export type CancellationQueueColumn = (typeof CANCELLATION_QUEUE_COLUMNS)[number];
export const CANCELLATION_QUEUE_LOCKED: readonly CancellationQueueColumn[] = ["order", "actions"];
export const CANCELLATION_QUEUE_LABELS: Record<CancellationQueueColumn, string> = {
  order: L.order,
  customer: L.customer,
  orderTotal: L.orderTotal,
  paid: L.paid,
  orderStatus: L.orderStatus,
  printing: L.printing,
  reason: L.reason,
  requestedAt: L.requestedAt,
  actions: L.actions,
};

/** Trạng thái đơn R5-6 là mã BE (`ON_HOLD`); mã lạ → "Không rõ", không hiện mã thô (BO-UX-6). */
function r5OrderStatus(code: string) {
  return Object.hasOwn(BACKEND_TO_FE_ORDER_STATUS, code)
    ? BACKEND_TO_FE_ORDER_STATUS[code as keyof typeof BACKEND_TO_FE_ORDER_STATUS]
    : ORDER_STATUS_UNKNOWN;
}

/**
 * Sự thật về đơn của một yêu cầu (BO-UX-34): R5-6 gửi kèm trong dòng; BE chưa gửi → đọc từ đơn (`GET /orders/{id}`, cùng
 * cache với trang chi tiết) khi người dùng có `sales-orders:READ`. Không có cả hai → null, ô ghi "—" (không đoán).
 */
function useRequestOrderFacts(row: CancellationRequest, canOpenOrder: boolean) {
  const needsOrder =
    row.orderNumber == null ||
    row.customerName == null ||
    row.orderTotal == null ||
    row.paidTotal == null ||
    row.orderStatus == null;
  const order = useOrder(row.orderId, { enabled: canOpenOrder && needsOrder }).data;
  return {
    orderNumber: row.orderNumber ?? order?.orderNumber ?? null,
    customerName: row.customerName ?? order?.customerName ?? null,
    total: row.orderTotal ?? order?.totalAmount ?? null,
    // `OrderResponse` không còn `paidAmount` (4B-10, WF-05 BO-08): chỉ số BE kèm trên dòng yêu cầu
    paid: row.paidTotal ?? null,
    currency: order?.currency ?? "VND",
    status: row.orderStatus ? r5OrderStatus(row.orderStatus) : (order?.status ?? null),
  };
}

/** Mã đơn của dòng — link tới thẻ yêu cầu huỷ trên chi tiết đơn khi mở được đơn. Chưa biết số đơn → chữ trung tính. */
export function OrderNumberLink({
  row,
  canOpenOrder,
}: {
  row: CancellationRequest;
  canOpenOrder: boolean;
}) {
  const facts = useRequestOrderFacts(row, canOpenOrder);
  const label = facts.orderNumber ?? Q.unknownOrder;
  return canOpenOrder ? (
    <Link
      href={ADMIN_ROUTES.orders.cancellationRequest(row.orderId)}
      className="text-accent-text font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium hover:underline"
      onClick={(event) => event.stopPropagation()}
    >
      {label}
    </Link>
  ) : (
    <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.8125rem]">
      {label}
    </span>
  );
}

function FactCell({
  row,
  canOpenOrder,
  render,
}: {
  row: CancellationRequest;
  canOpenOrder: boolean;
  render: (facts: ReturnType<typeof useRequestOrderFacts>) => ReactNode;
}) {
  return <>{render(useRequestOrderFacts(row, canOpenOrder))}</>;
}

/** Ghi chú của khách: 2 dòng, bấm "Xem thêm" để đọc hết (BO-UX-34 — không còn bị cắt một dòng không cách nào mở). */
function ReasonCell({ row }: { row: CancellationRequest }) {
  const [open, setOpen] = useState(false);
  const noteId = `cancellation-note-${row.requestId}`;
  return (
    <div className="flex max-w-80 flex-col gap-0.5">
      <span className="text-ink-primary text-[0.8125rem]">
        {cancellationReasonLabel(row.reasonCode)}
      </span>
      {row.note && (
        <>
          <span
            id={noteId}
            className={`text-ink-secondary text-xs whitespace-pre-line ${open ? "" : "line-clamp-2"}`}
          >
            {row.note}
          </span>
          {row.note.length > Q.noteClampChars && (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={noteId}
              onClick={(event) => {
                event.stopPropagation();
                setOpen((value) => !value);
              }}
              className="text-accent-text self-start text-xs hover:underline"
            >
              {open ? Q.noteLess : Q.noteMore}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Menu "⋯" Duyệt / Từ chối của một hàng (backoffice-erp-ui A6): tên truy cập mang số đơn; "Duyệt huỷ" chữ đỏ, cuối menu
 * vì nó huỷ đơn (BO-UX-36). Hộp thoại duyệt nhận số đã thu và giai đoạn in (BO-UX-35) từ cùng nguồn với các cột.
 */
export function RequestRowActions({
  row,
  canOpenOrder,
}: {
  row: CancellationRequest;
  canOpenOrder: boolean;
}) {
  const { orderNumber, paid, currency } = useRequestOrderFacts(row, canOpenOrder);
  const ids = { orderId: row.orderId, orderNumber, requestId: row.requestId };
  const reject = useCancellationRejectDialog(ids);
  const approve = useCancellationApproveDialog({
    ...ids,
    facts: { paidTotal: paid, printingStarted: row.printingStarted, currency },
  });
  return (
    <RowActionsMenu
      label={`Thao tác — ${orderNumber ?? Q.unknownOrder}`}
      actions={[
        {
          label: CANCELLATION_REQUEST_LABELS.reject.button,
          icon: CircleX,
          disabled: reject.isPending,
          onSelect: reject.show,
        },
        {
          label: CANCELLATION_REQUEST_LABELS.approve.button,
          icon: CircleCheck,
          disabled: approve.isPending,
          danger: true,
          onSelect: approve.show,
        },
      ]}
    >
      {reject.dialog}
      {approve.dialog}
    </RowActionsMenu>
  );
}

/**
 * Cột hàng đợi yêu cầu huỷ — mới nhất trước (BE `requestedAt` DESC). Không còn cột "Trạng thái": hàng đợi chỉ lấy
 * PENDING nên cột đó luôn một giá trị.
 */
export function buildCancellationRequestColumns(
  renderActions: (row: CancellationRequest) => ReactNode,
  canOpenOrder: boolean,
): RequestColumn[] {
  const fact = (render: (facts: ReturnType<typeof useRequestOrderFacts>) => ReactNode) =>
    function Cell(row: CancellationRequest) {
      return <FactCell row={row} canOpenOrder={canOpenOrder} render={render} />;
    };
  return [
    {
      key: "order",
      header: L.order,
      cell: (row) => <OrderNumberLink row={row} canOpenOrder={canOpenOrder} />,
    },
    {
      key: "customer",
      header: L.customer,
      cell: fact((f) =>
        f.customerName ? (
          <span className="text-ink-primary text-[0.8125rem]">{f.customerName}</span>
        ) : (
          DASH
        ),
      ),
    },
    {
      key: "orderTotal",
      header: L.orderTotal,
      align: "right",
      cell: fact((f) =>
        f.total != null ? <span className={MONO}>{formatMoney(f.total, f.currency)}</span> : DASH,
      ),
    },
    {
      key: "paid",
      header: L.paid,
      align: "right",
      cell: fact((f) =>
        f.paid != null ? <span className={MONO}>{formatMoney(f.paid, f.currency)}</span> : DASH,
      ),
    },
    {
      key: "orderStatus",
      header: L.orderStatus,
      cell: fact((f) => (f.status ? <StatusDot domain="order" status={f.status} /> : DASH)),
    },
    {
      key: "printing",
      header: L.printing,
      cell: (row) =>
        row.printingStarted == null ? (
          DASH
        ) : (
          <span className="text-ink-primary text-[0.8125rem]">
            {row.printingStarted ? Q.printingStarted : Q.printingNotStarted}
          </span>
        ),
    },
    { key: "reason", header: L.reason, cell: (row) => <ReasonCell row={row} /> },
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
      key: "actions",
      header: L.actions,
      align: "right",
      sticky: "right",
      className: "w-20",
      cell: renderActions,
    },
  ];
}
