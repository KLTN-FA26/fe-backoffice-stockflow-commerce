"use client";

import { ADMIN_ROUTES } from "@/constants";
import { EINVOICE_ROUTES } from "@/constants/einvoice";
import {
  RETURN_CHANNEL_LABELS,
  RETURN_LABELS,
  RETURN_REASON_LABELS,
} from "@/constants/labels-return";
import { RETURN_ROUTES } from "@/constants/returns";

import { CodeLink, Money, ReturnStatusDot, When } from "./primitives";
import { ReturnDraftReceiptMarker } from "./ReturnDraftReceiptMarker";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { ReturnRow } from "../types";

const C = RETURN_LABELS.columns;

/** Hàng đợi yêu cầu trả hàng (docs 17 §4.10): số RMA, đơn, lý do, nguồn, hạn gửi hàng, giá trị hoàn, trạng thái. */
export const RETURN_COLUMNS: ColumnDef<ReturnRow>[] = [
  {
    key: "rma",
    header: C.rma,
    cell: (row) => <CodeLink href={RETURN_ROUTES.detail(row.id)}>{row.rmaNumber}</CodeLink>,
  },
  {
    key: "order",
    header: C.order,
    cell: (row) => (
      <CodeLink href={ADMIN_ROUTES.orders.detail(row.orderId)}>{row.orderNumber}</CodeLink>
    ),
  },
  { key: "reason", header: C.reason, cell: (row) => RETURN_REASON_LABELS[row.reasonCode] },
  { key: "channel", header: C.channel, cell: (row) => RETURN_CHANNEL_LABELS[row.channel] },
  { key: "requestedAt", header: C.requestedAt, cell: (row) => <When iso={row.requestedAt} /> },
  {
    key: "deadline",
    header: C.deadline,
    cell: (row) =>
      row.status === "AWAITING_RETURN" ? <When iso={row.returnDeadline} withTime={false} /> : null,
  },
  {
    key: "settlement",
    header: C.settlement,
    align: "right",
    cell: (row) => <Money amount={row.settlementAmount} currency={row.currency} />,
  },
  {
    key: "status",
    header: C.status,
    // WF-05 BE-23: đang có phiếu nháp đếm hàng → nêu ngay trên dòng, kèm đường tới phiếu đó
    cell: (row) =>
      row.receiptDraftOpen ? (
        <span className="flex flex-col items-start gap-0.5">
          <ReturnStatusDot status={row.status} />
          <ReturnDraftReceiptMarker returnRequestId={row.id} />
        </span>
      ) : (
        <ReturnStatusDot status={row.status} />
      ),
  },
];

/** Tab "Cần hoá đơn điều chỉnh" (Kế toán): thêm link sang hoá đơn điện tử của đơn (docs 21 §4.4). */
export const VAT_ADJUSTMENT_COLUMNS: ColumnDef<ReturnRow>[] = [
  ...RETURN_COLUMNS.filter((column) => column.key !== "deadline"),
  {
    key: "invoice",
    header: C.invoice,
    cell: (row) => (
      <CodeLink href={EINVOICE_ROUTES.ofOrder(row.orderId)}>{RETURN_LABELS.openInvoices}</CodeLink>
    ),
  },
];
