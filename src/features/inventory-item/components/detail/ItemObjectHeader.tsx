import { UI_LABELS } from "@/constants";

import type { InventoryItem } from "../../types";

/**
 * Đầu trang chi tiết hồ sơ hàng tồn (backoffice-erp-ui B9): SKU lớn làm tên đối tượng, dòng dưới nói
 * đây là hồ sơ hàng tồn. Hồ sơ không có vòng đời / trạng thái và không có việc nguy hiểm nên không có
 * nút chuyển trạng thái hay menu "⋯"; "Sửa logistics" nằm ở đầu khung hồ sơ.
 */
export function ItemObjectHeader({ item }: { item: InventoryItem }) {
  return (
    <header className="mb-5 min-w-0 space-y-1.5">
      <h1 className="text-ink-primary font-[family-name:var(--font-display)] text-2xl leading-tight font-semibold tracking-tight break-all">
        {item.sku}
      </h1>
      <p className="text-ink-secondary text-[0.8125rem]">{UI_LABELS.inventoryItem.title}</p>
    </header>
  );
}
