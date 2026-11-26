"use client";

import { ADMIN_ROUTES } from "@/constants";
import { RETURN_RECEIPT_LABELS } from "@/constants/labels-return";
import { RETURN_ROUTES } from "@/constants/returns";

import { CodeLink, MONO, ReturnReceiptStatusDot, When } from "./primitives";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { ReturnReceiptRow } from "../types";

const C = RETURN_RECEIPT_LABELS.columns;

/** Phiếu nhập hàng hoàn: số phiếu, nguồn (RMA / lô hoàn về), đơn, số thùng, mốc thời gian, trạng thái. */
export const RETURN_RECEIPT_COLUMNS: ColumnDef<ReturnReceiptRow>[] = [
  {
    key: "number",
    header: C.number,
    cell: (row) => <CodeLink href={RETURN_ROUTES.receipts.detail(row.id)}>{row.number}</CodeLink>,
  },
  {
    key: "source",
    header: C.source,
    cell: (row) =>
      row.returnRequestId ? (
        <CodeLink href={RETURN_ROUTES.detail(row.returnRequestId)}>
          {RETURN_RECEIPT_LABELS.source.rmaShort}
        </CodeLink>
      ) : (
        <span className="text-ink-secondary">
          {RETURN_RECEIPT_LABELS.createDialog.sourceShipment}
        </span>
      ),
  },
  {
    key: "order",
    header: C.order,
    cell: (row) =>
      row.orderId ? (
        <CodeLink href={ADMIN_ROUTES.orders.detail(row.orderId)}>
          {RETURN_RECEIPT_LABELS.viewOrder}
        </CodeLink>
      ) : null,
  },
  {
    key: "cartons",
    header: C.cartons,
    align: "right",
    cell: (row) => <span className={MONO}>{row.cartonCount}</span>,
  },
  { key: "receivedAt", header: C.receivedAt, cell: (row) => <When iso={row.receivedAt} /> },
  { key: "closedAt", header: C.closedAt, cell: (row) => <When iso={row.closedAt} /> },
  {
    key: "status",
    header: C.status,
    cell: (row) => <ReturnReceiptStatusDot status={row.status} />,
  },
];
