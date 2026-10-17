"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { DataTable, type ColumnDef } from "@/components/shared/DataTable";

import { useProductVersions } from "@/features/product";
import { CHANGE_TYPE_LABEL, changedFieldLabel, historyStatusLabel } from "../lifecycle-labels";

import type { ProductVersion } from "../lifecycle-schemas";

const HISTORY_PAGE_SIZES = [10, 20, 50];

/** Dòng "từ → đến" của một lần đổi trạng thái; trống nếu dòng không đổi trạng thái. */
function StatusMove({ entry }: { entry: ProductVersion }) {
  if (!entry.toStatus) return null;
  return (
    <span className="text-ink-secondary inline-flex items-center gap-1 text-xs">
      {entry.fromStatus && (
        <>
          {historyStatusLabel(entry.fromStatus)}
          <ArrowRight className="size-3" aria-label="chuyển sang" />
        </>
      )}
      <span className="text-ink-primary font-medium">{historyStatusLabel(entry.toStatus)}</span>
    </span>
  );
}

const COLUMNS: ColumnDef<ProductVersion>[] = [
  {
    key: "occurredAt",
    header: "Thời gian",
    cell: (row) => (
      <span className="tabular-nums">{new Date(row.occurredAt).toLocaleString("vi-VN")}</span>
    ),
  },
  { key: "actor", header: "Người thực hiện", cell: (row) => row.actorName ?? "—" },
  {
    key: "change",
    header: "Thay đổi",
    cell: (row) => (
      <div className="space-y-0.5">
        <div className="text-ink-primary font-medium">{CHANGE_TYPE_LABEL[row.changeType]}</div>
        <StatusMove entry={row} />
        {row.changedFields && row.changedFields.length > 0 && (
          <div className="text-ink-tertiary text-xs">
            {row.changedFields.map(changedFieldLabel).join(", ")}
          </div>
        )}
      </div>
    ),
  },
  {
    key: "reason",
    header: "Lý do",
    cell: (row) => <span className="text-ink-secondary">{row.reason || "—"}</span>,
  },
];

/**
 * Lịch sử thay đổi của sản phẩm (BE `GET /products/{id}/versions`, mới nhất trước, phân trang): chuyển
 * trạng thái kèm lý do, sửa thông tin, biến thể, ảnh, logistics và chính sách tồn kho.
 */
export function ProductHistory({ productId }: { productId: string }) {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(HISTORY_PAGE_SIZES[0] ?? 10);
  const query = useProductVersions(productId, page, size);

  if (query.isError) {
    return (
      <p role="alert" className="text-danger text-[0.8125rem]">
        Không tải được lịch sử thay đổi. Hãy thử tải lại trang.
      </p>
    );
  }
  if (query.isLoading || !query.data) {
    return <p className="text-ink-tertiary text-[0.8125rem]">Đang tải lịch sử…</p>;
  }
  const data = query.data;
  if (data.totalElements === 0) {
    return (
      <div className="border-border-default text-ink-tertiary rounded-[var(--r-sm)] border py-10 text-center text-[0.8125rem]">
        Chưa có thay đổi nào được ghi lại
      </div>
    );
  }
  return (
    <DataTable
      data={data.items}
      columns={COLUMNS}
      rowKey={(row) => `${row.occurredAt}-${row.changeType}-${row.subjectId ?? ""}`}
      caption={`${data.totalElements} thay đổi`}
      pageSize={size}
      pageSizeOptions={HISTORY_PAGE_SIZES}
      serverPagination={{
        page: data.page,
        size: data.size,
        totalElements: data.totalElements,
        totalPages: data.totalPages,
        hasNext: data.hasNext,
        hasPrevious: data.hasPrevious,
        onPageChange: setPage,
        onPageSizeChange: (next) => {
          setSize(next);
          setPage(0);
        },
      }}
    />
  );
}
