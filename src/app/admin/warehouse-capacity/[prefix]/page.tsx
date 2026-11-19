import { Suspense } from "react";

import { WarehouseCapacityDetail } from "@/features/warehouse-capacity/components/WarehouseCapacityDetail";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Sức chứa của kho có prefix trên URL, xem theo zone / kệ / khu (docs 06 §4.6 bước 4). */
export default async function WarehouseCapacityDetailPage({
  params,
}: {
  params: Promise<{ prefix: string }>;
}) {
  const { prefix } = await params;
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <WarehouseCapacityDetail prefix={decodeURIComponent(prefix)} />
    </Suspense>
  );
}
