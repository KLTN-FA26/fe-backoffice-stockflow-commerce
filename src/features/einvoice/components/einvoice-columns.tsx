"use client";

import { AlertTriangle } from "lucide-react";

import { EINVOICE_ROUTES } from "@/constants/einvoice";
import { EINVOICE_LABELS } from "@/constants/labels-einvoice";
import { ADMIN_ROUTES } from "@/constants";

import { invoiceReference } from "../selectors";

import { CodeLink, DateCell, EInvoiceStatusDot, MoneyCell, TypeText } from "./primitives";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { EInvoiceListItem } from "../types";

const C = EINVOICE_LABELS.columns;

/**
 * Cột danh sách hoá đơn (docs 21 §3 Output). Hạn phát hành chỉ có nghĩa khi chưa phát hành: quá hạn
 * → biểu tượng cảnh báo (ngày lập = ngày giao, docs 21 §4.1 bước 3, open-questions G8).
 */
export const EINVOICE_COLUMNS: ColumnDef<EInvoiceListItem>[] = [
  {
    key: "reference",
    header: C.reference,
    cell: (row) => (
      <CodeLink href={EINVOICE_ROUTES.detail(row.id)}>{invoiceReference(row)}</CodeLink>
    ),
  },
  {
    key: "type",
    header: C.type,
    cell: (row) => <TypeText type={row.type} adjusted={row.adjusted} />,
  },
  {
    key: "order",
    header: C.order,
    cell: (row) =>
      row.orderNumber ? (
        <CodeLink href={ADMIN_ROUTES.orders.detail(row.orderId)}>{row.orderNumber}</CodeLink>
      ) : null,
  },
  {
    key: "shipment",
    header: C.shipment,
    cell: (row) => <span className="font-mono text-[0.8125rem]">{row.shipmentCode ?? "—"}</span>,
  },
  {
    key: "buyer",
    header: C.buyer,
    cell: (row) => (
      <div className="min-w-0">
        <div className="truncate">{row.buyerName ?? "—"}</div>
        <div className="text-ink-tertiary font-mono text-xs">{row.buyerTaxCode ?? "Thiếu MST"}</div>
      </div>
    ),
  },
  {
    key: "issueDate",
    header: C.issueDate,
    align: "right",
    cell: (row) => <DateCell iso={row.issueDate} />,
  },
  {
    key: "dueAt",
    header: C.dueAt,
    align: "right",
    cell: (row) =>
      row.issuedAt ? (
        <span className="text-ink-tertiary">—</span>
      ) : (
        <span className="inline-flex items-center gap-1">
          {row.overdue && (
            <AlertTriangle aria-label="Quá hạn phát hành" className="text-dot-danger size-3.5" />
          )}
          <DateCell iso={row.issueDueAt} />
        </span>
      ),
  },
  {
    key: "grandTotal",
    header: C.grandTotal,
    align: "right",
    cell: (row) => <MoneyCell amount={row.grandTotal} />,
  },
  { key: "status", header: C.status, cell: (row) => <EInvoiceStatusDot status={row.status} /> },
];
