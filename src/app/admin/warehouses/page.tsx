import { Suspense } from "react";

import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { WarehouseList } from "@/features/warehouse-map/components/WarehouseList";

export default function WarehousesPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <WarehouseList />
    </Suspense>
  );
}
