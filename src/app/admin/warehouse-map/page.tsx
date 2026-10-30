import { Suspense } from "react";

import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { WarehouseMapView } from "@/features/warehouse-map/components/map/WarehouseMapView";

export default function WarehouseMapPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <WarehouseMapView />
    </Suspense>
  );
}
