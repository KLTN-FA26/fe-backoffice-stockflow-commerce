"use client";

import { useState } from "react";
import { RotateCw } from "lucide-react";

import { CUSTOMER_PRICE_UI_LABELS } from "@/constants";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { SearchBar } from "@/components/shared/SearchBar";
import { Button } from "@/components/ui/button";

import { customerPriceErrorKind } from "../errors";
import { useCustomerPrices } from "../queries";
import { filterPricesBySku } from "../selectors";
import { CustomerPriceDetail } from "./CustomerPriceDetail";
import { CUSTOMER_PRICE_COLUMNS, editColumn } from "./price-columns";

const L = CUSTOMER_PRICE_UI_LABELS;
const T = L.table;
const NOTE = "text-ink-tertiary text-xs";
const PAGE_SIZE = 10;

/**
 * Giá riêng của MỘT khách (BE `GET /catalog/customer-prices?customerId=` — mảng thường, không phân trang).
 * Phân trang + lọc SKU phía FE trên đúng mảng của khách này. Component cha đặt `key={customerId}`: đổi
 * khách là dựng lại (trang, bộ lọc, dòng đang mở về mặc định) — không mang trang của khách trước sang.
 * `canRead` = `catalog-customer-prices:READ`: thiếu thì không gọi API (UI-only, BE re-check).
 */
export function CustomerPriceTable({
  customerId,
  canRead,
  onEdit,
}: {
  customerId: string;
  canRead: boolean;
  /** Có khi người dùng có quyền sửa — thêm cột "Sửa bảng giá". */
  onEdit?: (sku: string) => void;
}) {
  const query = useCustomerPrices(customerId, canRead);
  const [filter, setFilter] = useState("");
  const [openSku, setOpenSku] = useState<string | null>(null);

  if (!canRead) return <EmptyState title={T.readDenied} />;
  if (query.isPending) return <p className={NOTE}>{T.loading}</p>;
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

  const rows = filterPricesBySku(prices, filter);
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
      {prices.length === 0 ? (
        <EmptyState title={T.noPrices} description={T.noPricesHint} />
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
              columns={
                onEdit ? [...CUSTOMER_PRICE_COLUMNS, editColumn(onEdit)] : CUSTOMER_PRICE_COLUMNS
              }
              rowKey={(p) => p.sku}
              caption={T.caption}
              pageSize={PAGE_SIZE}
              onRowClick={(p) => setOpenSku(p.sku)}
            />
          )}
        </>
      )}
      <CustomerPriceDetail price={open} onClose={() => setOpenSku(null)} />
    </div>
  );
}
