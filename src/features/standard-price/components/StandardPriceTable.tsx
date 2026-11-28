"use client";

import { useState } from "react";
import { RotateCw, Tags } from "lucide-react";

import { STANDARD_PRICE_UI_LABELS } from "@/constants";
import { withHeaderFilters } from "@/components/shared/ColumnHeaderFilter";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { standardPriceErrorKind } from "../errors";
import { DeleteStandardPriceDialog } from "./DeleteStandardPriceDialog";
import { actionColumn, STANDARD_PRICE_COLUMNS } from "./standard-price-columns";
import { standardPriceHeaderFilters, StandardPriceToolbar } from "./StandardPriceToolbar";

import type { StandardPrice } from "../schemas";
import type { StandardPriceFilters } from "./useStandardPriceFilters";

const L = STANDARD_PRICE_UI_LABELS;
const T = L.table;
const PAGE_SIZE = 15;
/** EmptyState bỏ khung khi nằm trong thân bảng (backoffice-erp-ui A7). */
const IN_TABLE = "rounded-none border-0 bg-transparent py-10 whitespace-normal";

interface PricesQuery {
  data: StandardPrice[] | undefined;
  error: unknown;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => unknown;
}

/**
 * Danh sách giá chuẩn (BE `GET /catalog/standard-prices` — mảng thường, không phân trang). Lọc + phân trang phía FE.
 * Thao tác sửa / xoá trong menu "⋯" chỉ có khi người dùng có quyền (UI-only, BE re-check); xoá hỏi lại trước. Bảng luôn
 * giữ header (còn bỏ lọc ở cột được); chưa có dữ liệu / lọc không ra thì thông báo nằm trong thân bảng.
 */
export function StandardPriceTable({
  query,
  canRead,
  onEdit,
  canDelete,
  filters,
}: {
  query: PricesQuery;
  canRead: boolean;
  onEdit?: (price: StandardPrice) => void;
  canDelete: boolean;
  filters: StandardPriceFilters;
}) {
  const [removing, setRemoving] = useState<StandardPrice | null>(null);

  if (!canRead) return <EmptyState title={T.readDenied} />;
  if (query.isPending)
    return (
      <div role="status">
        <span className="sr-only">{T.loading}</span>
        <PageSkeleton variant="list" />
      </div>
    );
  const retry = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={query.isFetching}
      onClick={() => void query.refetch()}
    >
      <RotateCw className="size-3.5" /> {T.retry}
    </Button>
  );
  const prices = query.data;
  // Chưa có dữ liệu mà lỗi → báo lỗi; không bao giờ nói "chưa có giá chuẩn" khi thật ra là lỗi
  if (prices === undefined) {
    const forbidden = standardPriceErrorKind(query.error) === "FORBIDDEN";
    return (
      <div role="alert" className="space-y-2">
        <p className="text-danger text-xs">{forbidden ? T.readDenied : T.loadFailed}</p>
        {!forbidden && retry}
      </div>
    );
  }
  const rows = filters.apply(prices);
  const withActions = onEdit || canDelete;
  const allColumns = withActions
    ? [...STANDARD_PRICE_COLUMNS, actionColumn(onEdit, canDelete ? setRemoving : undefined)]
    : STANDARD_PRICE_COLUMNS;
  const columns = withHeaderFilters(
    allColumns.filter((column) => filters.columns.visible.some((key) => key === column.key)),
    standardPriceHeaderFilters(filters),
  );

  return (
    <div className="space-y-3">
      {query.isError && (
        <div role="status" className="flex items-center gap-2">
          <p className="text-warning text-xs">{T.refreshFailed}</p>
          {retry}
        </div>
      )}
      <StandardPriceToolbar filters={filters} />
      <DataTable
        data={rows}
        columns={columns}
        rowKey={(p) => p.sku}
        caption={T.caption}
        pageSize={PAGE_SIZE}
        stickyHeader
        emptyState={
          prices.length === 0 ? (
            <EmptyState
              className={IN_TABLE}
              icon={<Tags className="size-8" />}
              title={T.empty}
              description={T.emptyHint}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              className={IN_TABLE}
              icon={<Tags className="size-8" />}
              title={T.noMatch}
              action={
                <Button type="button" variant="outline" size="sm" onClick={filters.clear}>
                  {T.clearFilter}
                </Button>
              }
            />
          ) : undefined
        }
      />
      <DeleteStandardPriceDialog price={removing} onClose={() => setRemoving(null)} />
    </div>
  );
}
