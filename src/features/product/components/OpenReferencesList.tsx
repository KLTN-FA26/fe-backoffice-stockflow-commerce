import { ADMIN_ROUTES } from "@/constants";

import { openReferenceKindLabel } from "../lifecycle-labels";

import type { OpenReference } from "../lifecycle-schemas";

/**
 * Chứng từ còn mở tham chiếu SKU của sản phẩm (BE `OpenReferencesResponse`, tối đa 20): hiện trong hộp
 * thoại ngừng kinh doanh để người dùng thấy hậu quả, và trong kết quả sau khi ngừng.
 */
export function OpenReferencesList({
  references,
  truncated,
}: {
  references: readonly OpenReference[];
  truncated: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <ul className="border-border-default max-h-48 divide-y divide-(--table-line) overflow-auto rounded-[var(--r-sm)] border text-[0.8125rem]">
        {references.map((reference) => (
          <li
            key={`${reference.kind}-${reference.documentId}-${reference.sku}`}
            className="flex items-center justify-between gap-3 px-3 py-1.5"
          >
            <span className="text-ink-secondary">
              {openReferenceKindLabel(reference.kind)}{" "}
              <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium">
                {reference.documentNumber}
              </span>
            </span>
            <span className="text-ink-tertiary font-[family-name:var(--font-mono)] text-xs">
              {reference.sku}
            </span>
          </li>
        ))}
      </ul>
      {truncated && (
        <p className="text-ink-tertiary text-xs">
          Còn nhiều chứng từ nữa — chỉ hiện tối đa 20. Xem đầy đủ ở{" "}
          <a href={ADMIN_ROUTES.purchaseOrders.list} className="text-accent hover:underline">
            Đơn đặt NCC
          </a>{" "}
          và{" "}
          <a href={ADMIN_ROUTES.orders.list} className="text-accent hover:underline">
            Đơn hàng
          </a>
          .
        </p>
      )}
    </div>
  );
}
