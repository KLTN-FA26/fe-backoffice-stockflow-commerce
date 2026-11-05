import { Suspense } from "react";

import { InventoryItemDetail } from "@/features/inventory-item/components/detail/InventoryItemDetail";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Chi tiết hồ sơ hàng tồn — BE PR #119; quyền VIEW_PAGE do `InventoryItemDetail` kiểm. */
export default async function InventoryItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <InventoryItemDetail id={id} />
    </Suspense>
  );
}
