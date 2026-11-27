"use client";

import { useState } from "react";
import { ReceiptText, RotateCw } from "lucide-react";

import { CUSTOMER_PRICE_UI_LABELS } from "@/constants";
import { withHeaderFilters } from "@/components/shared/ColumnHeaderFilter";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { customerPriceErrorKind } from "../errors";
import { useCustomerPrices } from "../queries";
import { filterPricesBySku, matchesPriceColumns } from "../selectors";
import { CustomerPriceDetail } from "./CustomerPriceDetail";
import { CustomerPriceToolbar, usePriceTableState } from "./CustomerPriceToolbar";
import { CUSTOMER_PRICE_COLUMNS, editColumn } from "./price-columns";
import { priceHeaderFilters } from "./price-header-filters";

const L = CUSTOMER_PRICE_UI_LABELS;
const T = L.table;
const PAGE_SIZE = 10;
/** EmptyState bỏ khung khi nằm trong thân bảng (backoffice-erp-ui A7). */
const IN_TABLE = "rounded-none border-0 bg-transparent py-10 whitespace-normal";

/**
 * Giá riêng của MỘT khách (BE `GET /catalog/customer-prices?customerId=` — mảng thường, không phân trang).
 * Phân trang + lọc SKU phía FE trên đúng mảng của khách này. Component cha đặt `key={customerId}`: đổi
 * khách là dựng lại (trang, bộ lọc, dòng đang mở về mặc định) — không mang trang của khách trước sang.
 * `canRead` = `catalog-customer-prices:READ`: thiếu thì không gọi API (UI-only, BE re-check).
 */
export function CustomerPriceTable({
  customerId,
  canRead,
  canDelete = false,
  canSeeCarton = false,
  onEdit,
}: {
  customerId: string;
  canRead: boolean;
  /** `catalog-customer-prices:DELETE` — panel chi tiết có nút xoá giá. */
  canDelete?: boolean;
  /** Tra được số cái / thùng của SKU riêng (`product-variants:READ` + `product-products:READ`). */
  canSeeCarton?: boolean;
  /** Có khi người dùng có quyền sửa — thêm cột "Sửa bảng giá". */
  onEdit?: (sku: string) => void;
}) {
  const query = useCustomerPrices(customerId, canRead);
  const table = usePriceTableState();
  const { columns } = table;
  const [openSku, setOpenSku] = useState<string | null>(null);

  if (!canRead) return <EmptyState title={T.readDenied} />;
  if (query.isPending)
    return (
      <div role="status">
        <span className="sr-only">{T.loading}</span>
        <PageSkeleton variant="list" />
      </div>
    );
  const prices = query.data;
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
  // Chưa có dữ liệu mà lỗi → báo đúng loại; không bao giờ nói "chưa có giá" khi thật ra là lỗi
  if (prices === undefined) {
    const kind = customerPriceErrorKind(query.error);
    const message =
      kind === "FORBIDDEN"
        ? T.readDenied
        : kind === "CUSTOMER_NOT_FOUND"
          ? L.customer.notFound
          : T.loadFailed;
    const canRetry = kind !== "FORBIDDEN" && kind !== "CUSTOMER_NOT_FOUND";
    return (
      <div role="alert" className="space-y-2">
        <p className="text-danger text-xs">{message}</p>
        {canRetry && retry}
      </div>
    );
  }

  const rows = filterPricesBySku(prices, table.q).filter((p) =>
    matchesPriceColumns(p, table.columnFilters),
  );
  const open = prices.find((p) => p.sku === openSku) ?? null;
  return (
    <div className="space-y-3">
      {/* Tải lại nền lỗi: giữ dữ liệu đã có, chỉ báo */}
      {query.isError && (
        <div role="status" className="flex items-center gap-2">
          <p className="text-warning text-xs">{T.refreshFailed}</p>
          {retry}
        </div>
      )}
      <CustomerPriceToolbar state={table} />
      {/* Bảng luôn giữ header; khách chưa có giá / lọc không ra → thông báo trong thân bảng (backoffice-erp-ui A7) */}
      <DataTable
        data={rows}
        columns={withHeaderFilters(
          (onEdit
            ? [...CUSTOMER_PRICE_COLUMNS, editColumn(onEdit)]
            : CUSTOMER_PRICE_COLUMNS
          ).filter((column) => columns.visible.some((key) => key === column.key)),
          priceHeaderFilters(table),
        )}
        rowKey={(p) => p.sku}
        caption={T.caption}
        pageSize={PAGE_SIZE}
        stickyHeader
        onRowClick={(p) => setOpenSku(p.sku)}
        emptyState={
          prices.length === 0 ? (
            <EmptyState
              className={IN_TABLE}
              icon={<ReceiptText className="size-8" />}
              title={T.noPrices}
              description={T.noPricesHint}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              className={IN_TABLE}
              icon={<ReceiptText className="size-8" />}
              title={T.noMatch}
              action={
                <Button type="button" variant="outline" size="sm" onClick={table.clear}>
                  {T.clearFilter}
                </Button>
              }
            />
          ) : undefined
        }
      />
      <CustomerPriceDetail
        customerId={customerId}
        price={open}
        canDelete={canDelete}
        canSeeCarton={canSeeCarton}
        onClose={() => setOpenSku(null)}
      />
    </div>
  );
}
