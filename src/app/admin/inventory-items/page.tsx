import { Suspense } from "react";

import { InventoryItemList } from "@/features/inventory-item/components/InventoryItemList";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Hồ sơ hàng tồn — BE PR #119; quyền VIEW_PAGE do `InventoryItemList` kiểm. */
export default function InventoryItemsPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <InventoryItemList />
    </Suspense>
  );
}
