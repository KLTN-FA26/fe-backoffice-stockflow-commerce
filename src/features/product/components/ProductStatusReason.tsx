import { PRODUCT_STATUS, UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";

import type { Product } from "@/features/product";

const S = UI_LABELS.product.statusReason;

function reasonRows(product: Product) {
  if (product.status === PRODUCT_STATUS.INACTIVE) {
    return [
      { label: S.suspendReason, value: product.suspendReason },
      { label: S.suspendedAt, value: product.suspendedAt && formatDateTime(product.suspendedAt) },
    ];
  }
  if (product.status === PRODUCT_STATUS.DISCONTINUED) {
    return [
      { label: S.discontinueReason, value: product.discontinueReason },
      {
        label: S.discontinuedAt,
        value: product.discontinuedAt && formatDateTime(product.discontinuedAt),
      },
    ];
  }
  return [];
}

/**
 * Lý do + mốc tạm ngưng / ngừng kinh doanh ngay dưới trạng thái ở thẻ hành động. BE chỉ trả các trường
 * này khi INACTIVE / DISCONTINUED (`ck_products_inactive` / `_discontinued`); thiếu trường nào thì bỏ dòng đó.
 */
export function ProductStatusReason({ product }: { product: Product }) {
  const shown = reasonRows(product).filter((row) => row.value);
  if (shown.length === 0) return null;
  return (
    <dl className="border-border-default bg-bg-subtle mb-4 space-y-1.5 rounded-[var(--r-sm)] border p-2.5 text-xs">
      {shown.map((row) => (
        <div key={row.label}>
          <dt className="text-ink-tertiary">{row.label}</dt>
          <dd className="text-ink-primary break-words">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
