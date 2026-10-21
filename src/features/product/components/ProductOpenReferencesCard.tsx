"use client";

import { FileClock } from "lucide-react";

import { PRODUCT_STATUS, UI_LABELS } from "@/constants";
import { PRODUCT_ACTIONS, useOpenReferences } from "@/features/product";

import { OpenReferencesList } from "./OpenReferencesList";
import { PRODUCT_CARD_CLASS } from "./ProductSection";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { ProductStatus } from "@/features/product";

const L = UI_LABELS.product.openReferences;

/**
 * Đã qua duyệt — có thể còn dòng đơn mua / đơn bán mở trên SKU. Gồm cả Ngừng kinh doanh: BR-PRD-005
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
 * của hành động "Ngừng kinh doanh" (`PRODUCT_ACTIONS`, lifecycle.ts) — BE quét đơn mua lẫn đơn bán theo
 * từng SKU nên không gọi cho mọi người xem. UI-only — Backend phải re-check.
 */
const DECIDE_PERMISSION = PRODUCT_ACTIONS.find(
  (action) => action.code === "discontinue",
)?.permission;

/**
 * Thẻ "Chứng từ còn mở" ở cột phải (BE `GET /products/{id}/open-references`, tối đa 20 dòng): xem trước
 * khi tạm ngưng hay ngừng kinh doanh, và theo dõi các dòng còn chạy sau khi ngừng.
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
  const visible =
    OPEN_REFERENCE_STATUSES.includes(status) &&
    DECIDE_PERMISSION !== undefined &&
    can(DECIDE_PERMISSION);
  const query = useOpenReferences(productId, visible, { cached: true });
  if (!visible) return null;
  const references = query.data?.references ?? [];

  return (
    <section className={PRODUCT_CARD_CLASS}>
      <h2 className="text-ink-primary mb-1 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <FileClock className="text-accent size-3.5" />
        {L.title}
        {references.length > 0 && (
          <span className="text-ink-tertiary text-xs tabular-nums">({references.length})</span>
        )}
      </h2>
      <p className="text-ink-tertiary mb-3 text-xs">{L.hint}</p>
      {query.isError ? (
        <p role="alert" className="text-danger text-xs">
          {L.loadFailed}
        </p>
      ) : query.isPending ? (
        <p className="text-ink-tertiary text-xs">{L.loading}</p>
      ) : references.length === 0 ? (
        <p className="text-ink-secondary text-xs">{L.empty}</p>
      ) : (
        <OpenReferencesList references={references} truncated={query.data.truncated} />
      )}
    </section>
  );
}
