"use client";

import { useState } from "react";
import { RotateCw } from "lucide-react";

import { STANDARD_PRICE_UI_LABELS } from "@/constants";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { SearchBar } from "@/components/shared/SearchBar";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { standardPriceErrorKind, standardPriceErrorMessage } from "../errors";
import { useDeleteStandardPrice } from "../mutations";
import { filterStandardPrices } from "../selectors";
import { actionColumn, STANDARD_PRICE_COLUMNS } from "./standard-price-columns";

import type { StandardPrice } from "../schemas";

const L = STANDARD_PRICE_UI_LABELS;
const T = L.table;
const NOTE = "text-ink-tertiary text-xs";
const PAGE_SIZE = 15;

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
 * Nút sửa / xoá chỉ có khi người dùng có quyền (UI-only, BE re-check); xoá hỏi lại trước.
 */
export function StandardPriceTable({
  query,
  canRead,
  onEdit,
  canDelete,
}: {
  query: PricesQuery;
  canRead: boolean;
  onEdit?: (price: StandardPrice) => void;
  canDelete: boolean;
}) {
  const [filter, setFilter] = useState("");
  const [removing, setRemoving] = useState<StandardPrice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const remove = useDeleteStandardPrice();

  if (!canRead) return <EmptyState title={T.readDenied} />;
  if (query.isPending) return <p className={NOTE}>{T.loading}</p>;
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
  const rows = filterStandardPrices(prices, filter);
  const withActions = onEdit || canDelete;
  const columns = withActions
    ? [
        ...STANDARD_PRICE_COLUMNS,
        actionColumn(onEdit, canDelete ? (p) => (setError(null), setRemoving(p)) : undefined),
      ]
    : STANDARD_PRICE_COLUMNS;

  return (
    <div className="space-y-3">
      {query.isError && (
        <div role="status" className="flex items-center gap-2">
          <p className="text-warning text-xs">{T.refreshFailed}</p>
          {retry}
        </div>
      )}
      {prices.length === 0 ? (
        <EmptyState title={T.empty} description={T.emptyHint} />
      ) : (
        <>
          <SearchBar
            value={filter}
            onChange={setFilter}
            placeholder={T.filter}
            className="max-w-sm"
          />
          {rows.length === 0 ? (
            <EmptyState
              title={T.noMatch}
              action={
                <Button type="button" variant="outline" size="sm" onClick={() => setFilter("")}>
                  {T.clearFilter}
                </Button>
              }
            />
          ) : (
            <DataTable
              data={rows}
              columns={columns}
              rowKey={(p) => p.sku}
              caption={T.caption}
              pageSize={PAGE_SIZE}
            />
          )}
        </>
      )}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={L.remove.title(removing?.sku ?? "")}
        description={L.remove.description}
        confirmLabel={L.remove.confirm}
        variant="danger"
        loading={remove.isPending}
        closeOnConfirm={false}
        error={error}
        onConfirm={() =>
          removing &&
          remove.mutate(
            { sku: removing.sku, version: removing.version },
            {
              onSuccess: () => {
                toast.success(L.remove.deleted);
                setRemoving(null);
              },
              onError: (e) => setError(standardPriceErrorMessage(e)),
            },
          )
        }
      />
    </div>
  );
}
