"use client";

import { useMemo } from "react";
import { parseAsString, useQueryState } from "nuqs";

import { ADMIN_ROUTES, PRODUCT_STATUS, UI_LABELS } from "@/constants";
import { openReferenceKindLabel, PRODUCT_ACTIONS, useOpenReferences } from "@/features/product";

import {
  ColumnFilterButton,
  HeaderOptionFilter,
  withHeaderFilters,
} from "@/components/shared/ColumnHeaderFilter";
import { DataTable } from "@/components/shared/DataTable";

import { textIncludes } from "@/lib/text-match";
import { OPEN_REFERENCE_COLUMNS, uniqueOptions } from "./open-reference-columns";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { ProductStatus } from "@/features/product";

const L = UI_LABELS.product.openReferences;

/**
 * Đã qua duyệt — có thể còn dòng Đơn sản xuất / đơn bán mở trên SKU. Gồm cả Ngừng kinh doanh: BR-PRD-005
 * cho các dòng mở chạy tiếp, cần thấy để theo dõi.
 */
const OPEN_REFERENCE_STATUSES: readonly ProductStatus[] = [
  PRODUCT_STATUS.APPROVED,
  PRODUCT_STATUS.PUBLISHED,
  PRODUCT_STATUS.INACTIVE,
  PRODUCT_STATUS.DISCONTINUED,
];

/**
 * Cùng gate với hộp thoại ngừng kinh doanh (nơi khác duy nhất tải danh sách này): chỉ người giữ quyền
 * của hành động "Ngừng kinh doanh" (`PRODUCT_ACTIONS`, lifecycle.ts) — BE quét Đơn sản xuất lẫn đơn bán theo
 * từng SKU nên không gọi cho mọi người xem. UI-only — Backend phải re-check.
 */
const DECIDE_PERMISSION = PRODUCT_ACTIONS.find(
  (action) => action.code === "discontinue",
)?.permission;

/** Có xem được chứng từ còn mở không (trạng thái + quyền) — trang ẩn tab khi không. UI-only. */
export function canSeeOpenReferences(
  status: ProductStatus,
  can: (permission: PermissionCode) => boolean,
): boolean {
  return (
    OPEN_REFERENCE_STATUSES.includes(status) &&
    DECIDE_PERMISSION !== undefined &&
    can(DECIDE_PERMISSION)
  );
}

/**
 * "Chứng từ còn mở" (BE `GET /products/{id}/open-references`, tối đa 20 dòng): xem trước khi tạm ngưng
 * hay ngừng kinh doanh, và theo dõi các dòng còn chạy sau khi ngừng. Tiêu đề + số lượng + giải thích ở
 * trên, bảng (loại, số chứng từ, SKU) có cuộn ngang / dọc và phân trang.
 */
export function ProductOpenReferencesCard({
  productId,
  status,
  can,
}: {
  productId: string;
  status: ProductStatus;
  can: (permission: PermissionCode) => boolean;
}) {
  const visible = canSeeOpenReferences(status, can);
  const query = useOpenReferences(productId, visible, { cached: true });
  // Lọc theo cột (trên URL): loại chứng từ, số chứng từ (gõ chữ), SKU — lọc trên tối đa 20 dòng BE trả
  const [kind, setKind] = useQueryState("rKind", parseAsString);
  const [doc, setDoc] = useQueryState("rDoc", parseAsString.withDefault(""));
  const [sku, setSku] = useQueryState("rSku", parseAsString);
  const references = useMemo(() => query.data?.references ?? [], [query.data]);
  const rows = useMemo(
    () =>
      references.filter(
        (row) =>
          (!kind || row.kind === kind) &&
          (!sku || row.sku === sku) &&
          textIncludes(row.documentNumber, doc),
      ),
    [references, kind, sku, doc],
  );
  if (!visible) return null;
  const filters = {
    kind: (
      <HeaderOptionFilter
        label="loại chứng từ"
        value={kind}
        options={uniqueOptions(references.map((r) => [r.kind, openReferenceKindLabel(r.kind)]))}
        onChange={(v) => void setKind(v)}
        searchPlaceholder="Tìm loại…"
        emptyLabel="Không có loại nào"
      />
    ),
    documentNumber: (
      <ColumnFilterButton
        label="số chứng từ"
        value={doc}
        placeholder="Tìm số chứng từ…"
        onChange={(v) => void setDoc(v || null)}
      />
    ),
    sku: (
      <HeaderOptionFilter
        label="SKU"
        value={sku}
        options={uniqueOptions(references.map((r) => [r.sku, r.sku]))}
        onChange={(v) => void setSku(v)}
        searchPlaceholder="Tìm SKU…"
        emptyLabel="Không có SKU"
      />
    ),
  };
  const filtering = Boolean(kind || sku || doc);

  // Tiêu đề + giải thích nằm trên bảng (như bảng biến thể); bảng dùng `DataTable`: khung cố định,
  // cuộn ngang / dọc với header dính, phân trang 10 dòng.
  return (
    <section aria-label={L.title} className="space-y-3">
      <div>
        <h3 className="text-ink-primary text-sm font-semibold">
          {L.title}
          {query.data && (
            <span className="text-ink-tertiary ml-1.5 font-normal tabular-nums">
              {references.length}
            </span>
          )}
        </h3>
        <p className="text-ink-tertiary mt-0.5 text-xs">{L.hint}</p>
      </div>
      {query.isError ? (
        <p role="alert" className="text-danger text-[0.8125rem]">
          {L.loadFailed}
        </p>
      ) : query.isPending ? (
        <p className="text-ink-tertiary text-[0.8125rem]">{L.loading}</p>
      ) : (
        <>
          <DataTable
            data={rows}
            columns={withHeaderFilters(OPEN_REFERENCE_COLUMNS, filters)}
            rowKey={(row) => `${row.kind}-${row.documentId}-${row.sku}`}
            caption={`${references.length} dòng chứng từ còn mở`}
            pageSize={10}
            pageSizeOptions={[10, 20]}
            stickyHeader
            emptyState={filtering ? "Không có chứng từ nào khớp bộ lọc." : L.empty}
          />
          {query.data.truncated && (
            <p className="text-ink-tertiary text-xs">
              Còn nhiều chứng từ nữa — chỉ hiện tối đa 20. Xem đầy đủ ở{" "}
              <a href={ADMIN_ROUTES.orders.list} className="text-accent-text hover:underline">
                Đơn hàng
              </a>
              .
            </p>
          )}
        </>
      )}
    </section>
  );
}
