"use client";

import { useMemo } from "react";
import { parseAsString, useQueryState } from "nuqs";

import { toLocalIsoDate } from "@/lib/format/date";
import { useProductVersions } from "@/features/product";
import {
  ColumnFilterButton,
  HeaderDateRangeFilter,
  HeaderOptionFilter,
  withHeaderFilters,
} from "@/components/shared/ColumnHeaderFilter";
import { DataTable } from "@/components/shared/DataTable";

import { CHANGE_TYPE_LABEL, historyActorLabel } from "../lifecycle-labels";
import { textIncludes } from "@/lib/text-match";
import { historyColumns, historySku } from "./history-columns";
import { uniqueOptions } from "./open-reference-columns";

const HISTORY_PAGE_SIZES = [10, 20, 50];
/** Trần trang của BE (`Pages.MAX_PAGE_SIZE`) — tải một lần để lọc theo cột đúng trên toàn bộ. */
const HISTORY_FETCH_SIZE = 200;
const NO_SKUS: ReadonlyMap<string, string> = new Map();
/** Ngày `YYYY-MM-DD` nằm trong [from, to] (đầu rỗng = không chặn); so chuỗi ISO là so ngày. */
const inRange = (date: string, from: string, to: string) =>
  (!from || date >= from) && (!to || date <= to);
/** Giá trị lọc "dòng của sản phẩm" (không gắn biến thể) ở cột Biến thể. */
const PRODUCT_ROW = "__product__";

/**
 * Lịch sử thay đổi của sản phẩm (BE `GET /products/{id}/versions`, mới nhất trước): chuyển trạng thái
 * kèm lý do, sửa thông tin, biến thể, ảnh. BE chưa có tham số lọc → tải một lần tối đa 200 dòng gần
 * nhất rồi lọc theo cột (thời gian, loại, biến thể, người làm, lý do — trên URL) và phân trang ở FE; quá 200 dòng
 * thì báo rõ phạm vi lọc.
 */
export function ProductHistory({
  productId,
  skuById = NO_SKUS,
}: {
  productId: string;
  /** variantId → SKU, để dòng biến thể nêu SKU nào (`subjectId`). */
  skuById?: ReadonlyMap<string, string>;
}) {
  const query = useProductVersions(productId, 0, HISTORY_FETCH_SIZE);
  const [type, setType] = useQueryState("hType", parseAsString);
  const [sku, setSku] = useQueryState("hSku", parseAsString);
  const [actor, setActor] = useQueryState("hActor", parseAsString);
  const [reason, setReason] = useQueryState("hReason", parseAsString.withDefault(""));
  const [from, setFrom] = useQueryState("hFrom", parseAsString.withDefault(""));
  const [to, setTo] = useQueryState("hTo", parseAsString.withDefault(""));
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  const rows = useMemo(
    () =>
      items.filter(
        (row) =>
          (!type || row.changeType === type) &&
          (!sku || (historySku(row, skuById) || PRODUCT_ROW) === sku) &&
          (!actor || historyActorLabel(row.actorName) === actor) &&
          textIncludes(row.reason ?? "", reason) &&
          inRange(toLocalIsoDate(row.occurredAt), from, to),
      ),
    [items, type, sku, actor, reason, from, to, skuById],
  );

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
  if (query.data.totalElements === 0) {
    return (
      <div className="border-border-default text-ink-tertiary rounded-[var(--r-sm)] border py-10 text-center text-[0.8125rem]">
        Chưa có thay đổi nào được ghi lại
      </div>
    );
  }

  const filters = {
    occurredAt: (
      <HeaderDateRangeFilter
        label="thời gian"
        from={from}
        to={to}
        onChange={(range) => {
          void setFrom(range.from || null);
          void setTo(range.to || null);
        }}
      />
    ),
    changeType: (
      <HeaderOptionFilter
        label="loại thay đổi"
        value={type}
        options={uniqueOptions(items.map((r) => [r.changeType, CHANGE_TYPE_LABEL[r.changeType]]))}
        onChange={(v) => void setType(v)}
        searchPlaceholder="Tìm loại thay đổi…"
        emptyLabel="Không có loại nào"
      />
    ),
    sku: (
      <HeaderOptionFilter
        label="biến thể"
        value={sku}
        options={uniqueOptions(
          items.map((r) => {
            const value = historySku(r, skuById);
            return value ? [value, value] : [PRODUCT_ROW, "Sản phẩm (không gắn biến thể)"];
          }),
        )}
        onChange={(v) => void setSku(v)}
        searchPlaceholder="Tìm SKU…"
        emptyLabel="Không có biến thể"
      />
    ),
    actor: (
      <HeaderOptionFilter
        label="người thực hiện"
        value={actor}
        options={uniqueOptions(
          items.map((r) => [historyActorLabel(r.actorName), historyActorLabel(r.actorName)]),
        )}
        onChange={(v) => void setActor(v)}
        searchPlaceholder="Tìm người…"
        emptyLabel="Không có người nào"
      />
    ),
    reason: (
      <ColumnFilterButton
        label="lý do"
        value={reason}
        placeholder="Tìm trong lý do…"
        onChange={(v) => void setReason(v || null)}
      />
    ),
  };
  const filtering = Boolean(type || sku || actor || reason || from || to);

  return (
    <div className="space-y-2">
      <DataTable
        data={rows}
        columns={withHeaderFilters(historyColumns(skuById), filters)}
        rowKey={(row) => `${row.occurredAt}-${row.changeType}-${row.subjectId ?? ""}`}
        caption={`${rows.length} thay đổi`}
        pageSize={HISTORY_PAGE_SIZES[0]}
        pageSizeOptions={HISTORY_PAGE_SIZES}
        stickyHeader
        emptyState={filtering ? "Không có thay đổi nào khớp bộ lọc." : undefined}
      />
      {query.data.totalElements > items.length && (
        <p className="text-ink-tertiary text-xs">
          Đang xem và lọc trên {items.length} thay đổi gần nhất trong tổng{" "}
          {query.data.totalElements}.
        </p>
      )}
    </div>
  );
}
