"use client";

import { DESIGN_QUOTE_REQUEST_STATUS_LABELS } from "@/constants";

import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";

import { designReviewErrorMessage } from "@/features/design-review/errors";
import { useDesignQuoteRequests } from "@/features/design-review/queries";
import { labelOf } from "@/features/design-review/selectors";

import { DataTable } from "@/components/shared/DataTable";

import { DESIGN_DETAIL_LABELS as L } from "../copy";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { DesignQuoteRequest } from "@/features/design-review/types";

const MONO = "font-[family-name:var(--font-mono)] text-[0.8125rem] tabular-nums";
const DASH = <span className="text-ink-tertiary">—</span>;

const COLUMNS: ColumnDef<DesignQuoteRequest>[] = [
  {
    key: "requestedAt",
    header: "Yêu cầu lúc",
    className: "min-w-40 whitespace-nowrap",
    sortable: true,
    compare: (a, b) => a.requestedAt.localeCompare(b.requestedAt),
    cell: (row) => <span className="tabular-nums">{formatDateTime(row.requestedAt)}</span>,
  },
  {
    key: "cartons",
    header: "Số thùng",
    align: "right",
    sortable: true,
    compare: (a, b) => a.cartons - b.cartons,
    cell: (row) => <span className="tabular-nums">{formatNumber(row.cartons)}</span>,
  },
  {
    key: "customerSku",
    header: "SKU riêng",
    cell: (row) => (row.customerSku ? <span className={MONO}>{row.customerSku}</span> : DASH),
  },
  {
    key: "delivery",
    header: "Giao mong muốn",
    align: "right",
    sortable: true,
    compare: (a, b) => (a.desiredDeliveryDate ?? "").localeCompare(b.desiredDeliveryDate ?? ""),
    cell: (row) =>
      row.desiredDeliveryDate ? (
        <span className="tabular-nums">{formatDate(row.desiredDeliveryDate)}</span>
      ) : (
        DASH
      ),
  },
  {
    key: "status",
    header: "Trạng thái",
    sortable: true,
    compare: (a, b) => a.status.localeCompare(b.status),
    cell: (row) => labelOf(DESIGN_QUOTE_REQUEST_STATUS_LABELS, row.status),
  },
];

/**
 * Yêu cầu báo giá đi kèm thiết kế — bảng trong tab (backoffice-erp-ui B12/B16): cho người duyệt biết duyệt xong sẽ có báo
 * giá cần lập. Tên tab đã là tiêu đề nên bảng không có tiêu đề riêng (B14).
 */
export function QuoteRequestsPanel({ designId }: { designId: string }) {
  const query = useDesignQuoteRequests(designId);
  if (query.isError)
    return (
      <p role="alert" className="text-danger text-[0.8125rem]">
        {designReviewErrorMessage(query.error)}
      </p>
    );
  if (!query.data) return <p className="text-ink-tertiary text-[0.8125rem]">Đang tải…</p>;
  return (
    <div className="space-y-2">
      <p className="text-ink-tertiary text-xs">{L.quoteRequestsDescription}</p>
      <DataTable
        data={query.data}
        columns={COLUMNS}
        rowKey={(row) => row.id}
        caption={`${query.data.length} yêu cầu`}
        pageSize={10}
        stickyHeader
        emptyState="Khách chưa yêu cầu báo giá cho thiết kế này."
      />
    </div>
  );
}
