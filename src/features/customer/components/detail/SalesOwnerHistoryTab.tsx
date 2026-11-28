"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

import {
  SALES_OWNER_CHANGE_REASON_LABELS,
  SALES_OWNER_LABELS,
} from "@/constants/labels-sales-owner";

import { formatDateTime } from "@/lib/format/date";
import { salesOwnerHistoryNote, useSalesOwnerHistory } from "@/lib/references/sales-owner";

import { DataTable } from "@/components/shared/DataTable";
import { Skeleton } from "@/components/shared/Skeleton";

import type { SalesOwnerHistoryEntry } from "@/lib/references/sales-owner";
import type { ColumnDef } from "@/components/shared/DataTable";

const L = SALES_OWNER_LABELS.history;
const PAGE_SIZES = [10, 20, 50];

const COLUMNS: ColumnDef<SalesOwnerHistoryEntry>[] = [
  {
    key: "changedAt",
    header: "Thời gian",
    className: "min-w-40 whitespace-nowrap",
    cell: (row) => <span className="tabular-nums">{formatDateTime(row.changedAt)}</span>,
  },
  {
    key: "change",
    header: "Từ → sang",
    className: "min-w-56",
    cell: (row) => (
      <span className="text-ink-secondary inline-flex items-center gap-1 text-[0.8125rem]">
        {row.fromName ?? L.nobody}
        <ArrowRight className="size-3" aria-label="chuyển sang" />
        <span className="text-ink-primary font-medium">{row.toName ?? L.nobody}</span>
      </span>
    ),
  },
  {
    key: "reason",
    header: "Lý do",
    className: "min-w-40",
    cell: (row) => (row.reason ? SALES_OWNER_CHANGE_REASON_LABELS[row.reason] : "—"),
  },
  {
    key: "note",
    header: "Ghi chú",
    className: "min-w-56 text-ink-secondary whitespace-normal",
    cell: (row) => salesOwnerHistoryNote(row.note) ?? "—",
  },
  {
    key: "changedBy",
    header: "Người đổi",
    className: "min-w-36",
    cell: (row) => row.changedByName ?? "Hệ thống",
  },
];

/**
 * Tab "Lịch sử phụ trách" (kế hoạch sales-owner §2.1: bảng chỉ ghi thêm) — phân trang server
 * (`GET /customers/{id}/sales-owner-history`). Chỉ xem.
 */
export function SalesOwnerHistoryTab({ customerId }: { customerId: string }) {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(PAGE_SIZES[0] ?? 10);
  const query = useSalesOwnerHistory(customerId, page, size);
  const data = query.data;

  return (
    <section aria-label={L.tab}>
      {query.isPending && <Skeleton className="h-16" />}
      {query.isError && (
        <p role="alert" className="text-danger text-[0.8125rem]">
          {L.loadError}{" "}
          <button type="button" className="underline" onClick={() => void query.refetch()}>
            Thử lại
          </button>
        </p>
      )}
      {data && (
        <DataTable
          data={data.items}
          columns={COLUMNS}
          rowKey={(row) => row.id}
          caption={`${data.totalElements} lần thay đổi`}
          pageSizeOptions={PAGE_SIZES}
          serverPagination={{
            ...data,
            onPageChange: setPage,
            onPageSizeChange: (next) => {
              setSize(next);
              setPage(0);
            },
          }}
          stickyHeader
          emptyState={L.empty}
        />
      )}
    </section>
  );
}
