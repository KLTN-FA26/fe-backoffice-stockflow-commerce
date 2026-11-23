"use client";

import Link from "next/link";
import { MessageSquareWarning } from "lucide-react";

import {
  ADMIN_ROUTES,
  DESIGN_QUOTE_REQUEST_LABELS as COPY,
  DESIGN_QUOTE_REQUEST_STATUS_LABELS,
  DESIGN_STATUS_LABELS,
  DESIGN_STATUS_TONE_KEY,
} from "@/constants";

import { formatDate, formatDateTime } from "@/lib/format/date";

import { CustomerName } from "@/components/backoffice/CustomerName";
import { CELL } from "@/components/shared/column-helpers";
import { StatusDot } from "@/components/shared/StatusDot";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { QuoteRequestActions } from "./QuoteRequestActions";

import type { DesignStatus } from "@/constants";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { CloseRequestMutation } from "./QuoteRequestActions";
import type { DesignQuoteRequest, ProjectQuoteRequest, QuoteRequest } from "../types";

const MONO = "font-[family-name:var(--font-mono)] text-[0.8125rem] tabular-nums";
const DASH = <span className="text-ink-tertiary">—</span>;
const C = COPY.columns;

/** Cột của hộp yêu cầu đơn lẻ, theo thứ tự hiển thị. */
export const DESIGN_REQUEST_COLUMNS = [
  "design",
  "designStatus",
  "customer",
  "sku",
  "customerSku",
  "cartons",
  "delivery",
  "requestedAt",
  "status",
  "returnReason",
  "actions",
] as const;
export type DesignRequestColumn = (typeof DESIGN_REQUEST_COLUMNS)[number];
/**
 * Ẩn mặc định (BO-UX-10): trạng thái thiết kế (lý do chưa lập báo giá đã nằm cạnh nút), SKU phôi, lý do trả lại (hiện
 * thành icon trên ô trạng thái). Bật lại được qua `Ẩn hiện cột`.
 */
export const DESIGN_REQUEST_DEFAULT_COLUMNS: readonly DesignRequestColumn[] =
  DESIGN_REQUEST_COLUMNS.filter(
    (column) => column !== "designStatus" && column !== "sku" && column !== "returnReason",
  );
export const DESIGN_REQUEST_LOCKED_COLUMNS: readonly DesignRequestColumn[] = ["design", "actions"];
export const DESIGN_REQUEST_COLUMN_LABELS: Record<DesignRequestColumn, string> = {
  design: C.design,
  designStatus: C.designStatus,
  customer: C.customer,
  sku: C.sku,
  customerSku: C.customerSku,
  cartons: C.cartons,
  delivery: C.delivery,
  requestedAt: C.requestedAt,
  status: C.status,
  returnReason: C.returnReason,
  actions: C.actions,
};

export const PROJECT_REQUEST_COLUMNS = [
  "project",
  "customer",
  "designs",
  "cartons",
  "lines",
  "delivery",
  "requestedAt",
  "status",
  "actions",
] as const;
export type ProjectRequestColumn = (typeof PROJECT_REQUEST_COLUMNS)[number];
export const PROJECT_REQUEST_LOCKED_COLUMNS: readonly ProjectRequestColumn[] = [
  "project",
  "actions",
];
export const PROJECT_REQUEST_COLUMN_LABELS: Record<ProjectRequestColumn, string> = {
  project: C.project,
  customer: C.customer,
  designs: C.designs,
  cartons: C.totalCartons,
  lines: C.lines,
  delivery: C.delivery,
  requestedAt: C.requestedAt,
  status: C.status,
  actions: C.actions,
};

function DesignStatusDot({ status }: { status: DesignStatus }) {
  return (
    <StatusDot
      domain="order"
      status={DESIGN_STATUS_TONE_KEY[status]}
      label={DESIGN_STATUS_LABELS[status]}
    />
  );
}

