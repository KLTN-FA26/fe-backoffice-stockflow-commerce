import { Suspense } from "react";

import { WarehouseCapacityList } from "@/features/warehouse-capacity/components/WarehouseCapacityList";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Bảng sức chứa kho — mọi kho đang hoạt động (docs 06 §4.6, BR-20). */
export default function WarehouseCapacityPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <WarehouseCapacityList />
    </Suspense>
  );
}
