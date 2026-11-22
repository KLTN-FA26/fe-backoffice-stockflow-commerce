"use client";

import {
  DESIGN_QUOTE_REQUEST_STATUS_LABELS,
  DESIGN_STATUS_LABELS,
  DESIGN_STATUS_TONE_KEY,
} from "@/constants";

import { formatDate, formatDateTime } from "@/lib/format/date";

import { CustomerName } from "@/components/backoffice/CustomerName";
import { StatusDot } from "@/components/shared/StatusDot";

import { QuoteRequestActions } from "./QuoteRequestActions";

import type { DesignStatus } from "@/constants";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { CloseRequestMutation } from "./QuoteRequestActions";
import type { DesignQuoteRequest, ProjectQuoteRequest, QuoteRequest } from "../types";

const MONO = "font-[family-name:var(--font-mono)] text-[0.8125rem] tabular-nums";
const DASH = <span className="text-ink-tertiary">—</span>;

function DesignStatusDot({ status }: { status: DesignStatus }) {
  return (
    <StatusDot
      domain="order"
      status={DESIGN_STATUS_TONE_KEY[status]}
      label={DESIGN_STATUS_LABELS[status]}
    />
  );
}

function RequestStatus({ row }: { row: QuoteRequest }) {
  return (
    <StatusDot
      domain="order"
      status={row.status === "OPEN" ? "PENDING_APPROVAL" : "CLOSED"}
      label={DESIGN_QUOTE_REQUEST_STATUS_LABELS[row.status]}
    />
  );
}

const customerCell = (row: QuoteRequest) => (
  <CustomerName id={row.customerId} name={row.customerName} />
);

const deliveryCell = (row: QuoteRequest) =>
  row.desiredDeliveryDate ? (
    <span className="tabular-nums">{formatDate(row.desiredDeliveryDate)}</span>
  ) : (
    DASH
  );

const requestedAtCell = (row: QuoteRequest) => (
  <span className="text-ink-secondary tabular-nums">{formatDateTime(row.requestedAt)}</span>
);

const actionsColumn = <T extends QuoteRequest>(close: CloseRequestMutation): ColumnDef<T> => ({
  key: "actions",
  header: "Hành động",
  cell: (row) => <QuoteRequestActions row={row} close={close} />,
});

/** 12 cột của hộp yêu cầu báo giá đơn lẻ. */
export function designQuoteRequestColumns(
  close: CloseRequestMutation,
): ColumnDef<DesignQuoteRequest>[] {
  return [
    {
      key: "design",
      header: "Thiết kế",
      cell: (row) => <span className="text-ink-primary font-medium">{row.designName}</span>,
    },
    {
      key: "designStatus",
      header: "Trạng thái thiết kế",
      cell: (row) => <DesignStatusDot status={row.designStatus} />,
    },
    { key: "customer", header: "Khách hàng", cell: customerCell },
    { key: "sku", header: "SKU phôi", cell: (row) => <span className={MONO}>{row.sku}</span> },
    {
      key: "customerSku",
      header: "SKU riêng",
      cell: (row) => (row.customerSku ? <span className={MONO}>{row.customerSku}</span> : DASH),
    },
    {
      key: "cartons",
      header: "Số thùng",
      align: "right",
      cell: (row) => <span className="tabular-nums">{row.cartons}</span>,
    },
    { key: "delivery", header: "Giao mong muốn", align: "right", cell: deliveryCell },
    { key: "requestedAt", header: "Yêu cầu lúc", align: "right", cell: requestedAtCell },
    { key: "status", header: "Trạng thái", cell: (row) => <RequestStatus row={row} /> },
    {
      key: "returnReason",
      header: "Lý do trả lại",
      className: "max-w-[14rem]",
      cell: (row) =>
        row.returnReason ? (
          <span
            className="text-ink-secondary line-clamp-2 text-[0.8125rem]"
            title={row.returnReason}
          >
            {row.returnReason}
          </span>
        ) : (
          DASH
        ),
    },
    actionsColumn(close),
  ];
}

/** Các dòng của yêu cầu dự án, thu gọn: "tên · SKU riêng × thùng". */
function ProjectLines({ row }: { row: ProjectQuoteRequest }) {
  return (
    <ul className="text-ink-secondary flex flex-col gap-0.5 text-[0.8125rem]">
      {row.lines.map((line) => (
        <li key={line.designId}>
          {line.designName} · <span className={MONO}>{line.customerSku ?? "—"}</span> ×{" "}
          <span className="tabular-nums">{line.cartons}</span>
        </li>
      ))}
    </ul>
  );
}

/** 9 cột của hộp yêu cầu báo giá dự án. */
export function projectQuoteRequestColumns(
  close: CloseRequestMutation,
): ColumnDef<ProjectQuoteRequest>[] {
  return [
    {
      key: "project",
      header: "Dự án",
      cell: (row) => <span className="text-ink-primary font-medium">{row.projectName}</span>,
    },
    { key: "customer", header: "Khách hàng", cell: customerCell },
    {
      key: "designs",
      header: "Số thiết kế",
      align: "right",
      cell: (row) => <span className="tabular-nums">{row.lines.length}</span>,
    },
    {
      key: "cartons",
      header: "Tổng số thùng",
      align: "right",
      cell: (row) => (
        <span className="tabular-nums">
          {row.lines.reduce((sum, line) => sum + line.cartons, 0)}
        </span>
      ),
    },
    { key: "lines", header: "Các dòng", cell: (row) => <ProjectLines row={row} /> },
    { key: "delivery", header: "Giao mong muốn", align: "right", cell: deliveryCell },
    { key: "requestedAt", header: "Yêu cầu lúc", align: "right", cell: requestedAtCell },
    { key: "status", header: "Trạng thái", cell: (row) => <RequestStatus row={row} /> },
    actionsColumn(close),
  ];
}