/** Lý do trả lại của thiết kế: icon có tooltip trên ô trạng thái (cột riêng ẩn mặc định — thường trống). */
function ReturnReasonIcon({ reason, name }: { reason: string; name: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`${COPY.returnReason} — ${name}: ${reason}`}
            className="hover:text-ink-primary rounded-[var(--r-sm)] p-0.5"
          >
            <MessageSquareWarning className="text-dot-warning size-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-72">{reason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Trạng thái yêu cầu; đóng vì đã có báo giá (R5-5 `closedOutcome=QUOTED`) → "Đã báo giá QT-…" dẫn tới báo giá, thay vì
 * chỉ "Đã đóng".
 */
function RequestStatus({ row }: { row: QuoteRequest }) {
  const quoted = row.status === "CLOSED" && row.closedOutcome === "QUOTED" && row.quoteId;
  const returnReason = "returnReason" in row ? row.returnReason : null;
  return (
    // Stacked, not side by side: the quote link must not run under the pinned actions column at 1366 px.
    <span className="inline-flex flex-col items-start gap-0.5">
      <StatusDot
        domain="order"
        status={row.status === "OPEN" ? "PENDING_APPROVAL" : "CLOSED"}
        label={
          row.status === "CLOSED" && row.closedOutcome === "CLOSED_BY_STAFF"
            ? COPY.closedByStaff
            : DESIGN_QUOTE_REQUEST_STATUS_LABELS[row.status]
        }
      />
      {quoted && row.quoteId && (
        <Link
          href={ADMIN_ROUTES.quotes.detail(row.quoteId)}
          className={`${CELL.code} hover:underline`}
        >
          {COPY.quotedAs} {row.quoteNumber ?? ""}
        </Link>
      )}
      {returnReason && "designName" in row && (
        <ReturnReasonIcon reason={returnReason} name={row.designName} />
      )}
    </span>
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

/** Cột thao tác ghim phải: nút chính luôn thấy được dù bảng cuộn ngang (BO-UX-10). */
const actionsColumn = <T extends QuoteRequest>(close: CloseRequestMutation): ColumnDef<T> => ({
  key: "actions",
  header: C.actions,
  align: "right",
  sticky: "right",
  cell: (row) => <QuoteRequestActions row={row} close={close} />,
});

/** Tên thiết kế dẫn tới trang thiết kế khi người dùng mở được (`design-designs:VIEW_PAGE`). */
function DesignNameCell({
  row,
  canOpenDesign,
}: {
  row: DesignQuoteRequest;
  canOpenDesign: boolean;
}) {
  return canOpenDesign ? (
    <Link
      href={ADMIN_ROUTES.designs.detail(row.designId)}
      className="text-accent-text font-medium hover:underline"
    >
      {row.designName}
    </Link>
  ) : (
    <span className="text-ink-primary font-medium">{row.designName}</span>
  );
}

/** Cột của hộp yêu cầu báo giá đơn lẻ (xem `DESIGN_REQUEST_COLUMNS`). */
export function designQuoteRequestColumns(
  close: CloseRequestMutation,
  canOpenDesign: boolean,
): ColumnDef<DesignQuoteRequest>[] {
  return [
    {
      key: "design",
      header: C.design,
      cell: (row) => <DesignNameCell row={row} canOpenDesign={canOpenDesign} />,
    },
    {
      key: "designStatus",
      header: C.designStatus,
      cell: (row) => <DesignStatusDot status={row.designStatus} />,
    },
    { key: "customer", header: C.customer, cell: customerCell },
    { key: "sku", header: C.sku, cell: (row) => <span className={MONO}>{row.sku}</span> },
    {
      key: "customerSku",
      header: C.customerSku,
      cell: (row) => (row.customerSku ? <span className={MONO}>{row.customerSku}</span> : DASH),
    },
    {
      key: "cartons",
      header: C.cartons,
      align: "right",
      cell: (row) => <span className="tabular-nums">{row.cartons}</span>,
    },
    { key: "delivery", header: C.delivery, align: "right", cell: deliveryCell },
    { key: "requestedAt", header: C.requestedAt, align: "right", cell: requestedAtCell },
    { key: "status", header: C.status, cell: (row) => <RequestStatus row={row} /> },
    {
      key: "returnReason",
      header: C.returnReason,
      className: "max-w-[14rem]",
      cell: (row) =>
        row.returnReason ? (
          <span className="text-ink-secondary line-clamp-2 text-[0.8125rem]">
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

/** Cột của hộp yêu cầu báo giá dự án (xem `PROJECT_REQUEST_COLUMNS`). */
export function projectQuoteRequestColumns(
  close: CloseRequestMutation,
): ColumnDef<ProjectQuoteRequest>[] {
  return [
    {
      key: "project",
      header: C.project,
      cell: (row) => <span className="text-ink-primary font-medium">{row.projectName}</span>,
    },
    { key: "customer", header: C.customer, cell: customerCell },
    {
      key: "designs",
      header: C.designs,
      align: "right",
      cell: (row) => <span className="tabular-nums">{row.lines.length}</span>,
    },
    {
      key: "cartons",
      header: C.totalCartons,
      align: "right",
      cell: (row) => (
        <span className="tabular-nums">
          {row.lines.reduce((sum, line) => sum + line.cartons, 0)}
        </span>
      ),
    },
    { key: "lines", header: C.lines, cell: (row) => <ProjectLines row={row} /> },
    { key: "delivery", header: C.delivery, align: "right", cell: deliveryCell },
    { key: "requestedAt", header: C.requestedAt, align: "right", cell: requestedAtCell },
    { key: "status", header: C.status, cell: (row) => <RequestStatus row={row} /> },
    actionsColumn(close),
  ];
}
